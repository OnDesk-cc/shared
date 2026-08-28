/**
 * Platform session verification for the OnDesk control plane.
 *
 * A product Worker authenticates nobody and issues no cookies of its own. The
 * session is a single RS256 token minted by ondesk and carried in an
 * `access_token` cookie on `Domain=.ondesk.cc`, so the browser presents it here
 * exactly as it presents it to ondesk — signing in once is signing in
 * everywhere. This file verifies that token against ondesk's published JWKS;
 * a product holds public keys and never anything that could mint a session.
 *
 * The ONE implementation every product uses — halo, nexus, orbit, pulse and
 * vault import it from `@ondesk/shared/worker/sso`, so a fix to token
 * verification lands everywhere at once. ondesk itself never imports it: it is
 * the issuer, and verifying is not the issuer's problem.
 *
 * See ondesk/docs/platform-architecture.md.
 */

/**
 * What verification needs from the consumer's bindings, structurally — every
 * app's `Env` satisfies it without knowing about this type.
 */
export interface SsoEnv {
	/** Origin of the control plane. Defaults to https://ondesk.cc. */
	ONDESK_ISSUER?: string;
	/** HMAC secret for mirror-sync webhooks. Absent means webhooks are refused. */
	ONDESK_WEBHOOK_SECRET?: string;
}

/**
 * The platform session, as ondesk signs it.
 *
 * `token_use` is the discriminator: ID tokens and OIDC access tokens are signed
 * with the same RSA key, and without it any of them would verify as a session.
 * `role` is the platform-level account role — what this person may do in a
 * given workspace comes from the mirrored membership, not from here.
 */
export interface SessionClaims {
	iss: string;
	sub: string;
	email: string;
	name: string;
	role: string;
	token_use: "session";
	iat: number;
	exp: number;
}

interface Jwk {
	kty: string;
	n: string;
	e: string;
	kid?: string;
	alg?: string;
	use?: string;
}

// ─── base64url ────────────────────────────────────────────────────────────────

function base64UrlDecode(str: string): Uint8Array {
	const padded = str.replace(/-/g, "+").replace(/_/g, "/");
	const binary = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), "="));
	return new Uint8Array(Array.from(binary, (c) => c.charCodeAt(0)));
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

export function ondeskIssuer(env: SsoEnv): string {
	return (env.ONDESK_ISSUER ?? "https://ondesk.cc").replace(/\/$/, "");
}

// ─── Session token verification ───────────────────────────────────────────────

// Cached across requests on a warm isolate. The TTL bounds how long a rotated-out
// key stays trusted here.
let jwksCache: { keys: Jwk[]; fetchedAt: number } | null = null;
const JWKS_TTL = 60 * 60;

async function fetchJwks(env: SsoEnv): Promise<Jwk[]> {
	const now = Math.floor(Date.now() / 1000);
	if (jwksCache && now - jwksCache.fetchedAt < JWKS_TTL) return jwksCache.keys;

	const res = await fetch(`${ondeskIssuer(env)}/api/oidc/jwks`);
	if (!res.ok) throw new Error(`Failed to fetch JWKS (${res.status})`);

	const body = (await res.json()) as { keys: Jwk[] };
	jwksCache = { keys: body.keys, fetchedAt: now };
	return body.keys;
}

/**
 * Full verification: signature, issuer, expiry and `token_use`. Returns null on
 * any failure and never explains which check failed — the caller answers 401
 * either way, and a verifier that distinguishes them is an oracle.
 *
 * Never decode a session token without this: an unverified token is
 * attacker-supplied JSON, and its `sub` is what we are about to trust as an
 * identity.
 */
export async function verifySessionToken(env: SsoEnv, token: string): Promise<SessionClaims | null> {
	const parts = token.split(".");
	if (parts.length !== 3) return null;

	const [headerB64, payloadB64, sigB64] = parts;

	let header: { alg?: string; kid?: string };
	try {
		header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerB64))) as {
			alg?: string;
			kid?: string;
		};
	} catch {
		return null;
	}
	// Pinned, not read: accepting whatever `alg` the token asks for is how
	// "alg: none" became a category of vulnerability.
	if (header.alg !== "RS256") return null;

	let keys: Jwk[];
	try {
		keys = await fetchJwks(env);
	} catch {
		return null;
	}
	// Match on kid when present; fall back to the sole key when the set has one.
	const jwk = header.kid ? keys.find((k) => k.kid === header.kid) : keys[0];
	if (!jwk) return null;

	const key = await crypto.subtle.importKey(
		"jwk",
		{ kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true, key_ops: ["verify"] } as JsonWebKey,
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["verify"],
	);

	const valid = await crypto.subtle.verify(
		"RSASSA-PKCS1-v1_5",
		key,
		base64UrlDecode(sigB64).buffer as ArrayBuffer,
		new TextEncoder().encode(`${headerB64}.${payloadB64}`),
	);
	if (!valid) return null;

	try {
		const claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64))) as SessionClaims;
		if (claims.token_use !== "session") return null;
		if (claims.iss !== ondeskIssuer(env)) return null;
		if (claims.exp < Math.floor(Date.now() / 1000)) return null;
		return claims;
	} catch {
		return null;
	}
}

// ─── Inbound webhook verification ─────────────────────────────────────────────

/**
 * Verifies a mirror-sync webhook from ondesk. The timestamp is inside the signed
 * body, so rejecting old ones bounds how long a captured request stays useful.
 */
export async function verifyPlatformWebhook(
	env: SsoEnv,
	body: string,
	signature: string | null,
): Promise<boolean> {
	if (!signature || !env.ONDESK_WEBHOOK_SECRET) return false;

	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(env.ONDESK_WEBHOOK_SECRET),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const expected = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
	const expectedHex = Array.from(new Uint8Array(expected))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");

	if (expectedHex.length !== signature.length) return false;
	let diff = 0;
	for (let i = 0; i < expectedHex.length; i++) diff |= expectedHex.charCodeAt(i) ^ signature.charCodeAt(i);
	return diff === 0;
}

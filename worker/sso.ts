/**
 * Platform token verification for the OnDesk control plane.
 *
 * A product Worker authenticates nobody and issues no cookies of its own. The
 * session is a single RS256 token minted by ondesk and carried in an
 * `access_token` cookie on `Domain=.ondesk.cc`, so the browser presents it here
 * exactly as it presents it to ondesk — signing in once is signing in
 * everywhere. This file verifies that token against ondesk's published JWKS;
 * a product holds public keys and never anything that could mint one.
 *
 * The ONE implementation every product uses — halo, nexus, orbit, pulse, vault
 * and atlas import it from `@ondesk/shared/worker/sso`, so a fix to token
 * verification lands everywhere at once. ondesk itself never imports it: it is
 * the issuer, and verifying is not the issuer's problem.
 *
 * ── Two kinds of token, one key ──────────────────────────────────────────────
 *
 * Session tokens, ID tokens and OIDC access tokens are all RS256 signed with the
 * same RSA key, so a signature check alone tells you nothing about what you are
 * holding. Each verifier here pins the discriminator that makes its kind
 * unmistakable — `token_use: "session"` for a session, `client_id` + `scope` for
 * an access token — and refuses anything that does not carry it. An ID token
 * presented as a bearer token has neither and fails both.
 *
 * See ondesk/docs/platform-architecture.md and ondesk/docs/developer-platform.md.
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
 * Everything true of any token ondesk signs: RS256, a key from the live JWKS,
 * our issuer, and not expired.
 *
 * Deliberately not exported. What it returns is a verified *envelope* and
 * nothing more — it has not decided what kind of token this is, and a caller
 * holding its result would be one `sub` away from treating an ID token as a
 * session. The two exported verifiers below each pin their own discriminator on
 * top of it; go through one of them.
 */
async function verifyEnvelope(env: SsoEnv, token: string): Promise<Record<string, unknown> | null> {
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
		const claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64))) as Record<string, unknown>;
		if (claims.iss !== ondeskIssuer(env)) return null;
		if (typeof claims.exp !== "number" || claims.exp < Math.floor(Date.now() / 1000)) return null;
		if (typeof claims.sub !== "string" || claims.sub.length === 0) return null;
		return claims;
	} catch {
		return null;
	}
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
	const claims = await verifyEnvelope(env, token);
	if (!claims) return null;
	if (claims.token_use !== "session") return null;
	return claims as unknown as SessionClaims;
}

// ─── OIDC access token verification ───────────────────────────────────────────

/**
 * An OIDC access token, as ondesk's token endpoint signs it.
 *
 * This is the Developer Platform's bearer token: a third party holds it on
 * behalf of a person, and it says three things — who the person is (`sub`),
 * which application is asking (`client_id`), and what that application was
 * allowed to ask for (`scope`).
 *
 * What it does NOT say is what the person may do. That is the whole point of
 * the model and the mistake the contract exists to prevent: a scope is a
 * ceiling on what the application may relay, never a statement about the
 * person's own access. See `createApiMiddleware` in `worker/api.ts`.
 */
export interface AccessTokenClaims {
	iss: string;
	/** The OnDesk user this token acts for. */
	sub: string;
	aud: string | string[];
	/** The registered application presenting it. */
	client_id: string;
	/** Space-delimited, RFC 6749 §3.3. Use `parseScopes` rather than substring matching. */
	scope: string;
	/**
	 * Web origins this application registered, derived from its redirect URIs.
	 *
	 * Present so a product can answer a browser client's CORS without knowing
	 * anything about `oauth_clients`, which live in ondesk's database and are no
	 * business of a product's. Absent on an older token, which simply means no
	 * origin is reflected.
	 */
	origins?: string[];
	iat: number;
	exp: number;
}

/**
 * Verifies a bearer token from a Developer Platform application.
 *
 * `client_id` and `scope` are what make this an access token rather than one of
 * the other two things signed with the same key. A session token carries
 * `token_use: "session"` and neither of them; an ID token carries neither and is
 * audienced to the client. Requiring both here is what the platform doc means by
 * "do not trust `token_use`" — the presence of the claims an access token cannot
 * do without is a stronger test than the absence of a label.
 *
 * The audience is deliberately not pinned. One token is meant to reach every
 * product it holds scopes for, exactly as it reaches `/userinfo`; what stops it
 * being useful anywhere is the scope check, not an audience string.
 */
export async function verifyAccessToken(env: SsoEnv, token: string): Promise<AccessTokenClaims | null> {
	const claims = await verifyEnvelope(env, token);
	if (!claims) return null;

	if (typeof claims.client_id !== "string" || claims.client_id.length === 0) return null;
	if (typeof claims.scope !== "string") return null;
	// A session token would already have failed the two above; this refuses one
	// that ever gains them without anybody revisiting this file.
	if (claims.token_use !== undefined) return null;

	return claims as unknown as AccessTokenClaims;
}

/** Space-delimited, order-insensitive, duplicates collapsed — RFC 6749 §3.3. */
export function parseScopes(scope: string): string[] {
	return [...new Set(scope.split(/\s+/).filter(Boolean))];
}

/**
 * The bearer token on a request, or null.
 *
 * Only the `Authorization` header. A token in a query string ends up in access
 * logs, browser history and `Referer`, and offering the option is how it gets
 * used.
 */
export function bearerToken(request: Request): string | null {
	const header = request.headers.get("Authorization");
	if (!header || !header.startsWith("Bearer ")) return null;
	const token = header.slice(7).trim();
	return token.length > 0 ? token : null;
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

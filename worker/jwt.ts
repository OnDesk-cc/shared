/**
 * HS256 signing and audienced verification, on Web Crypto.
 *
 * This is NOT session verification — the platform session is RS256, minted by
 * ondesk and checked in `worker/sso.ts`. What lives here is the short-lived
 * tokens a product signs for itself with its own secret: Halo's room tickets
 * and guest door passes, Nexus's stream tickets. They all carry an `aud` claim,
 * and the audience is what keeps two tokens signed with the same key from being
 * interchangeable.
 *
 * The verifying side of a ticket often lives in a companion Worker
 * (halo-realtime, nexus-realtime) with its own copy — when a claim shape moves,
 * grep the audience string across the pair.
 */

// ─── base64url ────────────────────────────────────────────────────────────────

export function base64UrlEncode(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function base64UrlDecode(str: string): Uint8Array {
	const padded = str.replace(/-/g, "+").replace(/_/g, "/");
	const binary = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), "="));
	return new Uint8Array(Array.from(binary, (c) => c.charCodeAt(0)));
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
	const enc = new TextEncoder();
	return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
		"sign",
		"verify",
	]);
}

// ─── JWT (HS256 using Web Crypto HMAC-SHA256) ─────────────────────────────────

/**
 * Generic in the payload because different products sign different things with
 * it. What keeps the tokens from being interchangeable is the `aud` claim each
 * one carries and `verifyAudiencedJwt` pins.
 */
export async function signJwt<T extends Record<string, unknown>>(
	payload: T,
	secret: string,
	expiresInSeconds: number,
): Promise<string> {
	const header = { alg: "HS256", typ: "JWT" };
	const enc = new TextEncoder();

	const now = Math.floor(Date.now() / 1000);
	const fullPayload = { ...payload, iat: now, exp: now + expiresInSeconds };

	const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)).buffer as ArrayBuffer);
	const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(fullPayload)).buffer as ArrayBuffer);
	const signingInput = `${headerB64}.${payloadB64}`;

	const key = await importHmacKey(secret);
	const signature = await crypto.subtle.sign("HMAC", key, enc.encode(signingInput));

	return `${signingInput}.${base64UrlEncode(signature)}`;
}

/**
 * Verifies a token that MUST carry one specific audience.
 *
 * A guest's door pass (`aud: "guest"`) is signed with the same key as a room
 * ticket, and the audience is the only thing that stops one being read as the
 * other. Pinned `alg`, signature, expiry, and the audience — null on any
 * failure and no word about which: a verifier that explains is an oracle.
 */
export async function verifyAudiencedJwt<T extends { aud: string; exp: number }>(
	token: string,
	secret: string,
	audience: T["aud"],
): Promise<T | null> {
	const parts = token.split(".");
	if (parts.length !== 3) return null;

	const [headerB64, payloadB64, sigB64] = parts;
	const enc = new TextEncoder();

	let header: { alg?: string };
	try {
		header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerB64))) as { alg?: string };
	} catch {
		return null;
	}
	if (header.alg !== "HS256") return null;

	const key = await importHmacKey(secret);
	const valid = await crypto.subtle.verify(
		"HMAC",
		key,
		base64UrlDecode(sigB64).buffer as ArrayBuffer,
		enc.encode(`${headerB64}.${payloadB64}`),
	);
	if (!valid) return null;

	let payload: T;
	try {
		payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64))) as T;
	} catch {
		return null;
	}

	if (payload.aud !== audience) return null;
	if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;

	return payload;
}

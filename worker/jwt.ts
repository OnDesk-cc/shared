/**
 * Firma HS256 y verificación con audiencia, sobre Web Crypto.
 *
 * Esto NO es verificación de sesión — la sesión de la plataforma es RS256, la
 * emite ondesk y se comprueba en `worker/sso.ts`. Lo que vive aquí son los
 * tokens de vida corta que un producto firma para sí mismo con su propio
 * secreto: los tickets de sala y los pases de puerta de invitado de Halo, los
 * tickets de stream de Nexus. Todos llevan un claim `aud`, y la audiencia es lo
 * que impide que dos tokens firmados con la misma clave sean intercambiables.
 *
 * La parte que verifica un ticket suele vivir en un Worker compañero
 * (halo-realtime, nexus-realtime) con su propia copia — cuando cambie la forma
 * de un claim, busca la cadena de audiencia en los dos.
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

// ─── JWT (HS256 con HMAC-SHA256 de Web Crypto) ────────────────────────────────

/**
 * Genérico en el payload porque distintos productos firman cosas distintas con
 * él. Lo que impide que los tokens sean intercambiables es el claim `aud` que
 * lleva cada uno y que `verifyAudiencedJwt` fija.
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
 * Verifica un token que TIENE que llevar una audiencia concreta.
 *
 * El pase de puerta de un invitado (`aud: "guest"`) se firma con la misma clave
 * que un ticket de sala, y la audiencia es lo único que impide leer uno como el
 * otro. `alg` fijado, firma, caducidad y la audiencia — null ante cualquier
 * fallo y ni una palabra sobre cuál: un verificador que se explica es un oráculo.
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

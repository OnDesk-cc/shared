/**
 * Verificación RS256 contra un JWKS remoto, con caché por URL en el isolate
 * (2026-10-07, Nova central).
 *
 * La usan los productos para verificar el token por llamada de Nova
 * (`worker/nova-tools.ts`). La sesión de ondesk tiene su propia copia privada en
 * `worker/sso.ts`. No se unificaron a propósito en esta entrega: `sso.ts` es el
 * camino de autenticación de los seis productos y no se toca de paso. Si
 * cambias una, mira la otra.
 *
 * Sólo comprueba `alg`, firma y `exp`. `iss`, `aud` y el resto son del llamador.
 * Un `kid` desconocido fuerza UN refresco del JWKS, como mucho uno por minuto,
 * para que una rotación de clave no deje fuera a nadie y una ristra de tokens
 * basura no se convierta en una ristra de peticiones.
 */
import { base64UrlDecode } from "./jwt";

interface Jwk {
	kty: string;
	kid?: string;
	n: string;
	e: string;
}

const TTL_SECONDS = 60 * 60;
const FORCED_REFRESH_GAP_SECONDS = 60;
const cache = new Map<string, { keys: Jwk[]; fetchedAt: number; forcedAt: number }>();

async function loadKeys(jwksUrl: string, force: boolean): Promise<Jwk[] | null> {
	const now = Math.floor(Date.now() / 1000);
	const hit = cache.get(jwksUrl);
	if (hit && !force && now - hit.fetchedAt < TTL_SECONDS) return hit.keys;
	if (hit && force && now - hit.forcedAt < FORCED_REFRESH_GAP_SECONDS) return hit.keys;
	try {
		const res = await fetch(jwksUrl);
		if (!res.ok) return hit?.keys ?? null;
		const body = (await res.json()) as { keys?: unknown };
		if (!Array.isArray(body.keys)) return hit?.keys ?? null;
		cache.set(jwksUrl, { keys: body.keys as Jwk[], fetchedAt: now, forcedAt: force ? now : (hit?.forcedAt ?? 0) });
		return body.keys as Jwk[];
	} catch {
		return hit?.keys ?? null;
	}
}

function decodeJson<T>(part: string): T | null {
	try {
		return JSON.parse(new TextDecoder().decode(base64UrlDecode(part))) as T;
	} catch {
		return null;
	}
}

export async function verifyRs256<T extends Record<string, unknown>>(token: string, jwksUrl: string): Promise<T | null> {
	const parts = token.split(".");
	if (parts.length !== 3) return null;
	const header = decodeJson<{ alg?: string; kid?: string }>(parts[0]);
	const payload = decodeJson<T>(parts[1]);
	if (!header || !payload || header.alg !== "RS256") return null;

	let keys = await loadKeys(jwksUrl, false);
	let jwk = keys?.find((k) => k.kid === header.kid) ?? (header.kid ? undefined : keys?.[0]);
	if (!jwk && header.kid) {
		keys = await loadKeys(jwksUrl, true);
		jwk = keys?.find((k) => k.kid === header.kid);
	}
	if (!jwk || jwk.kty !== "RSA") return null;

	let signature: Uint8Array;
	try {
		signature = base64UrlDecode(parts[2]);
	} catch {
		return null;
	}
	try {
		const key = await crypto.subtle.importKey(
			"jwk",
			{ kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
			{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
			false,
			["verify"],
		);
		const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
		if (!ok) return null;
	} catch {
		return null;
	}

	const exp = payload.exp;
	if (typeof exp !== "number" || exp <= Math.floor(Date.now() / 1000)) return null;
	return payload;
}

/**
 * Verificación de los tokens de plataforma del control plane de OnDesk.
 *
 * Un Worker de producto no autentica a nadie ni emite cookies propias. La sesión
 * es un único token RS256 que emite ondesk y que viaja en una cookie
 * `access_token` sobre `Domain=.ondesk.cc`, así que el navegador lo presenta aquí
 * exactamente igual que se lo presenta a ondesk — entrar una vez es entrar en
 * todas partes. Este archivo verifica ese token contra el JWKS publicado por
 * ondesk; un producto guarda claves públicas y nunca nada que pueda emitir uno.
 *
 * La ÚNICA implementación que usa cada producto — halo, nexus, orbit, pulse,
 * vault y atlas la importan de `@ondesk/shared/worker/sso`, así que un arreglo en
 * la verificación de tokens llega a todas partes a la vez. ondesk nunca la
 * importa: es el emisor, y verificar no es problema del emisor.
 *
 * ── Dos clases de token, una sola clave ──────────────────────────────────────
 *
 * Los tokens de sesión, los ID tokens y los access tokens de OIDC van todos
 * firmados en RS256 con la misma clave RSA, así que comprobar la firma por sí
 * solo no te dice nada de lo que tienes en la mano. Cada verificador de aquí fija
 * el discriminador que hace inconfundible su clase — `token_use: "session"` para
 * una sesión, `client_id` + `scope` para un access token — y rechaza todo lo que
 * no lo lleve. Un ID token presentado como bearer token no tiene ninguno de los
 * dos y falla en ambos.
 *
 * Ver ondesk/docs/platform-architecture.md y ondesk/docs/developer-platform.md.
 * ▸ Hoy: esos dos archivos ya no existen; los documentos son
 * ondesk/docs/arquitectura-plataforma.md y
 * ondesk/docs/plataforma-desarrolladores.md.
 */

/**
 * Lo que la verificación necesita de los bindings de quien la consume,
 * estructuralmente — el `Env` de cada app lo cumple sin saber nada de este tipo.
 */
export interface SsoEnv {
	/** Origen del control plane. Por defecto, https://ondesk.cc. */
	ONDESK_ISSUER?: string;
	/** Secreto HMAC para los webhooks de sincronización del espejo. Si falta, los webhooks se rechazan. */
	ONDESK_WEBHOOK_SECRET?: string;
}

/**
 * La sesión de la plataforma, tal como la firma ondesk.
 *
 * `token_use` es el discriminador: los ID tokens y los access tokens de OIDC se
 * firman con la misma clave RSA, y sin él cualquiera de ellos se verificaría como
 * una sesión. `role` es el rol de cuenta a nivel de plataforma — lo que esta
 * persona puede hacer en un workspace concreto sale de la membresía espejada, no
 * de aquí.
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

// ─── Verificación del token de sesión ─────────────────────────────────────────

// Se cachea entre peticiones en un isolate caliente. El TTL acota cuánto tiempo
// sigue siendo de confianza aquí una clave ya rotada.
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
 * Todo lo que es cierto de cualquier token que firma ondesk: RS256, una clave del
 * JWKS vigente, nuestro emisor, y sin caducar.
 *
 * No se exporta, a propósito. Lo que devuelve es un *sobre* verificado y nada más
 * — no ha decidido qué clase de token es, y a quien tuviera su resultado le
 * faltaría un `sub` para tratar un ID token como una sesión. Los dos verificadores
 * exportados de abajo fijan cada uno su propio discriminador encima de esto; pasa
 * por uno de ellos.
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
	// Fijado, no leído: aceptar el `alg` que pida el token es como «alg: none»
	// llegó a ser una categoría de vulnerabilidad.
	if (header.alg !== "RS256") return null;

	let keys: Jwk[];
	try {
		keys = await fetchJwks(env);
	} catch {
		return null;
	}
	// Buscar por kid cuando lo hay; si no, caer a la única clave cuando el conjunto
	// sólo tiene una.
	// ▸ Hoy: sin kid se coge `keys[0]`, tenga el conjunto las claves que tenga.
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
 * Verificación completa: firma, emisor, caducidad y `token_use`. Devuelve null
 * ante cualquier fallo y nunca explica qué comprobación falló — quien llama
 * responde 401 en cualquier caso, y un verificador que las distingue es un
 * oráculo.
 *
 * Nunca decodifiques un token de sesión sin esto: un token sin verificar es JSON
 * que pone el atacante, y su `sub` es lo que estamos a punto de aceptar como
 * identidad.
 */
export async function verifySessionToken(env: SsoEnv, token: string): Promise<SessionClaims | null> {
	const claims = await verifyEnvelope(env, token);
	if (!claims) return null;
	if (claims.token_use !== "session") return null;
	return claims as unknown as SessionClaims;
}

// ─── Verificación del access token de OIDC ────────────────────────────────────

/**
 * Un access token de OIDC, tal como lo firma el endpoint de tokens de ondesk.
 *
 * Es el bearer token de la Developer Platform: un tercero lo tiene en nombre de
 * una persona, y dice tres cosas — quién es la persona (`sub`), qué aplicación
 * pregunta (`client_id`), y qué se le permitió pedir a esa aplicación (`scope`).
 *
 * Lo que NO dice es lo que la persona puede hacer. Ése es todo el sentido del
 * modelo y el error que el contrato existe para impedir: un scope es un techo
 * sobre lo que la aplicación puede transmitir, nunca una afirmación sobre el
 * acceso propio de la persona. Ver `createApiMiddleware` en `worker/api.ts`.
 */
export interface AccessTokenClaims {
	iss: string;
	/** El usuario de OnDesk en cuyo nombre actúa este token. */
	sub: string;
	aud: string | string[];
	/** La aplicación registrada que lo presenta. */
	client_id: string;
	/** Separados por espacios, RFC 6749 §3.3. Usa `parseScopes` en vez de comparar subcadenas. */
	scope: string;
	/**
	 * Los orígenes web que registró esta aplicación, derivados de sus redirect
	 * URIs.
	 *
	 * Está para que un producto pueda responder al CORS de un cliente de navegador
	 * sin saber nada de `oauth_clients`, que viven en la base de datos de ondesk y
	 * no son asunto de ningún producto. Falta en un token antiguo, lo que
	 * simplemente significa que no se refleja ningún origen.
	 */
	origins?: string[];
	iat: number;
	exp: number;
}

/**
 * Verifica un bearer token de una aplicación de la Developer Platform.
 *
 * `client_id` y `scope` son lo que hace de esto un access token y no una de las
 * otras dos cosas firmadas con la misma clave. Un token de sesión lleva
 * `token_use: "session"` y ninguno de los dos; un ID token no lleva ninguno y su
 * audiencia es el cliente. Exigir los dos aquí es lo que el documento de la
 * plataforma quiere decir con «no te fíes de `token_use`» — la presencia de los
 * claims sin los que un access token no puede vivir es una prueba más fuerte que
 * la ausencia de una etiqueta.
 *
 * La audiencia no se fija, a propósito. Un token está pensado para llegar a cada
 * producto para el que tiene scopes, exactamente igual que llega a `/userinfo`;
 * lo que impide que sirva en cualquier sitio es la comprobación del scope, no una
 * cadena de audiencia.
 */
export async function verifyAccessToken(env: SsoEnv, token: string): Promise<AccessTokenClaims | null> {
	const claims = await verifyEnvelope(env, token);
	if (!claims) return null;

	if (typeof claims.client_id !== "string" || claims.client_id.length === 0) return null;
	if (typeof claims.scope !== "string") return null;
	// Un token de sesión ya habría fallado en las dos de arriba; esto rechaza uno
	// que algún día las gane sin que nadie vuelva a mirar este archivo.
	if (claims.token_use !== undefined) return null;

	return claims as unknown as AccessTokenClaims;
}

/** Separados por espacios, sin importar el orden, con los duplicados colapsados — RFC 6749 §3.3. */
export function parseScopes(scope: string): string[] {
	return [...new Set(scope.split(/\s+/).filter(Boolean))];
}

/**
 * El bearer token de una petición, o null.
 *
 * Sólo la cabecera `Authorization`. Un token en una query string acaba en los
 * logs de acceso, en el historial del navegador y en `Referer`, y ofrecer la
 * opción es la manera de que alguien la use.
 */
export function bearerToken(request: Request): string | null {
	const header = request.headers.get("Authorization");
	if (!header || !header.startsWith("Bearer ")) return null;
	const token = header.slice(7).trim();
	return token.length > 0 ? token : null;
}

// ─── Verificación del webhook entrante ────────────────────────────────────────

/**
 * Verifica un webhook de sincronización del espejo que llega de ondesk. La marca
 * de tiempo va dentro del cuerpo firmado, así que rechazar los antiguos acota
 * cuánto tiempo le sirve a alguien una petición capturada.
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

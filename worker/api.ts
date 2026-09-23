import type { PagesFunction, D1Database } from "@cloudflare/workers-types";
import { verifyAccessToken, parseScopes, bearerToken, type AccessTokenClaims, type SsoEnv } from "./sso";

/**
 * El lado de la Developer Platform en un producto: rutas a las que llama una
 * aplicación de terceros con un bearer token, en nombre de una persona.
 *
 * Es la pareja de `worker/middleware.ts`, y la diferencia entre los dos es justo
 * lo que importa. Aquel autentica a una *persona* sentada delante de un
 * producto, por la cookie de sesión de `.ondesk.cc`. Este autentica a una
 * *aplicación que actúa por* una persona, por un access token de OIDC — y a una
 * aplicación nunca se le confía lo que la persona podría hacer, sólo lo que la
 * persona le permitió transmitir.
 *
 * ── La regla, y el paso que es fatal saltarse ────────────────────────────────
 *
 * El acceso es la intersección de tres hechos independientes:
 *
 *   1. lo que el workspace concedió a la aplicación   → oauth_clients.scopes
 *   2. lo que la persona consintió                    → oauth_consents.scope
 *   3. lo que la persona puede hacer de verdad aquí   → ESTE PRODUCTO
 *
 * ondesk aplica 1 y 2 antes de firmar ningún token. Nadie más que el servicio que
 * guarda los datos puede aplicar el 3, y por eso no se puede añadir después con
 * un parche y por eso es el que las implementaciones olvidan. Un token que dice
 * `pulse:tickets.view` significa «esta app puede leer los tickets que su usuario
 * podría haber leído de todas formas» — nunca «esta app puede leer tickets».
 *
 * `withScope` hace el 3 por ti en el único caso en que es un permiso de rol.
 * Cuando la visibilidad de un producto sale en cambio de un modelo de acceso por
 * recurso — una concesión de colección de Vault, la membresía de un canal de
 * Nexus, la lista de participantes de Halo, un espacio de Atlas — ningún permiso
 * la nombra, `permission` se omite, y **el handler pasa a ser responsable de
 * resolver qué puede ver este usuario**. No hay forma de escribir eso de manera
 * genérica, así que en cada una de esas rutas hay un comentario que dice qué
 * resuelve y dónde.
 *
 * Ver ondesk/docs/developer-platform.md.
 * ▸ Hoy: ese archivo ya no existe; el documento es
 * ondesk/docs/plataforma-desarrolladores.md.
 */

export interface ApiEnv extends SsoEnv {
	DB: D1Database;
}

export interface ApiContext<E extends ApiEnv, P extends string = string> {
	request: Request;
	env: E;
	params: Record<P, string>;
	/** Mantiene vivo el Worker para efectos secundarios (escrituras de auditoría) después de enviar la respuesta. */
	waitUntil: (promise: Promise<unknown>) => void;
	/** El token verificado, para el raro handler que necesite los claims en bruto. */
	token: AccessTokenClaims;
	/**
	 * El usuario de OnDesk en cuyo nombre actúa esta petición.
	 *
	 * La única identidad de la petición. `client_id` dice qué aplicación pregunta;
	 * nunca es un principal, y nada puede serle visible que no le sea visible a
	 * este usuario.
	 */
	userId: string;
	/** La aplicación que presenta el token, para las líneas de auditoría. */
	clientId: string;
	/** El workspace de `?workspace_id=`, con la membresía y el derecho ya comprobados. */
	workspaceId: string;
	/** El rol de plataforma de quien llama en ese workspace: owner | admin | member. */
	workspaceRole: string;
	/** Todos los scopes del token, bien parseados — nunca comparados por subcadena. */
	scopes: string[];
}

export interface ScopedRoute<Perm extends string> {
	/**
	 * La clave de permiso pelada que necesita este endpoint, a la que se antepone
	 * el app id del producto para formar el scope: `"tickets.view"` →
	 * `pulse:tickets.view`.
	 */
	scope: string;
	/**
	 * El permiso de rol que quien llama TAMBIÉN tiene que tener, cuando el scope
	 * nombra uno.
	 *
	 * Omítelo sólo donde el producto decide la visibilidad por recurso y no por
	 * rol, y entonces resuélvela en el handler. Omitirlo porque una ruta «parece
	 * abierta» es como una aplicación acaba leyendo lo que su usuario no podía.
	 */
	permission?: Perm;
}

export type ApiMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface ApiMiddleware<E extends ApiEnv, Perm extends string> {
	/** Todos los métodos de esta ruta necesitan el mismo scope. */
	withScope<P extends string = string>(
		route: ScopedRoute<Perm>,
		handler: (ctx: ApiContext<E, P>) => Promise<Response>,
	): PagesFunction<E, P>;
	/**
	 * Un scope por método, para el caso habitual en que una misma URL lista y
	 * crea.
	 *
	 * Existe porque la alternativa obvia es una trampa: dale al archivo el scope
	 * de lectura, comprueba luego el permiso de escritura dentro de la rama del
	 * POST, y una aplicación a la que sólo se concedió `tickets.view` puede crear
	 * un ticket en cuanto su usuario resulte tener `tickets.create`. Eso son los
	 * hechos 1 y 2 del modelo deshechos por un método HTTP. Resolver el scope a
	 * partir del método ANTES de que corra ninguna comprobación es la única forma
	 * en la que eso no se puede escribir por accidente.
	 *
	 * Un método sin entrada es un 405 con la cabecera `Allow`, antes siquiera de
	 * mirar el token.
	 */
	withScopes<P extends string = string>(
		routes: Partial<Record<ApiMethod, ScopedRoute<Perm>>>,
		handler: (ctx: ApiContext<E, P>) => Promise<Response>,
	): PagesFunction<E, P>;
}

// ─── CORS ─────────────────────────────────────────────────────────────────────

const ALLOWED_METHODS = "GET, POST, PATCH, PUT, DELETE, OPTIONS";
const ALLOWED_HEADERS = "Authorization, Content-Type";

/**
 * Lo que se le dice a un navegador sobre esta API.
 *
 * **No hay `Access-Control-Allow-Credentials`, a propósito.** Esa cabecera es lo
 * que hace peligroso un origen reflejado: con ella, cualquier página podría hacer
 * que el navegador adjuntara la cookie de `.ondesk.cc` de una víctima y leer la
 * respuesta. Sin ella el navegador no envía ninguna cookie, así que la única
 * forma de llegar a algo de aquí es tener un token — y un token es algo que la
 * persona concedió a una aplicación con nombre, no algo que una página pueda
 * conseguir porque alguien la visite.
 *
 * La lista de orígenes permitidos de abajo es, por tanto, defensa en profundidad
 * y no la frontera. Merece la pena tenerla igualmente: significa que un token
 * filtrado de una aplicación no se puede gastar desde la página de otro, y cuesta
 * una comparación de cadenas contra un claim que ya está en el token.
 */
function corsHeaders(origin: string | null, allowed: boolean): Record<string, string> {
	if (!origin || !allowed) return { Vary: "Origin" };
	return {
		"Access-Control-Allow-Origin": origin,
		"Access-Control-Expose-Headers": "X-RateLimit-Remaining",
		Vary: "Origin",
	};
}

/**
 * El preflight, que llega sin token.
 *
 * `OPTIONS` lleva `Origin` y nada más — ninguna cabecera `Authorization`, así que
 * no hay `client_id` con el que buscar una lista de permitidos. Por eso responde
 * para cualquier origen, y es la petición que viene después donde muerde la
 * lista: a una página de un origen no registrado se le deja *enviar* la llamada y
 * no puede leer ni una palabra de la respuesta. Con eso no se revela nada, porque
 * el cuerpo del propio preflight está vacío.
 */
function preflight(request: Request): Response {
	const origin = request.headers.get("Origin");
	const headers: Record<string, string> = {
		"Access-Control-Allow-Methods": ALLOWED_METHODS,
		"Access-Control-Allow-Headers": ALLOWED_HEADERS,
		"Access-Control-Max-Age": "600",
		Vary: "Origin",
	};
	if (origin) headers["Access-Control-Allow-Origin"] = origin;
	return new Response(null, { status: 204, headers });
}

function withHeaders(response: Response, extra: Record<string, string>): Response {
	const merged = new Response(response.body, response);
	for (const [key, value] of Object.entries(extra)) merged.headers.set(key, value);
	return merged;
}

// ─── Errores ──────────────────────────────────────────────────────────────────

/**
 * Errores de la RFC 6750 §3, que una librería de cliente OAuth ya sabe leer.
 *
 * `invalid_token` en un 401 es lo que le dice a un cliente que refresque y
 * reintente; `insufficient_scope` en un 403 nombra el scope que faltaba, para que
 * un desarrollador sepa qué añadir a su petición de autorización en vez de
 * adivinarlo.
 */
function bearerError(
	status: number,
	code: string,
	description: string,
	extra: Record<string, string> = {},
): Response {
	const parts = [`error="${code}"`, `error_description="${description}"`];
	for (const [key, value] of Object.entries(extra)) parts.push(`${key}="${value}"`);

	return new Response(JSON.stringify({ error: code, error_description: description }), {
		status,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "no-store",
			"WWW-Authenticate": `Bearer ${parts.join(", ")}`,
		},
	});
}

function apiError(status: number, code: string, description: string): Response {
	return new Response(JSON.stringify({ error: code, error_description: description }), {
		status,
		headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
	});
}

// ─── El sobre con el que responde cada producto ───────────────────────────────

/**
 * Una sola forma en los seis productos, porque un desarrollador que integre dos
 * de ellos no debería tener que aprender dos esquemas de paginación.
 *
 * `data` siempre, para que una colección y un recurso suelto se distingan por lo
 * que hay dentro y no porque quien llama lo adivine. En un recurso suelto el
 * bloque de página no aparece, en vez de venir relleno de unos.
 */
export interface PageParams {
	page: number;
	pageSize: number;
	offset: number;
}

/** `?page=` y `?page_size=`, acotados. Lo que no se pueda parsear cae al valor por defecto en vez de dar error. */
export function pageParams(url: URL, options: { pageSize?: number; maxPageSize?: number } = {}): PageParams {
	const fallback = options.pageSize ?? 25;
	const max = options.maxPageSize ?? 100;

	const rawPage = Number.parseInt(url.searchParams.get("page") ?? "", 10);
	const rawSize = Number.parseInt(url.searchParams.get("page_size") ?? "", 10);

	const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
	const pageSize = Number.isFinite(rawSize) ? Math.min(Math.max(rawSize, 1), max) : fallback;

	return { page, pageSize, offset: (page - 1) * pageSize };
}

export function apiList<T>(items: T[], page: PageParams, total: number): Response {
	return new Response(
		JSON.stringify({
			data: items,
			page: {
				page: page.page,
				page_size: page.pageSize,
				total,
				has_more: page.offset + items.length < total,
			},
		}),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
}

/**
 * La variante con cursor, para un registro y no para una tabla.
 *
 * Paginar por offset está mal para cualquier cosa que gane filas por arriba
 * mientras alguien la está leyendo — la transcripción de un chat, un flujo de
 * eventos — porque la página 2 se ha movido para cuando se pide y un mensaje se
 * muestra dos veces o se salta. Esas colecciones paginan en cambio sobre su
 * propia secuencia, y lo dicen respondiendo `next_cursor` donde las demás
 * responden `page`.
 */
export function apiCursorList<T>(
	items: T[],
	meta: { hasMore: boolean; nextCursor?: string | number | null },
): Response {
	return new Response(
		JSON.stringify({
			data: items,
			page: {
				has_more: meta.hasMore,
				next_cursor: meta.nextCursor ?? null,
			},
		}),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
}

export function apiOne<T>(item: T, status = 200): Response {
	return new Response(JSON.stringify({ data: item }), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

/** 404 para un recurso que quien llama no puede ver, igual que para uno que no existe — ver la nota sobre la membresía. */
export function apiNotFound(what: string): Response {
	return apiError(404, "not_found", `No such ${what}, or it is not visible to this user.`);
}

export function apiInvalid(description: string): Response {
	return apiError(400, "invalid_request", description);
}

export function apiForbidden(description: string): Response {
	return apiError(403, "forbidden", description);
}

// Aquí no hay, a propósito, ningún helper de enrutado por método. `withScopes` ya
// responde 405 con la cabecera `Allow`, a partir del mismo mapa que decide el
// scope, y una segunda forma de enrutar métodos es un segundo sitio en el que los
// dos pueden no estar de acuerdo — lo que en este archivo significa un método
// servido bajo el scope equivocado.

// ─── El middleware ────────────────────────────────────────────────────────────

export function createApiMiddleware<E extends ApiEnv, Perm extends string>(product: {
	/** El id del producto en `apps`, y el prefijo de cada uno de sus scopes. */
	appId: string;
	/** El nombre del producto tal como lo dice el 402, p. ej. «Vault». */
	productName: string;
	/** El resolvedor propio del producto — `hasPermission` de su `_lib/db/roles.ts`. */
	hasPermission: (db: D1Database, workspaceId: string, userId: string, permission: Perm) => Promise<boolean>;
}): ApiMiddleware<E, Perm> {
	const { appId, productName, hasPermission } = product;

	function guard<P extends string = string>(
		resolve: (method: string) => ScopedRoute<Perm> | undefined,
		allow: string,
		handler: (ctx: ApiContext<E, P>) => Promise<Response>,
	): PagesFunction<E, P> {
		return async ({ request, env, params, waitUntil }) => {
			if (request.method === "OPTIONS") return preflight(request);

			const origin = request.headers.get("Origin");
			// Los fallos de abajo llevan una cadena de error y ningún dato, así que
			// reflejan el origen sin condiciones — si no, un cliente de navegador ve un
			// error de red opaco en vez del motivo por el que se le rechazó.
			const fail = (response: Response) => withHeaders(response, corsHeaders(origin, true));

			// Se resuelve primero, para que un método que esta ruta no sirve se rechace
			// antes de leer ningún token — y para que el scope que se va a exigir sea
			// el que corresponde a lo que de verdad se está haciendo.
			const route = resolve(request.method);
			if (!route) {
				return fail(
					new Response(JSON.stringify({ error: "method_not_allowed" }), {
						status: 405,
						headers: { "Content-Type": "application/json", Allow: allow },
					}),
				);
			}
			const required = `${appId}:${route.scope}`;

			const raw = bearerToken(request);
			if (!raw) {
				return fail(
					bearerError(401, "invalid_request", "An OnDesk access token is required in the Authorization header."),
				);
			}

			const token = await verifyAccessToken(env, raw);
			if (!token) {
				return fail(bearerError(401, "invalid_token", "The access token is expired or not valid."));
			}

			// Un token habla de una persona, no de un workspace. Sin esto, una
			// aplicación con el consentimiento de un workspace leería los datos de
			// otro, porque la persona por la que actúa bien puede pertenecer a los dos.
			const url = new URL(request.url);
			const workspaceId = url.searchParams.get("workspace_id");
			if (!workspaceId) {
				return fail(apiError(400, "invalid_request", "workspace_id is required."));
			}

			// Una sola consulta responde a la membresía y al derecho, exactamente como
			// el middleware de sesión se lo pregunta a una persona que ha entrado. Un
			// workspace caducado recibe un 402 y conserva sus datos.
			const row = await env.DB.prepare(
				`SELECT wm.role, we.status
				   FROM workspace_members wm
				   LEFT JOIN workspace_entitlements we ON we.workspace_id = wm.workspace_id
				  WHERE wm.workspace_id = ? AND wm.user_id = ?
				  LIMIT 1`,
			)
				.bind(workspaceId, token.sub)
				.first<{ role: string; status: string | null }>();

			// No ser miembro es 404, no 403: confirmarle que un id de workspace existe
			// a alguien que no puede verlo es un oráculo de enumeración, y aquí se
			// responde sobre el propio usuario del token.
			if (!row) {
				return fail(apiError(404, "not_found", "No such workspace, or this user is not a member of it."));
			}
			if (row.status === null || !["active", "trialing", "past_due"].includes(row.status)) {
				return fail(
					apiError(402, "payment_required", `This workspace does not have an active ${productName} subscription.`),
				);
			}

			const scopes = parseScopes(token.scope);
			if (!scopes.includes(required)) {
				return fail(
					bearerError(403, "insufficient_scope", `This endpoint requires the ${required} scope.`, {
						scope: required,
					}),
				);
			}

			// El hecho 3. El token dijo lo que la aplicación puede transmitir; esto
			// pregunta lo que la persona puede hacer, ahora, en este workspace — la
			// misma pregunta que la propia interfaz del producto hace sobre un miembro
			// que ha entrado, y hay que volver a hacerla por muy tajante que haya sido
			// ya la respuesta del token.
			if (route.permission && !(await hasPermission(env.DB, workspaceId, token.sub, route.permission))) {
				return fail(
					apiError(403, "forbidden", `This user's role in the workspace does not include ${route.permission}.`),
				);
			}

			const response = await handler({
				request,
				env,
				params: params as Record<P, string>,
				waitUntil,
				token,
				userId: token.sub,
				clientId: token.client_id,
				workspaceId,
				workspaceRole: row.role,
				scopes,
			});

			// Sólo aquí se aplica la lista de permitidos: esta respuesta lleva datos, y
			// los orígenes son los que la aplicación registró como destinos de
			// redirección.
			const allowed = Boolean(origin && (token.origins ?? []).includes(origin));
			return withHeaders(response, { ...corsHeaders(origin, allowed), "Cache-Control": "no-store" });
		};
	}

	function withScope<P extends string = string>(
		route: ScopedRoute<Perm>,
		handler: (ctx: ApiContext<E, P>) => Promise<Response>,
	): PagesFunction<E, P> {
		return guard<P>(() => route, ALLOWED_METHODS, handler);
	}

	function withScopes<P extends string = string>(
		routes: Partial<Record<ApiMethod, ScopedRoute<Perm>>>,
		handler: (ctx: ApiContext<E, P>) => Promise<Response>,
	): PagesFunction<E, P> {
		const allow = [...Object.keys(routes), "OPTIONS"].join(", ");
		return guard<P>((method) => routes[method as ApiMethod], allow, handler);
	}

	return { withScope, withScopes };
}

import type { PagesFunction, D1Database } from "@cloudflare/workers-types";
import { verifySessionToken, type SessionClaims, type SsoEnv } from "./sso";
import { parseCookieValues, ACCESS_TOKEN_COOKIE } from "./cookies";
import { jsonError } from "./response";

/**
 * El middleware de autenticación y de workspace con el que cada producto satélite
 * envuelve sus rutas.
 *
 * Una sola implementación, instanciada por producto: el
 * `functions/_lib/middleware.ts` de cada app llama a `createMiddleware` con su
 * propio Env, su propio catálogo de permisos y su nombre de producto, y
 * reexporta los cuatro envoltorios — así un archivo de ruta nunca sabe que este
 * paquete existe, y un arreglo en el camino de autenticación llega a todos los
 * productos a la vez.
 *
 * La sesión es la cookie compartida de `.ondesk.cc` que emite ondesk y que se
 * verifica contra su JWKS publicado (ver worker/sso.ts) — un producto no emite
 * ninguna sesión propia. La membresía, el derecho y el rol de plataforma salen de
 * las tablas espejadas `workspace_members` / `workspace_entitlements` que cada
 * producto mantiene mediante el webhook de la plataforma y el job de
 * reconciliación.
 */

/** Lo que el middleware necesita de los bindings de un producto, estructuralmente. */
export interface MiddlewareEnv extends SsoEnv {
	DB: D1Database;
}

export interface AuthContext<E extends MiddlewareEnv, P extends string = string> {
	request: Request;
	env: E;
	params: Record<P, string>;
	payload: SessionClaims;
	/** Mantiene vivo el Worker para efectos secundarios (escrituras de auditoría, emails) después de enviar la respuesta. */
	waitUntil: (promise: Promise<unknown>) => void;
}

export interface WorkspaceContext<E extends MiddlewareEnv, P extends string = string> extends AuthContext<E, P> {
	workspaceId: string;
	/** El rol de plataforma de quien llama en este workspace: owner | admin | member. */
	workspaceRole: string;
}

type AuthHandler<E extends MiddlewareEnv, P extends string> = (ctx: AuthContext<E, P>) => Promise<Response>;
type WorkspaceHandler<E extends MiddlewareEnv, P extends string> = (ctx: WorkspaceContext<E, P>) => Promise<Response>;

export interface Middleware<E extends MiddlewareEnv, Perm extends string> {
	/**
	 * Verifica la cookie de sesión compartida de la plataforma y le pasa el
	 * payload al handler. Se prueba cada valor candidato porque una cookie
	 * host-only rancia de la época de la sesión por producto puede tapar durante un
	 * tiempo a la compartida.
	 */
	withAuth<P extends string = string>(handler: AuthHandler<E, P>): PagesFunction<E, P>;
	/**
	 * La autenticación, y después que quien llama es miembro del `workspace_id` de
	 * la query string *y* que el workspace sigue teniendo un derecho vivo para
	 * este producto. Una sola consulta responde a las tres cosas; un workspace
	 * caducado recibe un 402 y conserva sus datos.
	 */
	withWorkspace<P extends string = string>(handler: WorkspaceHandler<E, P>): PagesFunction<E, P>;
	/**
	 * Membresía y derecho, más un permiso del rol de producto de quien llama —
	 * `workspace_members.permissions`, que ondesk resuelve a partir del rol del
	 * asiento y que se espeja aquí. Un miembro sin permisos resueltos cae al preset
	 * de su rol en el workspace, así que envolver una ruta con esto nunca deja a un
	 * dueño fuera de su propio workspace.
	 */
	withPermission<P extends string = string>(permission: Perm, handler: WorkspaceHandler<E, P>): PagesFunction<E, P>;
	/**
	 * Lo mismo, pero sólo para los métodos que cambian algo: las lecturas pasan
	 * sólo con la membresía, así que poner este guard a una ruta mixta GET/POST
	 * nunca le quita la lista a alguien que sólo podía leerla.
	 */
	withWritePermission<P extends string = string>(
		permission: Perm,
		handler: WorkspaceHandler<E, P>,
	): PagesFunction<E, P>;
}

export function createMiddleware<E extends MiddlewareEnv, Perm extends string>(product: {
	/** El nombre del producto tal como lo dice el 402, p. ej. «Vault». */
	productName: string;
	/** El resolvedor de permisos del producto — `hasPermission` de su `_lib/db/roles.ts`. */
	hasPermission: (db: D1Database, workspaceId: string, userId: string, permission: Perm) => Promise<boolean>;
}): Middleware<E, Perm> {
	const { productName, hasPermission } = product;

	function withAuth<P extends string = string>(handler: AuthHandler<E, P>): PagesFunction<E, P> {
		return async ({ request, env, params, waitUntil }) => {
			const candidates = parseCookieValues(request.headers.get("Cookie"), ACCESS_TOKEN_COOKIE);
			if (candidates.length === 0) return jsonError("Not authenticated", 401);

			for (const candidate of candidates) {
				const payload = await verifySessionToken(env, candidate);
				if (payload) {
					return handler({ request, env, params: params as Record<P, string>, payload, waitUntil });
				}
			}

			return jsonError("Invalid or expired token", 401);
		};
	}

	function withWorkspace<P extends string = string>(handler: WorkspaceHandler<E, P>): PagesFunction<E, P> {
		return withAuth<P>(async ({ request, env, params, payload, waitUntil }) => {
			const url = new URL(request.url);
			const workspaceId = url.searchParams.get("workspace_id");
			if (!workspaceId) return jsonError("workspace_id is required");

			const row = await env.DB.prepare(
				`SELECT wm.role, we.status
				   FROM workspace_members wm
				   LEFT JOIN workspace_entitlements we ON we.workspace_id = wm.workspace_id
				  WHERE wm.workspace_id = ? AND wm.user_id = ?
				  LIMIT 1`,
			)
				.bind(workspaceId, payload.sub)
				.first<{ role: string; status: string | null }>();

			if (!row) return jsonError("Forbidden", 403);
			if (row.status === null || !["active", "trialing", "past_due"].includes(row.status)) {
				return jsonError(`This workspace does not have an active ${productName} subscription`, 402);
			}

			return handler({ request, env, params, payload, waitUntil, workspaceId, workspaceRole: row.role });
		});
	}

	function withPermission<P extends string = string>(
		permission: Perm,
		handler: WorkspaceHandler<E, P>,
	): PagesFunction<E, P> {
		return withWorkspace<P>(async (ctx) => {
			if (!(await hasPermission(ctx.env.DB, ctx.workspaceId, ctx.payload.sub, permission))) {
				// Con nombre y no un 403 pelado: el cliente puede distinguir entre «no
				// es tu workspace» y «tu rol no incluye esto», y sólo lo segundo merece
				// explicárselo a la persona.
				return jsonError(`Your role doesn't include ${permission}`, 403);
			}
			return handler(ctx);
		});
	}

	function withWritePermission<P extends string = string>(
		permission: Perm,
		handler: WorkspaceHandler<E, P>,
	): PagesFunction<E, P> {
		return withWorkspace<P>(async (ctx) => {
			if (
				ctx.request.method !== "GET" &&
				!(await hasPermission(ctx.env.DB, ctx.workspaceId, ctx.payload.sub, permission))
			) {
				return jsonError(`Your role doesn't include ${permission}`, 403);
			}
			return handler(ctx);
		});
	}

	return { withAuth, withWorkspace, withPermission, withWritePermission };
}

import type { PagesFunction, D1Database } from "@cloudflare/workers-types";
import { verifySessionToken, type SessionClaims, type SsoEnv } from "./sso";
import { parseCookieValues, ACCESS_TOKEN_COOKIE } from "./cookies";
import { jsonError } from "./response";

/**
 * The auth/tenancy middleware every satellite product wraps its routes in.
 *
 * One implementation, instantiated per product: each app's
 * `functions/_lib/middleware.ts` calls `createMiddleware` with its own Env, its
 * own permission catalogue and its product name, and re-exports the four
 * wrappers — so a route file never knows this package exists, and a fix to the
 * auth path lands in every product at once.
 *
 * The session is the shared `.ondesk.cc` cookie minted by ondesk and verified
 * against its published JWKS (see worker/sso.ts) — a product issues no session
 * of its own. Membership, entitlement and the platform role come from the
 * mirrored `workspace_members` / `workspace_entitlements` tables every product
 * maintains via the platform webhook and the reconcile job.
 */

/** What the middleware needs from a product's bindings, structurally. */
export interface MiddlewareEnv extends SsoEnv {
	DB: D1Database;
}

export interface AuthContext<E extends MiddlewareEnv, P extends string = string> {
	request: Request;
	env: E;
	params: Record<P, string>;
	payload: SessionClaims;
	/** Keeps the Worker alive for side effects (audit writes, emails) after the response is sent. */
	waitUntil: (promise: Promise<unknown>) => void;
}

export interface WorkspaceContext<E extends MiddlewareEnv, P extends string = string> extends AuthContext<E, P> {
	workspaceId: string;
	/** The caller's platform role in this workspace: owner | admin | member. */
	workspaceRole: string;
}

type AuthHandler<E extends MiddlewareEnv, P extends string> = (ctx: AuthContext<E, P>) => Promise<Response>;
type WorkspaceHandler<E extends MiddlewareEnv, P extends string> = (ctx: WorkspaceContext<E, P>) => Promise<Response>;

export interface Middleware<E extends MiddlewareEnv, Perm extends string> {
	/**
	 * Verifies the shared platform session cookie and hands the payload to the
	 * handler. Every candidate value is tried because a stale host-only cookie
	 * from the per-product-session era can shadow the shared one for a while.
	 */
	withAuth<P extends string = string>(handler: AuthHandler<E, P>): PagesFunction<E, P>;
	/**
	 * Auth, then that the caller is a member of the `workspace_id` in the query
	 * string *and* that the workspace still holds a live entitlement for this
	 * product. One query answers all three; a lapsed tenant gets 402 and keeps
	 * its data.
	 */
	withWorkspace<P extends string = string>(handler: WorkspaceHandler<E, P>): PagesFunction<E, P>;
	/**
	 * Membership and entitlement, plus one permission from the caller's product
	 * role — `workspace_members.permissions`, resolved by ondesk from the seat's
	 * role and mirrored here. A member with no resolved permissions falls back
	 * to the preset for their tenancy role, so wrapping a route in this never
	 * locks an owner out of their own tenant.
	 */
	withPermission<P extends string = string>(permission: Perm, handler: WorkspaceHandler<E, P>): PagesFunction<E, P>;
	/**
	 * The same, but only for methods that change something: reads pass on
	 * membership alone, so gating a mixed GET/POST route never takes the list
	 * away from someone who could only ever read it.
	 */
	withWritePermission<P extends string = string>(
		permission: Perm,
		handler: WorkspaceHandler<E, P>,
	): PagesFunction<E, P>;
}

export function createMiddleware<E extends MiddlewareEnv, Perm extends string>(product: {
	/** Product name as the 402 says it, e.g. "Vault". */
	productName: string;
	/** The product's permission resolver — `hasPermission` from its `_lib/db/roles.ts`. */
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
				// Named rather than a bare 403: the client can tell the difference
				// between "not your workspace" and "your role doesn't include this",
				// and only the second is worth explaining to the person.
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

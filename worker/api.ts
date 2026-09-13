import type { PagesFunction, D1Database } from "@cloudflare/workers-types";
import { verifyAccessToken, parseScopes, bearerToken, type AccessTokenClaims, type SsoEnv } from "./sso";

/**
 * The Developer Platform's side of a product: routes a third-party application
 * calls with a bearer token, on behalf of a person.
 *
 * This is the companion to `worker/middleware.ts`, and the difference between
 * them is the whole point. That one authenticates a *person* sitting in front of
 * a product, by the `.ondesk.cc` session cookie. This one authenticates an
 * *application acting for* a person, by an OIDC access token — and an
 * application is never trusted with what the person could do, only with what the
 * person allowed it to relay.
 *
 * ── The rule, and the step that is fatal to skip ─────────────────────────────
 *
 * Access is the intersection of three independent facts:
 *
 *   1. what the workspace granted the application   → oauth_clients.scopes
 *   2. what the person consented to                 → oauth_consents.scope
 *   3. what the person may actually do here         → THIS PRODUCT
 *
 * ondesk enforces 1 and 2 before it ever signs a token. Nobody but the service
 * holding the data can enforce 3, which is why it cannot be bolted on later and
 * why it is the one implementations forget. A token saying `pulse:tickets.view`
 * means "this app may read the tickets its user could have read anyway" — never
 * "this app may read tickets".
 *
 * `withScope` does 3 for you in the one case where it is a role permission.
 * Where a product's visibility comes from a resource-level access model instead
 * — a Vault collection grant, a Nexus channel membership, a Halo participant
 * list, an Atlas space — no permission names it, `permission` is omitted, and
 * **the handler is then responsible for resolving what this user can see**.
 * There is no way to write that generically, so there is a comment on every such
 * route saying what it resolves and where.
 *
 * See ondesk/docs/developer-platform.md.
 */

export interface ApiEnv extends SsoEnv {
	DB: D1Database;
}

export interface ApiContext<E extends ApiEnv, P extends string = string> {
	request: Request;
	env: E;
	params: Record<P, string>;
	/** Keeps the Worker alive for side effects (audit writes) after the response is sent. */
	waitUntil: (promise: Promise<unknown>) => void;
	/** The verified token, for the rare handler that needs the raw claims. */
	token: AccessTokenClaims;
	/**
	 * The OnDesk user this request acts for.
	 *
	 * The only identity in the request. `client_id` says which application is
	 * asking; it is never a principal, and nothing may be visible to it that is
	 * not visible to this user.
	 */
	userId: string;
	/** The application presenting the token, for audit lines. */
	clientId: string;
	/** The workspace from `?workspace_id=`, with membership and entitlement proven. */
	workspaceId: string;
	/** The caller's platform role there: owner | admin | member. */
	workspaceRole: string;
	/** Every scope on the token, parsed properly — never substring-matched. */
	scopes: string[];
}

export interface ScopedRoute<Perm extends string> {
	/**
	 * The bare permission key this endpoint needs, prefixed with the product's
	 * app id to make the scope: `"tickets.view"` → `pulse:tickets.view`.
	 */
	scope: string;
	/**
	 * The role permission the caller must ALSO hold, when the scope names one.
	 *
	 * Omit only where the product decides visibility per resource rather than per
	 * role, and then resolve it in the handler. Omitting it because a route
	 * "feels open" is how an application ends up reading what its user could not.
	 */
	permission?: Perm;
}

export type ApiMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface ApiMiddleware<E extends ApiEnv, Perm extends string> {
	/** Every method on this route needs the same scope. */
	withScope<P extends string = string>(
		route: ScopedRoute<Perm>,
		handler: (ctx: ApiContext<E, P>) => Promise<Response>,
	): PagesFunction<E, P>;
	/**
	 * A scope per method, for the common case where one URL both lists and
	 * creates.
	 *
	 * This exists because the obvious alternative is a trap: give the file the
	 * read scope, then check the write permission inside the POST branch, and an
	 * application granted only `tickets.view` can create a ticket the moment its
	 * user happens to hold `tickets.create`. That is facts 1 and 2 of the model
	 * undone by an HTTP method. Resolving the scope from the method BEFORE any
	 * check runs is the only shape where that cannot be written by accident.
	 *
	 * A method with no entry is 405 with the `Allow` header, before the token is
	 * even looked at.
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
 * What a browser is told about this API.
 *
 * **There is deliberately no `Access-Control-Allow-Credentials`.** That header is
 * what makes a reflected origin dangerous: with it, any page could make the
 * browser attach a victim's `.ondesk.cc` cookie and read the answer. Without it
 * the browser sends no cookie, so the only way to reach anything here is to hold
 * a token — and a token is something the person granted to a named application,
 * not something a page can acquire by being visited.
 *
 * The origin allowlist below is therefore defence in depth rather than the
 * boundary. It is worth having anyway: it means a token leaked out of one
 * application cannot be spent from somebody else's page, and it costs one string
 * comparison against a claim already in the token.
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
 * The preflight, which arrives without a token.
 *
 * `OPTIONS` carries `Origin` and nothing else — no `Authorization` header, so
 * there is no `client_id` to look an allowlist up by. It therefore answers for
 * any origin, and the request that follows is where the allowlist bites: a page
 * from an unregistered origin is allowed to *send* the call and cannot read a
 * word of the reply. Nothing is disclosed by that, because the preflight's own
 * body is empty.
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

// ─── Errors ───────────────────────────────────────────────────────────────────

/**
 * RFC 6750 §3 errors, which an OAuth client library already knows how to read.
 *
 * `invalid_token` on 401 is what tells a client to refresh and retry;
 * `insufficient_scope` on 403 names the scope that was missing, so a developer
 * learns what to add to their authorization request rather than guessing.
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

// ─── The envelope every product answers in ────────────────────────────────────

/**
 * One shape across six products, because a developer integrating two of them
 * should not have to learn two pagination schemes.
 *
 * `data` always, so a collection and a single resource are told apart by what is
 * in it rather than by the caller guessing. The page block is absent on a single
 * resource rather than filled with ones.
 */
export interface PageParams {
	page: number;
	pageSize: number;
	offset: number;
}

/** `?page=` and `?page_size=`, clamped. Anything unparseable falls back rather than erroring. */
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
 * The cursor variant, for a log rather than a table.
 *
 * Offset paging is wrong for anything that gains rows at the top while somebody
 * is reading it — a chat transcript, an event stream — because page 2 has moved
 * by the time it is asked for and a message gets shown twice or skipped. Those
 * collections page on their own sequence instead, and say so by answering
 * `next_cursor` where the others answer `page`.
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

/** 404 for a resource the caller may not see, as well as one that is not there — see the note on membership. */
export function apiNotFound(what: string): Response {
	return apiError(404, "not_found", `No such ${what}, or it is not visible to this user.`);
}

export function apiInvalid(description: string): Response {
	return apiError(400, "invalid_request", description);
}

export function apiForbidden(description: string): Response {
	return apiError(403, "forbidden", description);
}

// There is deliberately no method-router helper here. `withScopes` already
// answers 405 with the `Allow` header, from the same map that decides the scope,
// and a second way to route methods is a second place for the two to disagree —
// which in this file means a method served under the wrong scope.

// ─── The middleware ───────────────────────────────────────────────────────────

export function createApiMiddleware<E extends ApiEnv, Perm extends string>(product: {
	/** The product's id in `apps`, and the prefix on every one of its scopes. */
	appId: string;
	/** Product name as the 402 says it, e.g. "Vault". */
	productName: string;
	/** The product's own resolver — `hasPermission` from its `_lib/db/roles.ts`. */
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
			// Failures below carry an error string and no data, so they reflect the
			// origin unconditionally — otherwise a browser client sees an opaque
			// network error instead of the reason it was refused.
			const fail = (response: Response) => withHeaders(response, corsHeaders(origin, true));

			// Resolved first, so a method this route does not serve is refused before
			// a token is read — and so that the scope about to be demanded is the one
			// belonging to what is actually being done.
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

			// A token is about a person, not a tenant. Without this an application
			// holding one workspace's consent would read another's data, because the
			// person it acts for may well belong to both.
			const url = new URL(request.url);
			const workspaceId = url.searchParams.get("workspace_id");
			if (!workspaceId) {
				return fail(apiError(400, "invalid_request", "workspace_id is required."));
			}

			// One query answers membership and entitlement, exactly as the session
			// middleware asks them of a signed-in person. A lapsed tenant gets 402
			// and keeps its data.
			const row = await env.DB.prepare(
				`SELECT wm.role, we.status
				   FROM workspace_members wm
				   LEFT JOIN workspace_entitlements we ON we.workspace_id = wm.workspace_id
				  WHERE wm.workspace_id = ? AND wm.user_id = ?
				  LIMIT 1`,
			)
				.bind(workspaceId, token.sub)
				.first<{ role: string; status: string | null }>();

			// Not a member is 404, not 403: confirming that a workspace id exists to
			// somebody who cannot see it is an enumeration oracle, and the token's
			// own user is the one being answered about.
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

			// Fact 3. The token said what the application may relay; this asks what
			// the person may do, now, in this workspace — the same question the
			// product's own UI asks about a signed-in member, and it must be asked
			// again however emphatically the token already answered it.
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

			// Only here does the allowlist apply: this response carries data, and the
			// origins are the ones the application registered as redirect targets.
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

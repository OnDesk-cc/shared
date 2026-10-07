/**
 * Las herramientas que un producto le publica a Nova central (2026-10-07,
 * fase 1). Spec: ondesk/docs/specs/2026-10-07-nova-central.md § 2.
 *
 * Cada producto declara sus herramientas con `defineTool` en su
 * `functions/_lib/nova-tools.ts` y monta dos rutas con `createNovaTools`:
 *
 *   GET  /api/nova/tools        el manifiesto: nombres, descripciones, esquemas, guía
 *   POST /api/nova/tools/:name  ejecuta una, con el token por llamada de Nova
 *
 * El token es RS256, dura 60 s y sirve para UNA herramienta (`tool`) de UN
 * producto (`aud`); se verifica contra el JWKS de Nova. La herramienta corre
 * **como el usuario del token**, con la misma membresía y el mismo derecho que
 * pide la sesión de la app, y con los filtros SQL de siempre dentro de `run`:
 * Nova nunca ve más de lo que esa persona vería.
 *
 * Fase 1: sólo lectura. Un `sub` que empieza por `nova:` (una ejecución
 * automática, fase 4) se rechaza aquí, antes de llegar a ninguna herramienta.
 */
import type { D1Database, PagesFunction } from "@cloudflare/workers-types";
import { bearerToken } from "./sso";
import { verifyRs256 } from "./rs256";
import { validateParams } from "./json-schema";
import type { NovaManifest, NovaManifestTool, NovaToolClaims, NovaToolErrorCode, NovaToolResponse } from "./nova-contract";
import type { WorkspaceAccess } from "./access";

export type { JsonSchema } from "./json-schema";
export type { NovaManifest, NovaManifestTool, NovaToolClaims, NovaToolErrorCode, NovaToolResponse } from "./nova-contract";

export interface NovaToolsEnv {
	DB: D1Database;
	/** Por defecto https://nova.ondesk.cc; en local, la URL de `wrangler dev` de nova. */
	NOVA_ISSUER?: string;
}

export interface NovaToolContext<E> {
	env: E;
	userId: string;
	workspaceId: string;
	/** owner | admin | member, como en `withWorkspace`. */
	workspaceRole: string;
	/** `chat:{conversación}`. */
	origin: string;
	waitUntil: (promise: Promise<unknown>) => void;
}

export interface NovaToolDef<E, P = Record<string, unknown>> extends NovaManifestTool {
	/** Devuelve datos ya proyectados: sólo los campos que Nova puede ver. */
	run: (ctx: NovaToolContext<E>, params: P) => Promise<unknown>;
}

export function defineTool<E, P = Record<string, unknown>>(def: NovaToolDef<E, P>): NovaToolDef<E> {
	return def as unknown as NovaToolDef<E>;
}

/** Lánzala desde `run` para un fallo con nombre («no existe», «no es legible»). */
export class NovaToolError extends Error {
	readonly code: NovaToolErrorCode;
	constructor(code: NovaToolErrorCode, message: string) {
		super(message);
		this.code = code;
	}
}

export const NOVA_MAX_RESULT_CHARS = 32_000;

export function novaIssuer(env: { NOVA_ISSUER?: string }): string {
	return (env.NOVA_ISSUER ?? "https://nova.ondesk.cc").replace(/\/$/, "");
}

const STATUS: Record<NovaToolErrorCode, number> = {
	unauthorized: 401,
	forbidden: 403,
	payment_required: 402,
	not_found: 404,
	invalid_params: 400,
	too_large: 413,
	failed: 500,
};

function fail(code: NovaToolErrorCode, message: string): Response {
	const body: NovaToolResponse = { ok: false, code, message };
	return Response.json(body, { status: STATUS[code] });
}

export function createNovaTools<E extends NovaToolsEnv>(opts: {
	product: string;
	version: string;
	guidance: string;
	tools: NovaToolDef<E>[];
	resolveAccess: (env: E, workspaceId: string, userId: string) => Promise<WorkspaceAccess>;
}) {
	const byName = new Map(opts.tools.map((t) => [t.name, t]));
	const manifest: NovaManifest = {
		product: opts.product,
		version: opts.version,
		guidance: opts.guidance,
		tools: opts.tools.map(({ run: _run, ...rest }) => rest),
	};

	const onManifest: PagesFunction<E> = async () => Response.json(manifest, { headers: { "Cache-Control": "no-store" } });

	const onInvoke: PagesFunction<E, "name"> = async ({ request, env, params, waitUntil }) => {
		const name = String(params.name);
		const raw = bearerToken(request);
		if (!raw) return fail("unauthorized", "Missing Nova token");

		const issuer = novaIssuer(env);
		const claims = await verifyRs256<NovaToolClaims>(raw, `${issuer}/.well-known/jwks`);
		if (
			!claims ||
			claims.iss !== issuer ||
			claims.aud !== opts.product ||
			claims.tool !== name ||
			typeof claims.sub !== "string" ||
			!claims.sub ||
			typeof claims.workspace !== "string" ||
			!claims.workspace ||
			typeof claims.origin !== "string"
		) {
			return fail("unauthorized", "Invalid Nova token");
		}
		if (claims.sub.startsWith("nova:")) return fail("forbidden", "Automatic runs are not enabled yet");

		const tool = byName.get(name);
		if (!tool) return fail("not_found", `No tool named ${name}`);

		const access = await opts.resolveAccess(env, claims.workspace, claims.sub);
		if (!access.ok) return fail(access.status === 402 ? "payment_required" : "forbidden", access.message);

		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return fail("invalid_params", "Body must be JSON");
		}
		const errors = validateParams(tool.params, body);
		if (errors.length > 0) return fail("invalid_params", errors.join("; "));

		let data: unknown;
		try {
			data = await tool.run(
				{ env, userId: claims.sub, workspaceId: claims.workspace, workspaceRole: access.role, origin: claims.origin, waitUntil },
				body as Record<string, unknown>,
			);
		} catch (err) {
			if (err instanceof NovaToolError) return fail(err.code, err.message);
			console.error(`Nova tool ${name} failed:`, err);
			return fail("failed", "The tool failed");
		}

		const ok: NovaToolResponse = { ok: true, data };
		const serialized = JSON.stringify(ok);
		if (serialized.length > NOVA_MAX_RESULT_CHARS) return fail("too_large", "The result is too large; narrow the query");
		return new Response(serialized, { headers: { "Content-Type": "application/json" } });
	};

	return { manifest, onManifest, onInvoke };
}

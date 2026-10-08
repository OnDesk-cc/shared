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
 * Fase 1: sólo lectura. Un `sub` que empieza por `nova:` se rechaza, salvo el
 * indexador de Nova (`nova:indexer`, `workspace: "*"`) en una herramienta de
 * kind `index` (el feed de la búsqueda, fase 1b): ésa no corre como ningún
 * usuario, no pasa por la membresía y su respuesta no va al modelo, así que no
 * tiene el tope de NOVA_MAX_RESULT_CHARS sino el de NOVA_MAX_INDEX_RESULT_CHARS.
 *
 * Fase 2 (2026-10-08, spec § 2c): acciones. Se declaran con `defineAction` y
 * salen en el manifiesto como kind `write`. Corren en dos tiempos, y el tiempo lo
 * fija `mode`, firmado en el token (nunca en el cuerpo):
 *   - `preview`: valida, comprueba el permiso, traduce ids a nombres y devuelve
 *     la tarjeta (`NovaActionPreview`) sin escribir nada;
 *   - `commit`: vuelve a comprobar el permiso y escribe.
 * Una `write` sin `mode` válido, o una `read`/`index` con `mode`, es 403. Una
 * preview que no tiene la forma de la tarjeta es 500 `failed`. Lo automático
 * (`nova:…`) sigue sin poder escribir.
 */
import type { D1Database, PagesFunction } from "@cloudflare/workers-types";
import { bearerToken } from "./sso";
import { verifyRs256 } from "./rs256";
import { validateParams, type JsonSchema } from "./json-schema";
import type { NovaActionPreview, NovaManifest, NovaManifestTool, NovaToolClaims, NovaToolErrorCode, NovaToolResponse } from "./nova-contract";
import type { WorkspaceAccess } from "./access";
import { NOVA_INDEXER_SUBJECT } from "./nova-search";

export type { JsonSchema } from "./json-schema";
export type {
	NovaActionPreview,
	NovaManifest,
	NovaManifestTool,
	NovaToolClaims,
	NovaToolErrorCode,
	NovaToolResponse,
	NovaUsage,
} from "./nova-contract";

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
	/** `read` en las herramientas `read` e `index`; en una acción, el `mode` del token. */
	mode: "read" | "preview" | "commit";
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

/** Una acción: una herramienta `write` en dos tiempos (ver la cabecera). */
export interface NovaActionDef<E, P = Record<string, unknown>> {
	name: string;
	/** En inglés: la lee el modelo. */
	description: string;
	/** Borrar, archivar, cancelar o cerrar: la tarjeta va en rojo, con el verbo en el botón. */
	destructive?: boolean;
	params: JsonSchema;
	/** Valida, comprueba el permiso con `ctx.userId` y traduce ids a nombres. NO escribe. */
	preview: (ctx: NovaToolContext<E>, params: P) => Promise<NovaActionPreview>;
	/** Vuelve a comprobar el permiso, escribe y devuelve `{ ok: true, link, … }`. */
	commit: (ctx: NovaToolContext<E>, params: P) => Promise<unknown>;
}

export function defineAction<E, P = Record<string, unknown>>(def: NovaActionDef<E, P>): NovaToolDef<E> {
	// Un objeto nuevo con sólo los campos del manifiesto y `run`: `preview` y
	// `commit` no pueden acabar en lo que se publica.
	const tool: NovaToolDef<E, P> = {
		name: def.name,
		description: def.description,
		kind: "write",
		destructive: def.destructive ?? false,
		params: def.params,
		run: async (ctx, params) => {
			if (ctx.mode === "preview") return def.preview(ctx, params);
			if (ctx.mode === "commit") return def.commit(ctx, params);
			throw new NovaToolError("forbidden", "Actions need a preview or commit token");
		},
	};
	return tool as unknown as NovaToolDef<E>;
}

/** La forma de la tarjeta: una frase y campos de texto. Otra cosa no se enseña. */
function isActionPreview(value: unknown): value is NovaActionPreview {
	if (!value || typeof value !== "object") return false;
	const { summary, fields } = value as { summary?: unknown; fields?: unknown };
	return (
		typeof summary === "string" &&
		summary.trim() !== "" &&
		Array.isArray(fields) &&
		fields.every((f) => !!f && typeof f === "object" && typeof (f as { label?: unknown }).label === "string" && typeof (f as { value?: unknown }).value === "string")
	);
}

/**
 * Tope de una respuesta (unos 16 000 tokens; el modelo de Nova tiene 128 000 de
 * contexto). Cabe un snapshot normal con su documento o hilo abierto; cada
 * producto recorta además lo suyo (hilos, documentos, miembros) para no llegar.
 */
export const NOVA_MAX_RESULT_CHARS = 64_000;

/** Tope de la respuesta de una herramienta `index` (un feed con 50 documentos de 24 000 caracteres). */
export const NOVA_MAX_INDEX_RESULT_CHARS = 2_000_000;

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
		const tool = byName.get(name);
		if (!tool) return fail("not_found", `No tool named ${name}`);

		const indexer = claims.sub === NOVA_INDEXER_SUBJECT && claims.workspace === "*";
		if (tool.kind === "index" ? !indexer : claims.sub.startsWith("nova:")) {
			return fail("forbidden", tool.kind === "index" ? "Index tools are for Nova's indexer only" : "Automatic runs are not enabled yet");
		}

		// Sólo una acción lleva `mode`, y siempre: así un token de preview nunca escribe.
		const write = tool.kind === "write";
		if (write ? claims.mode !== "preview" && claims.mode !== "commit" : claims.mode !== undefined) {
			return fail("forbidden", write ? "Actions need a preview or commit token" : "Only actions take a mode");
		}
		const mode: NovaToolContext<E>["mode"] = write ? (claims.mode as "preview" | "commit") : "read";

		const access = tool.kind === "index" ? ({ ok: true, role: "system" } as const) : await opts.resolveAccess(env, claims.workspace, claims.sub);
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
				{ env, userId: claims.sub, workspaceId: claims.workspace, workspaceRole: access.role, origin: claims.origin, mode, waitUntil },
				body as Record<string, unknown>,
			);
		} catch (err) {
			if (err instanceof NovaToolError) return fail(err.code, err.message);
			console.error(`Nova tool ${name} failed:`, err);
			return fail("failed", "The tool failed");
		}
		if (mode === "preview" && !isActionPreview(data)) {
			console.error(`Nova tool ${name} returned a malformed preview`);
			return fail("failed", "The action preview is malformed");
		}

		const ok: NovaToolResponse = { ok: true, data };
		const serialized = JSON.stringify(ok);
		const cap = tool.kind === "index" ? NOVA_MAX_INDEX_RESULT_CHARS : NOVA_MAX_RESULT_CHARS;
		if (serialized.length > cap) return fail("too_large", "The result is too large; narrow the query");
		return new Response(serialized, { headers: { "Content-Type": "application/json" } });
	};

	return { manifest, onManifest, onInvoke };
}

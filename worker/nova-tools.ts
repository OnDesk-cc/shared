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
 * Desde la fase 4 (abajo), también un agente.
 *
 * Fase 2 (2026-10-08, spec § 2c): acciones. Se declaran con `defineAction` y
 * salen en el manifiesto como kind `write`. Corren en dos tiempos, y el tiempo lo
 * fija `mode`, firmado en el token (nunca en el cuerpo):
 *   - `preview`: valida, comprueba el permiso, traduce ids a nombres y devuelve
 *     la tarjeta (`NovaActionPreview`) sin escribir nada;
 *   - `commit`: vuelve a comprobar el permiso y escribe.
 * Una `write` sin `mode` válido, o una `read`/`index` con `mode`, es 403. Una
 * preview que no tiene la forma de la tarjeta es 500 `failed`.
 *
 * Fase 4 (2026-10-09, spec § 2e): lo automático. Un agente de Nova
 * (`sub: "nova:agent:<id>"`, worker/nova-contract.ts) contesta tickets sin una
 * persona delante. Las reglas, en este orden:
 *   1. El indexador, igual: `nova:indexer` con `workspace: "*"`, sólo en kind
 *      `index` y con cualquier `feed` (la búsqueda o la bandeja de eventos).
 *   2. Un agente:
 *      - sólo herramientas con `automatic: true`, y nunca una `destructive`
 *        aunque esté marcada (403);
 *      - siempre con `resource` (`<product>:<kind>:<id>`, de este mismo
 *        producto) y con un workspace de verdad, no `"*"` (403);
 *      - en una `write`, `mode` sigue siendo obligatorio;
 *      - `key`, si viene, de 1 a 200 caracteres (400);
 *      - no pasa por `resolveAccess`, porque no es un miembro: el límite es el
 *        recurso. `ctx.workspaceRole` es `"agent"` y `ctx.agentId` su id.
 *        Ojo: el rol de tenencia de una persona también puede ser `agent`;
 *        lo que distingue a un agente de Nova es `ctx.agentId !== null`.
 *   3. Cualquier otro `sub` que empieza por `nova:` → 403, como antes.
 *   4. Las personas, como antes (`ctx.agentId` null).
 * Dentro de `run`, `requireResource(ctx, kind, id)` rechaza con 403 cualquier
 * objeto que no sea el del recurso: el ticket lo elige Nova, nunca el modelo ni
 * el correo del cliente. `offer: false` no cambia nada aquí: sólo lo lee Nova.
 */
import type { D1Database, PagesFunction } from "@cloudflare/workers-types";
import { bearerToken } from "./sso";
import { verifyRs256 } from "./rs256";
import { validateParams, type JsonSchema } from "./json-schema";
import { parseAgentSubject, parseResource } from "./nova-contract";
import type { NovaActionPreview, NovaManifest, NovaManifestTool, NovaToolClaims, NovaToolErrorCode, NovaToolResponse } from "./nova-contract";
import type { WorkspaceAccess } from "./access";
import { NOVA_INDEXER_SUBJECT } from "./nova-search";

export type { JsonSchema } from "./json-schema";
export type {
	NovaActionPreview,
	NovaDraftApproval,
	NovaDraftProposal,
	NovaEvent,
	NovaEventsFeed,
	NovaEventType,
	NovaManifest,
	NovaManifestTool,
	NovaToolClaims,
	NovaToolErrorCode,
	NovaToolResponse,
	NovaUsage,
} from "./nova-contract";
export { agentSubject, NOVA_AGENT_PREFIX, parseAgentSubject, parseResource, ticketResource } from "./nova-contract";

export interface NovaToolsEnv {
	DB: D1Database;
	/** Por defecto https://nova.ondesk.cc; en local, la URL de `wrangler dev` de nova. */
	NOVA_ISSUER?: string;
}

export interface NovaToolContext<E> {
	env: E;
	/** El `sub` entero: el id de la persona, `nova:indexer` o `nova:agent:<id>`. */
	userId: string;
	workspaceId: string;
	/** owner | admin | member, como en `withWorkspace`; `system` para el indexador y `agent` para un agente de Nova. */
	workspaceRole: string;
	/** `chat:{conversación}`, o `run:{ejecución}` en lo automático. */
	origin: string;
	/** `read` en las herramientas `read` e `index`; en una acción, el `mode` del token. */
	mode: "read" | "preview" | "commit";
	waitUntil: (promise: Promise<unknown>) => void;
	/** El `resource` del token; null si no vino. */
	resource: string | null;
	/** El id del agente si `sub` es nova:agent:*, si no null. `userId` sigue siendo el `sub` entero. */
	agentId: string | null;
	/** El `key` del token; null si no vino. */
	key: string | null;
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

/**
 * En un agente (`ctx.agentId`), lanza `forbidden` si el objeto que toca no es el
 * de su `resource`: mismo `kind` y mismo `id`. Con una persona no hace nada: a
 * ella la limitan sus permisos. Llámala en `run` (y en `preview` y `commit`) con
 * el id real de la fila, después de buscarla. Un contexto armado a mano sin
 * `agentId` (las pruebas de antes de la fase 4) cuenta como una persona.
 */
export function requireResource(ctx: NovaToolContext<unknown>, kind: string, id: string): void {
	if (!ctx.agentId) return;
	const target = ctx.resource === null ? null : parseResource(ctx.resource);
	if (!target || target.kind !== kind || target.id !== id) {
		throw new NovaToolError("forbidden", "This run can only touch its own ticket");
	}
}

/** Una acción: una herramienta `write` en dos tiempos (ver la cabecera). */
export interface NovaActionDef<E, P = Record<string, unknown>> {
	name: string;
	/** En inglés: la lee el modelo. */
	description: string;
	/** Borrar, archivar, cancelar o cerrar: la tarjeta va en rojo, con el verbo en el botón. */
	destructive?: boolean;
	/** Fase 4: la puede llamar un agente (ver la cabecera). Nunca sirve en una destructiva. */
	automatic?: boolean;
	/** Fase 4: false = Nova nunca se la ofrece al modelo. */
	offer?: boolean;
	params: JsonSchema;
	/** Valida, comprueba el permiso con `ctx.userId` y traduce ids a nombres. NO escribe. */
	preview: (ctx: NovaToolContext<E>, params: P) => Promise<NovaActionPreview>;
	/** Vuelve a comprobar el permiso, escribe y devuelve `{ ok: true, link, … }`. */
	commit: (ctx: NovaToolContext<E>, params: P) => Promise<unknown>;
}

export function defineAction<E, P = Record<string, unknown>>(def: NovaActionDef<E, P>): NovaToolDef<E> {
	// Un objeto nuevo con sólo los campos del manifiesto y `run`: `preview` y
	// `commit` no pueden acabar en lo que se publica. `automatic` y `offer` sólo
	// si se pusieron, para que el manifiesto de quien no los usa no cambie.
	const tool: NovaToolDef<E, P> = {
		name: def.name,
		description: def.description,
		kind: "write",
		destructive: def.destructive ?? false,
		...(def.automatic === undefined ? {} : { automatic: def.automatic }),
		...(def.offer === undefined ? {} : { offer: def.offer }),
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

		// Las reglas de la cabecera, en su orden: indexador, agente, otro `nova:`, persona.
		const indexer = claims.sub === NOVA_INDEXER_SUBJECT && claims.workspace === "*";
		const agentId = parseAgentSubject(claims.sub);
		if (tool.kind === "index") {
			if (!indexer) return fail("forbidden", "Index tools are for Nova's indexer only");
		} else if (agentId !== null) {
			if (tool.automatic !== true || tool.destructive === true) return fail("forbidden", "This tool is not open to automatic runs");
			const target = typeof claims.resource === "string" ? parseResource(claims.resource) : null;
			if (!target || target.product !== opts.product || claims.workspace === "*") {
				return fail("forbidden", "Automatic runs need a resource in this product");
			}
		} else if (claims.sub.startsWith("nova:")) {
			return fail("forbidden", "Automatic runs are for Nova agents only");
		}

		// Sólo una acción lleva `mode`, y siempre: así un token de preview nunca escribe.
		const write = tool.kind === "write";
		if (write ? claims.mode !== "preview" && claims.mode !== "commit" : claims.mode !== undefined) {
			return fail("forbidden", write ? "Actions need a preview or commit token" : "Only actions take a mode");
		}
		const mode: NovaToolContext<E>["mode"] = write ? (claims.mode as "preview" | "commit") : "read";

		// La clave de idempotencia de un agente: el producto la guarda tal cual.
		if (agentId !== null && claims.key !== undefined && (typeof claims.key !== "string" || claims.key.length === 0 || claims.key.length > 200)) {
			return fail("invalid_params", "key must be 1 to 200 characters");
		}

		// Un agente no es un miembro: no hay membresía que comprobar (el límite es el recurso).
		const access =
			tool.kind === "index"
				? ({ ok: true, role: "system" } as const)
				: agentId !== null
					? ({ ok: true, role: "agent" } as const)
					: await opts.resolveAccess(env, claims.workspace, claims.sub);
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
				{
					env,
					userId: claims.sub,
					workspaceId: claims.workspace,
					workspaceRole: access.role,
					origin: claims.origin,
					mode,
					waitUntil,
					resource: typeof claims.resource === "string" ? claims.resource : null,
					agentId,
					key: typeof claims.key === "string" ? claims.key : null,
				},
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

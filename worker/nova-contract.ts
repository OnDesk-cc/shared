/**
 * Los tipos del contrato entre Nova central y las herramientas de un producto
 * (2026-10-07). Sin ninguna dependencia de runtime, a propósito: los importan los
 * dos lados — los productos (worker/nova-tools.ts, con los tipos de Pages) y el
 * Worker de Nova (con su propia versión de @cloudflare/workers-types) — y un
 * import de `PagesFunction` aquí haría chocar las dos versiones de `Response`.
 * También lo importa la hoja (components/nova-chat-parts.ts, fase 2): por eso
 * aquí sólo hay tipos, constantes y funciones puras, sin nada de los globales
 * del Worker.
 *
 * Fase 4 (2026-10-09, spec § 2e): la respuesta automática de tickets.
 *   - La identidad de una ejecución: `sub` = `nova:agent:<id>` (`agentSubject`,
 *     `parseAgentSubject`) y `resource` = `<product>:<kind>:<id>`, siempre
 *     (`ticketResource`, `parseResource`). Las reglas de lo que puede un agente
 *     están en worker/nova-tools.ts.
 *   - En el manifiesto: `automatic` (la llama un agente), `offer` (false = Nova
 *     nunca se la ofrece al modelo) y `feed` (qué bandeja es una `index`).
 *   - La bandeja de eventos de Pulse (`NovaEvent`, `NovaEventsFeed`) y lo que
 *     viaja con un borrador (`NovaDraftProposal`, `NovaDraftApproval`).
 *
 * Automatizaciones (2026-10-21, spec ondesk/docs/specs/2026-10-21-automatizaciones.md):
 *   - Los disparadores que un producto publica en su manifiesto (`NovaTriggerDef`,
 *     con sus campos `NovaFieldDef`) y lo que devuelve la herramienta que lee el
 *     objeto como el dueño de la automatización (`NovaSubject`).
 *   - La bandeja `automation_events` de cada producto (`NovaAutomationEvent`,
 *     `NovaAutomationFeed`; el ayudante está en worker/automation-events.ts).
 *   - El `origin` de un paso: `flow:<automatización>:<ejecución>` (`flowOrigin`,
 *     `parseFlowOrigin`), y lo que dice la auditoría de él (`viaOfOrigin`).
 */
import type { JsonSchema } from "./json-schema";

export type { JsonSchema } from "./json-schema";

/** Lo que el manifiesto dice de una herramienta (todo menos su `run`). */
export interface NovaManifestTool {
	name: string;
	/** En inglés: la lee el modelo. */
	description: string;
	/**
	 * read/write: corren como el usuario del token. index: sólo para el indexador
	 * de Nova (`sub: "nova:indexer"`, `workspace: "*"`); nunca se le ofrece al modelo.
	 */
	kind: "read" | "write" | "index";
	destructive?: boolean;
	/** true: Nova la llama sola al empezar cada turno y nunca se la ofrece al modelo. */
	auto?: boolean;
	/**
	 * true: herramienta de búsqueda semántica. Nova le añade `candidates` (de su
	 * índice, worker/nova-search.ts) a lo que pida el modelo, y el producto
	 * re-comprueba cada uno. El modelo no ve ese parámetro.
	 */
	retrieval?: boolean;
	/** Fase 4: la puede llamar un agente (`sub` nova:agent:*), siempre con `resource`. Nunca en una destructiva. */
	automatic?: boolean;
	/** Fase 4: false = sale en el manifiesto pero Nova nunca se la ofrece al modelo (consola, lectura previa). Por defecto true. */
	offer?: boolean;
	/**
	 * Sólo en kind `index`: qué bandeja es. Sin campo = "search" (el indexador de
	 * la 1b); "events" es la de la respuesta automática de Pulse (fase 4) y
	 * "automations" la de las automatizaciones (`<product>.automation_events`).
	 */
	feed?: "search" | "events" | "automations";
	params: JsonSchema;
}

export interface NovaManifest {
	product: string;
	version: string;
	/** Cómo contestar en este producto: lo que antes era «HOW TO ANSWER» en su prompt. */
	guidance: string;
	tools: NovaManifestTool[];
	/** Automatizaciones: lo que en este producto puede disparar una. Sin clave = ninguno. */
	triggers?: NovaTriggerDef[];
}

export type NovaToolErrorCode = "unauthorized" | "forbidden" | "payment_required" | "not_found" | "invalid_params" | "too_large" | "failed";

export type NovaToolResponse = { ok: true; data: unknown } | { ok: false; code: NovaToolErrorCode; message: string };

export interface NovaToolClaims {
	iss: string;
	aud: string;
	sub: string;
	workspace: string;
	tool: string;
	origin: string;
	resource?: string;
	/**
	 * Sólo en una herramienta `write` (fase 2), y obligatorio en ella: `preview`
	 * enseña lo que haría sin escribir; `commit` escribe. Una `read` o una `index`
	 * con `mode` se rechaza.
	 */
	mode?: "preview" | "commit";
	/** Fase 4: clave de idempotencia de una escritura automática (`<runId>:…`, hasta 200 caracteres). */
	key?: string;
	jti: string;
	iat: number;
	exp: number;
	[key: string]: unknown;
}

/** Fase 4: el `sub` de una ejecución automática es este prefijo y el id del agente. */
export const NOVA_AGENT_PREFIX = "nova:agent:";

/** El id de un agente en un `sub`: letras, dígitos, `_` y `-`, hasta 64 (un UUID cabe). */
const AGENT_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Las tres partes de un `resource`: producto y tipo en minúsculas; el id como el de un agente, hasta 128. */
const RESOURCE = /^([a-z][a-z0-9_]*):([a-z][a-z0-9_]*):([A-Za-z0-9_-]{1,128})$/;

export function agentSubject(agentId: string): string {
	return `${NOVA_AGENT_PREFIX}${agentId}`;
}

/** El id del agente, o null si el `sub` no es un agente (una persona, el indexador, otro `nova:`). */
export function parseAgentSubject(sub: string): string | null {
	if (!sub.startsWith(NOVA_AGENT_PREFIX)) return null;
	const id = sub.slice(NOVA_AGENT_PREFIX.length);
	return AGENT_ID.test(id) ? id : null;
}

/** El recurso de una ejecución sobre un ticket de Pulse: el id hex de `tickets.id`, no el número. */
export function ticketResource(ticketId: string): string {
	return `pulse:ticket:${ticketId}`;
}

/** `<product>:<kind>:<id>` en sus tres partes, o null si no tiene esa forma. */
export function parseResource(resource: string): { product: string; kind: string; id: string } | null {
	const m = RESOURCE.exec(resource);
	return m ? { product: m[1], kind: m[2], id: m[3] } : null;
}

export type NovaEventType = "ticket.message_received" | "ticket.resolved" | "draft.approved";

/** Una fila de la bandeja `nova_events` de Pulse, como la entrega `pulse.events`. */
export interface NovaEvent {
	/** El cursor: `nova_events.seq` (AUTOINCREMENT). */
	seq: number;
	/** UUID: la idempotencia en la NovaRun. */
	id: string;
	type: NovaEventType;
	workspace_id: string;
	ticket_id: string;
	mailbox_id: string | null;
	message_id: string | null;
	auto_submitted: boolean;
	/** draft.approved: NovaDraftApproval. Los otros: null. */
	payload: NovaDraftApproval | null;
	/** Unix, segundos. */
	created_at: number;
}

/** Lo que una persona decidió al enviar un borrador con acciones (`draft.approved`). */
export interface NovaDraftApproval {
	draft_id: string;
	run_id: string;
	agent_id: string;
	/** Los `id` de las propuestas marcadas, en el orden en que se ejecutan. */
	approved: string[];
	/** El id de usuario de quien aprobó. */
	decided_by: string;
}

/** Una página de la bandeja de eventos: la siguiente llamada pasa `next_after` como `after`. */
export interface NovaEventsFeed {
	events: NovaEvent[];
	next_after: number;
	has_more: boolean;
}

/** Una escritura que un agente en modo borrador propone y una persona aprueba. */
export interface NovaDraftProposal {
	/** `p1`, `p2`… en el orden del modelo. */
	id: string;
	/** Nombre real: `market.calendly.create_invitee` o `pulse.update_ticket`. */
	tool: string;
	/** La tarjeta (el preview del producto o de Nova). */
	summary: string;
	fields: { label: string; value: string }[];
	/** Los parámetros exactos que se ejecutarán. */
	params: Record<string, unknown>;
}

/** Un acierto del índice de Nova: qué objeto, qué trozo de su texto y cuánto se parece. */
export interface NovaSearchCandidate {
	kind: string;
	id: string;
	chunk: number;
	score: number;
}

/** Una entrada del feed de un producto para el índice: el texto actual, o que ya no está. */
export type NovaIndexEntry =
	| { op: "upsert"; kind: string; id: string; workspace_id: string; text: string }
	| { op: "delete"; kind: string; id: string; workspace_id: string };

export interface NovaIndexFeed {
	entries: NovaIndexEntry[];
	/** Hasta dónde se ha entregado: la siguiente llamada pasa éste como `after`. */
	next_after: number;
	has_more: boolean;
}

/** Lo que enseña la tarjeta de aprobación: lo escribe el producto en `preview`. */
export interface NovaActionPreview {
	/** Una frase, en inglés como el resto de lo que lee la persona en la hoja: «Create task "Ship v2" in Launch». */
	summary: string;
	fields: { label: string; value: string }[];
}

/** El saldo de créditos de una persona: el menor de sus tres límites (fondo, su tope, el del producto). */
export interface NovaUsage {
	remaining: number;
	limit: number;
	/** Cuál de los tres es el que manda. */
	scope: "workspace" | "user" | "product";
	/** ISO, el día 1 del mes siguiente a las 00:00 UTC. */
	renews_at: string;
}

/**
 * La parte de datos del mensaje con la que Nova le pasa a la hoja la tarjeta de
 * una acción. Va con `id` = `toolCallId`, se guarda con el mensaje y nunca llega
 * al modelo. La escribe nova/src/chat-agent.ts y la lee
 * components/nova-chat-parts.ts.
 */
export const NOVA_PREVIEW_PART = "data-nova-preview" as const;

export interface NovaPreviewData {
	toolCallId: string;
	product: string;
	/** El nombre real de la herramienta: `orbit.delete_task`. */
	tool: string;
	destructive: boolean;
	preview: NovaActionPreview;
}

// ── Automatizaciones (2026-10-21) ───────────────────────────────────────────

export type NovaFieldType = "text" | "enum" | "number" | "date" | "person" | "link" | "bool";

/** Un campo de un disparador: una variable de las plantillas y algo sobre lo que poner una condición. */
export interface NovaFieldDef {
	key: string;
	/** En inglés: lo lee la persona en el editor. */
	label: string;
	type: NovaFieldType;
	/** Sólo en `enum`. */
	options?: { value: string; label: string }[];
}

/** Algo que pasa en un producto y puede disparar una automatización. */
export interface NovaTriggerDef {
	/** `{producto}.{objeto}.{verbo}`: `pulse.ticket.created`. */
	type: string;
	label: string;
	description: string;
	/** El `kind` del `resource` del evento: `ticket` en `pulse:ticket:<id>`. */
	resource_kind: string;
	/** La herramienta (`read`, `offer: false`) que lee el objeto como el dueño: `pulse.automation_subject`. */
	subject_tool: string;
	/** Los campos del objeto: los devuelve `subject_tool`. */
	fields: NovaFieldDef[];
	/** Los campos del cambio: los trae el evento en `data` (`from_status`, `to_status`…). */
	change?: NovaFieldDef[];
}

export type NovaScalar = string | number | boolean | null;

/** Una fila de la bandeja `automation_events` de un producto, como la entrega `<product>.automation_events`. */
export interface NovaAutomationEvent {
	/** El cursor: `automation_events.seq` (AUTOINCREMENT). */
	seq: number;
	/** UUID: la idempotencia en la DO de cada automatización. */
	id: string;
	type: string;
	workspace_id: string;
	/** `<product>:<kind>:<id>`. */
	resource: string;
	/** Quién hizo el cambio: una persona, `nova:agent:<id>` o null (el sistema, un correo que entró). */
	actor_id: string | null;
	/**
	 * El `origin` del token si el cambio vino de Nova (`chat:…`, `run:…`,
	 * `flow:…`) u otra marca del producto (`api:<cliente>`, `rule:<id>`); null si
	 * lo hizo una persona en la app.
	 */
	origin: string | null;
	/** Los campos `change` del disparador. Nunca el contenido del objeto. */
	data: Record<string, NovaScalar>;
	/** Unix, segundos. */
	created_at: number;
}

export interface NovaAutomationFeed {
	events: NovaAutomationEvent[];
	next_after: number;
	has_more: boolean;
}

/** Lo que devuelve la `subject_tool` de un disparador: los campos del objeto, vistos como quien llama. */
export interface NovaSubject {
	fields: Record<string, NovaScalar>;
	link: string | null;
	/**
	 * Quien hizo el cambio, si la llamada trajo `actor_id` y es un miembro (del
	 * espejo de miembros del producto): para `{{actor.name}}` y `{{actor.email}}`.
	 * null si no lo es (un correo que entró, un agente) o no se pidió.
	 */
	actor?: { name: string | null; email: string | null } | null;
}

/** El tope de `automation_events.data`, en caracteres de JSON. */
export const AUTOMATION_EVENT_DATA_MAX_CHARS = 2048;

/** El `origin` de un paso de una automatización: este prefijo, la automatización y la ejecución. */
export const FLOW_ORIGIN_PREFIX = "flow:";

/** Los ids de un `origin` de automatización: como el de un agente. */
const FLOW_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function flowOrigin(flowId: string, runId: string): string {
	return `${FLOW_ORIGIN_PREFIX}${flowId}:${runId}`;
}

/** La automatización y la ejecución de un `origin`, o null si no es de una automatización. */
export function parseFlowOrigin(origin: string | null): { flowId: string; runId: string } | null {
	if (!origin?.startsWith(FLOW_ORIGIN_PREFIX)) return null;
	const parts = origin.slice(FLOW_ORIGIN_PREFIX.length).split(":");
	if (parts.length !== 2 || !FLOW_ID.test(parts[0]) || !FLOW_ID.test(parts[1])) return null;
	return { flowId: parts[0], runId: parts[1] };
}

/** Lo que dice la auditoría de un producto de una escritura que vino de Nova: «automation» si fue un paso. */
export function viaOfOrigin(origin: string | null): "nova" | "automation" {
	return parseFlowOrigin(origin) ? "automation" : "nova";
}

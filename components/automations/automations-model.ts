/**
 * El modelo del editor de automatizaciones (2026-10-21), sin React, para
 * probarlo en Node. Spec: ondesk/docs/specs/2026-10-21-automatizaciones.md § 5 y § 8.
 *
 *   variablesAt     las variables que se pueden insertar en un paso: las del
 *                   disparador (`trigger.*`, `change.*`), las de quién hizo el
 *                   cambio (`actor.*`) y las salidas de los pasos anteriores
 *                   (`step<n>.*`, de STEP_OUTPUTS)
 *   flowSentence    la frase de una automatización en la lista: «When Ticket
 *                   created → Create task (Orbit)»
 *   splitTemplate   un texto con `{{…}}` en trozos de texto y variables, para
 *                   pintar las fichas; un `{{` que no es una variable es texto
 *   unknownTokens   las variables de un texto que no existen en ese paso
 *   defaultParams   lo que se rellena solo al añadir un paso: el ticket o la
 *                   tarea del disparador cuando el paso es de la misma app
 *   draftErrors     lo que impide guardar, en inglés (lo lee la persona)
 *   automationsUrl  la URL de la API de Nova (`/api/automations…`)
 *
 * Los tipos copian los del motor (nova/src/flows/types.ts): shared no importa
 * de Nova. La puerta y la validación de verdad están en Nova; esto es para que
 * el editor avise antes de mandar.
 */
import type { JsonSchema } from "../../worker/json-schema";
import type { NovaActionPreview, NovaSubject, NovaTriggerDef } from "../../worker/nova-contract";
import { novaOrigin } from "../nova-chat-parts";

export type AutomationProduct = "pulse" | "orbit" | "halo" | "atlas" | "nexus" | "vault";

export const PRODUCT_LABELS: Record<AutomationProduct, string> = {
	pulse: "Pulse",
	orbit: "Orbit",
	halo: "Halo",
	atlas: "Atlas",
	nexus: "Nexus",
	vault: "Vault",
};

export const MAX_STEPS = 5;

export interface CatalogTrigger extends NovaTriggerDef {
	product: AutomationProduct;
}

export interface CatalogAction {
	tool: string;
	product: AutomationProduct;
	label: string;
	description: string;
	params: JsonSchema;
}

export interface Catalog {
	triggers: CatalogTrigger[];
	actions: CatalogAction[];
}

export type FlowOp = "eq" | "neq" | "contains" | "not_contains" | "gt" | "lt" | "in" | "is_empty" | "is_not_empty";
export type FlowValue = string | number | boolean | null | string[];

export interface FlowRule {
	/** `trigger.<campo>`, `change.<campo>`, `actor.id`, `actor.email` o `actor.is_automation`. */
	field: string;
	op: FlowOp;
	value?: FlowValue;
}

export interface FlowConditions {
	match: "all" | "any";
	rules: FlowRule[];
}

export interface FlowStep {
	tool: string;
	params: Record<string, unknown>;
}

export interface FlowDraft {
	name: string;
	trigger_type: string;
	conditions: FlowConditions;
	steps: FlowStep[];
}

export type FlowStatus = "active" | "paused";
export type PausedReason = "failing" | "owner_left" | "plan_limit" | "manual";

export interface ListedFlow extends FlowDraft {
	id: string;
	description: string;
	status: FlowStatus;
	paused_reason: PausedReason | null;
	trigger_product: AutomationProduct;
	version: number;
	owner_id: string;
	owner_name?: string | null;
	created_by: string;
	updated_by: string;
	run_count: number;
	skipped_count: number;
	last_run_at: number | null;
	created_at: number;
	updated_at: number;
	/** `starts`: empieza en la app que pregunta; `acts`: sólo tiene pasos ahí (sin pasos ni condiciones en la respuesta). */
	role?: "starts" | "acts";
	stats?: { done: number; failed: number };
}

export type FlowOutcome = "done" | "failed" | "unknown" | "skipped";

export interface FlowTraceEntry {
	step: number;
	tool: string;
	outcome: FlowOutcome;
	summary: string;
	link: string | null;
}

export interface FlowRunView {
	id: string;
	flow_id: string;
	flow_version: number;
	event_type: string;
	resource: string;
	depth: number;
	outcome: FlowOutcome | "running";
	reason: string | null;
	trace: FlowTraceEntry[];
	created_at: number;
	finished_at: number | null;
}

export interface FlowTestResult {
	matched: boolean;
	subject: NovaSubject | null;
	steps: { tool: string; ok: boolean; preview?: NovaActionPreview; error?: string }[];
}

export interface Variable {
	/** `trigger.subject`: lo que va entre `{{ }}`. */
	token: string;
	label: string;
	group: string;
}

/**
 * Las claves de primer nivel que devuelve el `commit` de cada paso y que un paso
 * siguiente puede usar. Cotejadas con lo que devuelve cada producto.
 */
export const STEP_OUTPUTS: Record<string, readonly string[]> = {
	"orbit.create_task": ["ref", "title", "link"],
	"orbit.update_task": ["ref", "status", "link"],
	"orbit.comment_task": ["ref", "link"],
	"nexus.post_message": ["channel", "link"],
	"halo.create_meeting": ["title", "link"],
	"atlas.create_page": ["title", "link"],
	"atlas.comment_document": ["link"],
	"pulse.update_ticket": ["ticket", "link"],
	"pulse.reply_ticket": ["ticket", "link"],
};

const OUTPUT_LABELS: Record<string, string> = { ref: "Reference", title: "Title", link: "Link", status: "Status", channel: "Channel", ticket: "Ticket" };

const TOKEN = /\{\{\s*((?:trigger|change|actor|step\d+)\.[a-z_]+)\s*\}\}/g;

function triggerOf(catalog: Catalog, type: string): CatalogTrigger | null {
	return catalog.triggers.find((t) => t.type === type) ?? null;
}

function actionOf(catalog: Catalog, tool: string): CatalogAction | null {
	return catalog.actions.find((a) => a.tool === tool) ?? null;
}

export function variablesAt(catalog: Catalog, triggerType: string, steps: { tool: string }[], stepIndex: number): Variable[] {
	const trigger = triggerOf(catalog, triggerType);
	const vars: Variable[] = [];
	if (trigger) {
		for (const f of trigger.fields) vars.push({ token: `trigger.${f.key}`, label: f.label, group: trigger.label });
		for (const f of trigger.change ?? []) vars.push({ token: `change.${f.key}`, label: f.label, group: "What changed" });
	}
	vars.push({ token: "actor.name", label: "Name", group: "Who did it" }, { token: "actor.email", label: "Email", group: "Who did it" });
	steps.slice(0, Math.max(0, stepIndex)).forEach((step, i) => {
		const action = actionOf(catalog, step.tool);
		const group = `Step ${i + 1}${action ? ` · ${action.label}` : ""}`;
		for (const key of STEP_OUTPUTS[step.tool] ?? []) vars.push({ token: `step${i + 1}.${key}`, label: OUTPUT_LABELS[key] ?? key, group });
	});
	return vars;
}

export function flowSentence(catalog: Catalog, flow: { trigger_type: string; steps: { tool: string }[] }): string {
	const trigger = triggerOf(catalog, flow.trigger_type);
	const head = trigger ? `When ${trigger.label}` : "When an unknown trigger fires";
	const steps = flow.steps.map((s) => {
		const action = actionOf(catalog, s.tool);
		return action ? `${action.label} (${PRODUCT_LABELS[action.product]})` : s.tool;
	});
	return [head, ...steps].join(" → ");
}

export type TemplatePart = { kind: "text"; value: string } | { kind: "var"; token: string };

export function splitTemplate(text: string): TemplatePart[] {
	const parts: TemplatePart[] = [];
	let last = 0;
	for (const m of text.matchAll(TOKEN)) {
		if (m.index > last) parts.push({ kind: "text", value: text.slice(last, m.index) });
		parts.push({ kind: "var", token: m[1] });
		last = m.index + m[0].length;
	}
	if (last < text.length) parts.push({ kind: "text", value: text.slice(last) });
	return parts;
}

export function unknownTokens(text: string, vars: Variable[]): string[] {
	const known = new Set(vars.map((v) => v.token));
	return [...new Set([...text.matchAll(TOKEN)].map((m) => m[1]).filter((t) => !known.has(t)))];
}

/** El ticket o la tarea del disparador, cuando el paso es de la misma app y lo nombra por número o referencia. */
export function defaultParams(action: CatalogAction, trigger: CatalogTrigger): Record<string, unknown> {
	const props = action.params.properties ?? {};
	if (action.product !== trigger.product) return {};
	if (trigger.product === "pulse" && props.ticket) return { ticket: "{{trigger.number}}" };
	if (trigger.product === "orbit" && props.task) return { task: "{{trigger.ref}}" };
	return {};
}

function paramLabel(key: string): string {
	const words = key.replace(/_email$/, "").replace(/_/g, " ");
	return words.charAt(0).toUpperCase() + words.slice(1);
}

function isEmpty(value: unknown): boolean {
	return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

export function draftErrors(catalog: Catalog, draft: FlowDraft): string[] {
	const errors: string[] = [];
	if (!draft.name.trim()) errors.push("Give the automation a name.");
	if (!draft.trigger_type || !triggerOf(catalog, draft.trigger_type)) errors.push("Choose what starts the automation.");
	if (draft.steps.length === 0) errors.push("Add at least one step.");
	if (draft.steps.length > MAX_STEPS) errors.push(`An automation can have ${MAX_STEPS} steps at most.`);
	draft.steps.slice(0, MAX_STEPS).forEach((step, i) => {
		const action = actionOf(catalog, step.tool);
		const where = `Step ${i + 1}`;
		if (!action) {
			errors.push(`${where}: this action is not available.`);
			return;
		}
		for (const key of action.params.required ?? []) {
			if (isEmpty(step.params[key])) errors.push(`${where}: ${paramLabel(key)} is required.`);
		}
		const vars = variablesAt(catalog, draft.trigger_type, draft.steps, i);
		for (const value of Object.values(step.params)) {
			if (typeof value !== "string") continue;
			for (const token of unknownTokens(value, vars)) errors.push(`${where}: {{${token}}} doesn't exist here.`);
		}
	});
	return errors;
}

/** `https://nova.ondesk.cc/api/automations/<path>?…`; `path` vacío = la colección. */
export function automationsUrl(novaHost: string, path: string, params: Record<string, string>): string {
	const qs = new URLSearchParams(params).toString();
	return `${novaOrigin(novaHost)}/api/automations${path ? `/${path}` : ""}${qs ? `?${qs}` : ""}`;
}

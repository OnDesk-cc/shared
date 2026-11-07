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
import { INTL_TAG, type Locale } from "../../i18n/locale";
import { interpolate } from "../../i18n/format";
import { SHARED_STRINGS } from "../../i18n/strings";
import { paramText } from "./catalog-i18n";

// Los textos para la persona salen del diccionario de shared. Cada función que
// devuelve uno acepta un `locale` final, opcional y `en` por defecto. Las
// etiquetas del catálogo (disparadores, acciones, campos) llegan del manifiesto
// de cada app y aquí pasan tal cual.
const A = (locale: Locale) => SHARED_STRINGS[locale].automations;

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


const TOKEN = /\{\{\s*((?:trigger|change|actor|step\d+)\.[a-z_]+)\s*\}\}/g;

function triggerOf(catalog: Catalog, type: string): CatalogTrigger | null {
	return catalog.triggers.find((t) => t.type === type) ?? null;
}

function actionOf(catalog: Catalog, tool: string): CatalogAction | null {
	return catalog.actions.find((a) => a.tool === tool) ?? null;
}

export function variablesAt(catalog: Catalog, triggerType: string, steps: { tool: string }[], stepIndex: number, locale: Locale = "en"): Variable[] {
	const a = A(locale);
	const outputs: Record<string, string> = a.outputs;
	const trigger = triggerOf(catalog, triggerType);
	const vars: Variable[] = [];
	if (trigger) {
		for (const f of trigger.fields) vars.push({ token: `trigger.${f.key}`, label: f.label, group: trigger.label });
		for (const f of trigger.change ?? []) vars.push({ token: `change.${f.key}`, label: f.label, group: a.whatChanged });
	}
	vars.push({ token: "actor.name", label: a.actorName, group: a.whoDidIt }, { token: "actor.email", label: a.actorEmail, group: a.whoDidIt });
	steps.slice(0, Math.max(0, stepIndex)).forEach((step, i) => {
		const action = actionOf(catalog, step.tool);
		const group = action ? interpolate(a.stepGroup, { n: i + 1, action: action.label }) : interpolate(a.step, { n: i + 1 });
		for (const key of STEP_OUTPUTS[step.tool] ?? []) vars.push({ token: `step${i + 1}.${key}`, label: outputs[key] ?? key, group });
	});
	return vars;
}

export function flowSentence(catalog: Catalog, flow: { trigger_type: string; steps: { tool: string }[] }, locale: Locale = "en"): string {
	const a = A(locale);
	const trigger = triggerOf(catalog, flow.trigger_type);
	const head = trigger ? interpolate(a.whenTrigger, { trigger: trigger.label }) : a.unknownTrigger;
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

/** «assignee_email» → «Assignee»: el rótulo de un parámetro en el editor. */
export function paramLabel(key: string): string {
	const words = key.replace(/_email$/, "").replace(/_/g, " ");
	return words.charAt(0).toUpperCase() + words.slice(1);
}

function isEmpty(value: unknown): boolean {
	return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

/** «Step 2: Project is required.»: la misma frase la busca el editor del paso para marcar su campo. */
export function paramRequiredError(stepNumber: number, key: string, locale: Locale = "en"): string {
	return interpolate(A(locale).errors.paramRequired, { n: stepNumber, param: paramText(key, locale) });
}

export function draftErrors(catalog: Catalog, draft: FlowDraft, locale: Locale = "en"): string[] {
	const e = A(locale).errors;
	const errors: string[] = [];
	if (!draft.name.trim()) errors.push(e.name);
	if (!draft.trigger_type || !triggerOf(catalog, draft.trigger_type)) errors.push(e.trigger);
	if (draft.steps.length === 0) errors.push(e.noSteps);
	if (draft.steps.length > MAX_STEPS) errors.push(interpolate(e.tooManySteps, { max: MAX_STEPS }));
	draft.steps.slice(0, MAX_STEPS).forEach((step, i) => {
		const action = actionOf(catalog, step.tool);
		if (!action) {
			errors.push(interpolate(e.actionGone, { n: i + 1 }));
			return;
		}
		for (const key of action.params.required ?? []) {
			if (isEmpty(step.params[key])) errors.push(paramRequiredError(i + 1, key, locale));
		}
		const vars = variablesAt(catalog, draft.trigger_type, draft.steps, i, locale);
		for (const value of Object.values(step.params)) {
			if (typeof value !== "string") continue;
			for (const token of unknownTokens(value, vars)) errors.push(interpolate(e.unknownToken, { n: i + 1, token: `{{${token}}}` }));
		}
	});
	return errors;
}

/** `https://nova.ondesk.cc/api/automations/<path>?…`; `path` vacío = la colección. */
export function automationsUrl(novaHost: string, path: string, params: Record<string, string>): string {
	const qs = new URLSearchParams(params).toString();
	return `${novaOrigin(novaHost)}/api/automations${path ? `/${path}` : ""}${qs ? `?${qs}` : ""}`;
}

// ── Lo que dicen la lista y el historial ────────────────────────────────────

export type ToneWord = "neutral" | "accent" | "warning" | "danger" | "success";

/** La app donde empieza y las apps donde actúa (sin repetir, en el orden de los pasos): la ruta de baldosas de una fila. */
export function flowProducts(catalog: Catalog, flow: { trigger_product: AutomationProduct; steps: { tool: string }[] }): { from: AutomationProduct; to: AutomationProduct[] } {
	const to: AutomationProduct[] = [];
	for (const step of flow.steps) {
		const product = actionOf(catalog, step.tool)?.product ?? (step.tool.split(".")[0] as AutomationProduct);
		if (!to.includes(product)) to.push(product);
	}
	return { from: flow.trigger_product, to };
}

/** Las frases de la línea pequeña de una fila, con «. » entre ellas y sin el punto final de cada una (una ya lo trae). */
export function joinSentences(parts: (string | null | undefined)[]): string {
	return parts
		.filter((p): p is string => !!p)
		.map((p) => p.replace(/\.+$/, ""))
		.join(". ");
}

const PAUSED_TONE: Record<PausedReason, ToneWord> = { manual: "neutral", failing: "danger", owner_left: "danger", plan_limit: "warning" };

/** El estado de una automatización como palabra, tono y, si está pausada, por qué. */
export function statusLine(flow: { status: FlowStatus; paused_reason: PausedReason | null }, locale: Locale = "en"): { tone: ToneWord; label: string; detail: string | null } {
	const a = A(locale);
	if (flow.status === "active") return { tone: "success", label: a.active, detail: null };
	const why = flow.paused_reason ?? "manual";
	return { tone: PAUSED_TONE[why], label: a.paused, detail: a.pausedWhy[why] };
}

const OUTCOME_TONE: Record<FlowOutcome | "running", ToneWord> = { done: "success", failed: "danger", unknown: "warning", skipped: "neutral", running: "accent" };

export function outcomeLine(outcome: FlowOutcome | "running", locale: Locale = "en"): { tone: ToneWord; label: string } {
	return { tone: OUTCOME_TONE[outcome], label: A(locale).outcomes[outcome] };
}

/** El motivo de una ejecución en una frase; uno que no se conoce se enseña tal cual. */
export function reasonText(reason: string | null, locale: Locale = "en"): string {
	if (!reason) return "";
	const reasons: Record<string, string> = A(locale).reasons;
	return Object.hasOwn(reasons, reason) ? reasons[reason] : reason;
}

/** «Just now», «5 min ago», «3 h ago», o la fecha: la columna de cuándo del historial. */
export function ago(unixSec: number, nowSec: number = Math.floor(Date.now() / 1000), locale: Locale = "en"): string {
	const a = A(locale);
	const d = Math.max(0, nowSec - unixSec);
	if (d < 60) return a.justNow;
	if (d < 3600) return interpolate(a.minutesAgo, { n: Math.floor(d / 60) });
	if (d < 86_400) return interpolate(a.hoursAgo, { n: Math.floor(d / 3600) });
	return new Date(unixSec * 1000).toLocaleDateString(INTL_TAG[locale], { month: "short", day: "numeric", year: "numeric" });
}

// ── Condiciones ─────────────────────────────────────────────────────────────

export interface ConditionField {
	field: string;
	label: string;
	group: string;
	type: NovaTriggerDef["fields"][number]["type"];
	options?: { value: string; label: string }[];
}

/** Lo que se puede comparar en «Only if»: el objeto, el cambio y quién lo hizo. */
export function conditionFields(trigger: CatalogTrigger, locale: Locale = "en"): ConditionField[] {
	const a = A(locale);
	return [
		...trigger.fields.map((f) => ({ field: `trigger.${f.key}`, label: f.label, group: trigger.label, type: f.type, options: f.options })),
		...(trigger.change ?? []).map((f) => ({ field: `change.${f.key}`, label: f.label, group: a.whatChanged, type: f.type, options: f.options })),
		{ field: "actor.email", label: a.actorEmail, group: a.whoDidIt, type: "text" as const },
		{ field: "actor.is_automation", label: a.anotherAutomation, group: a.whoDidIt, type: "bool" as const },
	];
}

const OPS_BY_TYPE: Record<string, FlowOp[]> = {
	text: ["eq", "neq", "contains", "not_contains", "is_empty", "is_not_empty"],
	link: ["eq", "neq", "contains", "not_contains", "is_empty", "is_not_empty"],
	person: ["eq", "neq", "is_empty", "is_not_empty"],
	enum: ["eq", "neq", "is_empty", "is_not_empty"],
	number: ["eq", "neq", "gt", "lt"],
	date: ["eq", "neq", "is_empty", "is_not_empty"],
	bool: ["eq"],
};

export function opsFor(type: ConditionField["type"], locale: Locale = "en"): { op: FlowOp; label: string }[] {
	const labels = A(locale).ops;
	return (OPS_BY_TYPE[type] ?? OPS_BY_TYPE.text).map((op) => ({ op, label: labels[op] }));
}

export function needsValue(op: FlowOp): boolean {
	return op !== "is_empty" && op !== "is_not_empty";
}

// ── Los parámetros de un paso ───────────────────────────────────────────────

const LONG_PARAMS = new Set(["description", "body", "content"]);

/** Qué control lleva un parámetro: un selector alimentado por la app, un desplegable fijo, un texto largo o uno corto. */
export function paramControl(key: string, schema: JsonSchema): "options" | "enum" | "long" | "text" {
	if (schema["x-options"]) return "options";
	if (schema.enum?.length) return "enum";
	if (LONG_PARAMS.has(key) || (schema.maxLength ?? 0) > 1000) return "long";
	return "text";
}

/** Si el control tiene una lista a la que volver desde «Use a variable…» (los de texto no). */
export function hasList(control: ReturnType<typeof paramControl>): boolean {
	return control === "options" || control === "enum";
}

/** Los parámetros que el editor enseña, en el orden del esquema: nunca listas ni objetos (los internos de las apps). */
export function visibleParams(schema: JsonSchema): string[] {
	return Object.entries(schema.properties ?? {})
		.filter(([, s]) => s.type !== "array" && s.type !== "object")
		.map(([key]) => key);
}

// El modelo del editor de automatizaciones (2026-10-21): `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
	ago,
	automationsUrl,
	conditionFields,
	defaultParams,
	joinSentences,
	hasList,
	needsValue,
	paramControl,
	paramLabel,
	visibleParams,
	opsFor,
	draftErrors,
	flowProducts,
	flowSentence,
	outcomeLine,
	reasonText,
	statusLine,
	MAX_STEPS,
	splitTemplate,
	unknownTokens,
	variablesAt,
	type Catalog,
	type FlowDraft,
} from "./automations-model.ts";

const catalog: Catalog = {
	triggers: [
		{
			product: "pulse",
			type: "pulse.ticket.created",
			label: "Ticket created",
			description: "A ticket is created",
			resource_kind: "ticket",
			subject_tool: "pulse.automation_subject",
			fields: [
				{ key: "number", label: "Number", type: "number" },
				{ key: "subject", label: "Subject", type: "text" },
				{ key: "link", label: "Link", type: "link" },
			],
		},
		{
			product: "orbit",
			type: "orbit.task.status_changed",
			label: "Task status changed",
			description: "",
			resource_kind: "task",
			subject_tool: "orbit.automation_subject",
			fields: [{ key: "ref", label: "Reference", type: "text" }],
			change: [{ key: "to_status", label: "New status", type: "enum" }],
		},
	],
	actions: [
		{
			tool: "orbit.create_task",
			product: "orbit",
			label: "Create task",
			description: "",
			params: {
				type: "object",
				required: ["project", "title"],
				properties: { project: { type: "string", "x-options": "orbit.projects" }, title: { type: "string", maxLength: 200 }, description: { type: "string" } },
			},
		},
		{
			tool: "pulse.update_ticket",
			product: "pulse",
			label: "Update ticket",
			description: "",
			params: { type: "object", required: ["ticket"], properties: { ticket: { type: "integer" }, status: { type: "string", enum: ["open", "pending", "resolved"] } } },
		},
		{
			tool: "nexus.post_message",
			product: "nexus",
			label: "Post message",
			description: "",
			params: { type: "object", required: ["channel", "body"], properties: { channel: { type: "string" }, body: { type: "string" } } },
		},
	],
};

const tokens = (vars: { token: string }[]) => vars.map((v) => v.token);

test("variablesAt en el paso 1: las del disparador y las de quién lo hizo, sin pasos", () => {
	const vars = variablesAt(catalog, "pulse.ticket.created", [{ tool: "orbit.create_task" }], 0);
	assert.deepEqual(tokens(vars), ["trigger.number", "trigger.subject", "trigger.link", "actor.name", "actor.email"]);
	assert.equal(vars[1].label, "Subject");
});

test("variablesAt suma los campos del cambio", () => {
	assert.ok(tokens(variablesAt(catalog, "orbit.task.status_changed", [], 0)).includes("change.to_status"));
});

test("variablesAt en el paso 2 suma step1.ref y step1.link de orbit.create_task", () => {
	const vars = tokens(variablesAt(catalog, "pulse.ticket.created", [{ tool: "orbit.create_task" }, { tool: "nexus.post_message" }], 1));
	assert.ok(vars.includes("step1.ref"));
	assert.ok(vars.includes("step1.link"));
	assert.ok(vars.includes("step1.title"));
	assert.ok(!vars.some((t) => t.startsWith("step2.")));
});

test("flowSentence nombra el disparador y cada paso con su app", () => {
	assert.equal(flowSentence(catalog, { trigger_type: "pulse.ticket.created", steps: [{ tool: "orbit.create_task" }] }), "When Ticket created → Create task (Orbit)");
	assert.equal(
		flowSentence(catalog, { trigger_type: "pulse.ticket.created", steps: [{ tool: "orbit.create_task" }, { tool: "nexus.post_message" }] }),
		"When Ticket created → Create task (Orbit) → Post message (Nexus)",
	);
	assert.equal(flowSentence(catalog, { trigger_type: "x.y.z", steps: [] }), "When an unknown trigger fires");
});

test("splitTemplate parte el texto en trozos y variables", () => {
	assert.deepEqual(splitTemplate("Hi {{trigger.subject}}!"), [
		{ kind: "text", value: "Hi " },
		{ kind: "var", token: "trigger.subject" },
		{ kind: "text", value: "!" },
	]);
	assert.deepEqual(splitTemplate("{{ step1.ref }}"), [{ kind: "var", token: "step1.ref" }]);
	assert.deepEqual(splitTemplate("{{ bad"), [{ kind: "text", value: "{{ bad" }]);
	assert.deepEqual(splitTemplate("{{nope.x}}"), [{ kind: "text", value: "{{nope.x}}" }]);
	assert.deepEqual(splitTemplate(""), []);
});

test("unknownTokens encuentra {{step3.ref}} en el paso 2", () => {
	const vars = variablesAt(catalog, "pulse.ticket.created", [{ tool: "orbit.create_task" }, { tool: "nexus.post_message" }], 1);
	assert.deepEqual(unknownTokens("See {{step1.link}} and {{step3.ref}}", vars), ["step3.ref"]);
});

test("defaultParams: el ticket del disparador en pulse.update_ticket", () => {
	const trigger = catalog.triggers[0];
	assert.deepEqual(defaultParams(catalog.actions[1], trigger), { ticket: "{{trigger.number}}" });
	assert.deepEqual(defaultParams(catalog.actions[0], trigger), {});
});

const good: FlowDraft = {
	name: "Ticket → task",
	trigger_type: "pulse.ticket.created",
	conditions: { match: "all", rules: [] },
	steps: [{ tool: "orbit.create_task", params: { project: "ENG", title: "{{trigger.subject}}" } }],
};

test("draftErrors: la automatización de referencia no tiene errores", () => {
	assert.deepEqual(draftErrors(catalog, good), []);
});

test("draftErrors: sin nombre, sin disparador, sin pasos, más de 5, variable desconocida, obligatorio vacío", () => {
	assert.equal(MAX_STEPS, 5);
	assert.ok(draftErrors(catalog, { ...good, name: " " }).some((e) => /name/i.test(e)));
	assert.ok(draftErrors(catalog, { ...good, trigger_type: "" }).some((e) => /starts/i.test(e)));
	assert.ok(draftErrors(catalog, { ...good, steps: [] }).some((e) => /at least one step/i.test(e)));
	assert.ok(draftErrors(catalog, { ...good, steps: Array.from({ length: 6 }, () => good.steps[0]) }).some((e) => /5 steps/i.test(e)));
	assert.ok(draftErrors(catalog, { ...good, steps: [{ tool: "orbit.create_task", params: { project: "ENG", title: "{{step2.ref}}" } }] }).some((e) => e.includes("step2.ref")));
	assert.ok(draftErrors(catalog, { ...good, steps: [{ tool: "orbit.create_task", params: { project: "", title: "x" } }] }).some((e) => /Project/i.test(e)));
	assert.ok(draftErrors(catalog, { ...good, steps: [{ tool: "orbit.delete_task", params: {} }] }).some((e) => /not available/i.test(e)));
});

test("automationsUrl: http sólo en local, la ruta y los parámetros", () => {
	assert.equal(automationsUrl("127.0.0.1:8787", "catalog", { workspace: "w" }), "http://127.0.0.1:8787/api/automations/catalog?workspace=w");
	assert.equal(automationsUrl("nova.ondesk.cc", "", { workspace: "w 1", product: "orbit" }), "https://nova.ondesk.cc/api/automations?workspace=w+1&product=orbit");
	assert.equal(automationsUrl("nova.ondesk.cc", "f1/pause", { workspace: "w" }), "https://nova.ondesk.cc/api/automations/f1/pause?workspace=w");
});

test("flowProducts: la app del disparador y las de los pasos, sin repetir", () => {
	assert.deepEqual(flowProducts(catalog, { trigger_product: "pulse", steps: [{ tool: "orbit.create_task" }, { tool: "nexus.post_message" }, { tool: "orbit.create_task" }] }), {
		from: "pulse",
		to: ["orbit", "nexus"],
	});
	assert.deepEqual(flowProducts(catalog, { trigger_product: "pulse", steps: [{ tool: "pulse.update_ticket" }] }), { from: "pulse", to: ["pulse"] });
});

test("statusLine: activa, o pausada con su motivo en palabras", () => {
	assert.deepEqual(statusLine({ status: "active", paused_reason: null }), { tone: "success", label: "Active", detail: null });
	assert.equal(statusLine({ status: "paused", paused_reason: "failing" }).tone, "danger");
	assert.match(String(statusLine({ status: "paused", paused_reason: "failing" }).detail), /failed 3 times/);
	assert.match(String(statusLine({ status: "paused", paused_reason: "owner_left" }).detail), /no longer/);
	assert.match(String(statusLine({ status: "paused", paused_reason: "plan_limit" }).detail), /plan/);
	assert.equal(statusLine({ status: "paused", paused_reason: "manual" }).tone, "neutral");
});

test("outcomeLine: cada resultado con su palabra y su tono", () => {
	assert.deepEqual(outcomeLine("done"), { tone: "success", label: "Done" });
	assert.deepEqual(outcomeLine("failed"), { tone: "danger", label: "Failed" });
	assert.deepEqual(outcomeLine("unknown"), { tone: "warning", label: "Check it" });
	assert.deepEqual(outcomeLine("skipped"), { tone: "neutral", label: "Skipped" });
	assert.deepEqual(outcomeLine("running"), { tone: "accent", label: "Running" });
});

test("reasonText traduce los motivos del motor", () => {
	assert.match(reasonText("not_visible"), /can't see/);
	assert.match(reasonText("chain"), /chain/);
	assert.match(reasonText("stale"), /24 hours/);
	assert.equal(reasonText("whatever the engine said"), "whatever the engine said");
	assert.equal(reasonText(null), "");
});

test("ago: hace segundos, minutos, horas o una fecha", () => {
	const now = 1_800_000_000;
	assert.equal(ago(now - 20, now), "Just now");
	assert.equal(ago(now - 5 * 60, now), "5 min ago");
	assert.equal(ago(now - 3 * 3600, now), "3 h ago");
	assert.match(ago(now - 9 * 86_400, now), /2027/);
});

test("conditionFields: los del objeto, los del cambio y los de quién lo hizo", () => {
	const fields = conditionFields(catalog.triggers[1]);
	assert.deepEqual(
		fields.map((f) => f.field),
		["trigger.ref", "change.to_status", "actor.email", "actor.is_automation"],
	);
	assert.equal(fields.find((f) => f.field === "actor.is_automation")?.type, "bool");
});

test("opsFor: cada tipo con sus operadores", () => {
	assert.deepEqual(opsFor("text").map((o) => o.op), ["eq", "neq", "contains", "not_contains", "is_empty", "is_not_empty"]);
	assert.deepEqual(opsFor("number").map((o) => o.op), ["eq", "neq", "gt", "lt"]);
	assert.deepEqual(opsFor("enum").map((o) => o.op), ["eq", "neq", "is_empty", "is_not_empty"]);
	assert.deepEqual(opsFor("bool").map((o) => o.op), ["eq"]);
	assert.equal(needsValue("is_empty"), false);
	assert.equal(needsValue("contains"), true);
});

test("paramControl: selector con opciones, desplegable de enum, texto largo o texto", () => {
	assert.equal(paramControl("project", { type: "string", "x-options": "orbit.projects" }), "options");
	assert.equal(paramControl("status", { type: "string", enum: ["open", "pending"] }), "enum");
	assert.equal(paramControl("description", { type: "string", maxLength: 4000 }), "long");
	assert.equal(paramControl("body", { type: "string" }), "long");
	assert.equal(paramControl("title", { type: "string", maxLength: 200 }), "text");
	assert.equal(paramControl("ticket", { type: "integer" }), "text");
});

test("paramLabel: legible y sin _email", () => {
	assert.equal(paramLabel("assignee_email"), "Assignee");
	assert.equal(paramLabel("due"), "Due");
	assert.equal(paramLabel("project"), "Project");
});

test("visibleParams: los del esquema en su orden, sin los que no son texto ni número", () => {
	assert.deepEqual(visibleParams({ type: "object", properties: { a: { type: "string" }, b: { type: "array" }, c: { type: "integer" }, d: { type: "boolean" } } }), ["a", "c", "d"]);
});

test("joinSentences: une las frases de una fila sin dobles puntos", () => {
	assert.equal(
		joinSentences(["When Ticket created → Create task (Orbit)", "It failed 3 times in a row. Check the last runs, then resume it.", null, "3 runs this week"]),
		"When Ticket created → Create task (Orbit). It failed 3 times in a row. Check the last runs, then resume it. 3 runs this week",
	);
	assert.equal(joinSentences([undefined, ""]), "");
});

test("hasList: sólo una lista o un enum se pueden devolver a «Pick from the list»", () => {
	assert.equal(hasList(paramControl("project", { type: "string", "x-options": "orbit.projects" })), true);
	assert.equal(hasList(paramControl("status", { type: "string", enum: ["todo"] })), true);
	assert.equal(hasList(paramControl("title", { type: "string" })), false);
	assert.equal(hasList(paramControl("description", { type: "string", maxLength: 4000 })), false);
});

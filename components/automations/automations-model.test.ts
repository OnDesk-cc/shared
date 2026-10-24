// El modelo del editor de automatizaciones (2026-10-21): `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
	automationsUrl,
	defaultParams,
	draftErrors,
	flowSentence,
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

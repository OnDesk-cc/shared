// El catálogo de automatizaciones en el idioma de quien lee: `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { catalogText, localizeCatalog, paramText } from "./catalog-i18n.ts";
import type { Catalog } from "./automations-model.ts";

const catalog = {
	triggers: [
		{
			type: "orbit.task.status_changed",
			product: "orbit",
			label: "Task status changed",
			description: "A task moves to another column, including done.",
			resource_kind: "task",
			subject_tool: "orbit.automation_subject",
			fields: [{ key: "priority", label: "Priority", type: "enum", options: [{ value: "urgent", label: "Urgent" }] }],
			change: [{ key: "to_status", label: "New status", type: "enum", options: [{ value: "done", label: "Done" }] }],
		},
		{ type: "lumen.thing.made", product: "orbit", label: "Thing made", description: "New.", resource_kind: "thing", subject_tool: "x", fields: [{ key: "shape", label: "Shape", type: "text" }] },
	],
	actions: [{ tool: "orbit.create_task", product: "orbit", label: "Create task", description: "…", params: { type: "object" } }],
} as unknown as Catalog;

test("en portugués: disparador, campos, opciones y acciones traducidos; lo desconocido, como llegó", () => {
	const pt = localizeCatalog(catalog, "pt");
	assert.equal(pt.triggers[0].label, "Status da tarefa mudou");
	assert.equal(pt.triggers[0].fields[0].label, "Prioridade");
	assert.equal(pt.triggers[0].fields[0].options?.[0].label, "Urgente");
	assert.equal(pt.triggers[0].change?.[0].options?.[0].label, "Concluída");
	assert.equal(pt.actions[0].label, "Criar tarefa");
	assert.equal(pt.triggers[1].label, "Thing made");
	assert.equal(pt.triggers[1].fields[0].label, "Shape");
	assert.equal(pt.triggers[0].type, "orbit.task.status_changed");
});

test("en inglés el catálogo no cambia; parámetros y valores de enum por su texto", () => {
	assert.equal(localizeCatalog(catalog, "en"), catalog);
	assert.equal(paramText("assignee_email", "es"), "Responsable");
	assert.equal(paramText("start_utc", "pt"), "Início (UTC)");
	assert.equal(catalogText("in progress", "es"), "en curso");
	assert.equal(catalogText("weird value", "es"), "weird value");
});

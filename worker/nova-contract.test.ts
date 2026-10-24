// La identidad de una ejecución automática de Nova (fase 4): `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
	agentSubject,
	AUTOMATION_EVENT_DATA_MAX_CHARS,
	FLOW_ORIGIN_PREFIX,
	flowOrigin,
	NOVA_AGENT_PREFIX,
	parseAgentSubject,
	parseFlowOrigin,
	parseResource,
	ticketResource,
	viaOfOrigin,
} from "./nova-contract.ts";

test("agentSubject y parseAgentSubject van y vuelven", () => {
	assert.equal(NOVA_AGENT_PREFIX, "nova:agent:");
	assert.equal(agentSubject("a1"), "nova:agent:a1");
	assert.equal(parseAgentSubject(agentSubject("a1")), "a1");
	const uuid = "0f8fad5b-d9cb-469f-a165-70867728950e";
	assert.equal(parseAgentSubject(agentSubject(uuid)), uuid);
	assert.equal(parseAgentSubject(`nova:agent:${"a".repeat(64)}`), "a".repeat(64));
});

test("parseAgentSubject: una persona, el indexador u otro nova: no son un agente", () => {
	for (const sub of [
		"u1",
		"nova:indexer",
		"nova:ws1",
		"nova:agent:",
		"nova:agentx:a1",
		"NOVA:AGENT:a1",
		"nova:agent:a1:extra",
		"nova:agent:a b",
		`nova:agent:${"a".repeat(65)}`,
		"x nova:agent:a1",
	]) {
		assert.equal(parseAgentSubject(sub), null, sub);
	}
});

test("ticketResource y parseResource van y vuelven", () => {
	assert.equal(ticketResource("9f2c"), "pulse:ticket:9f2c");
	assert.deepEqual(parseResource(ticketResource("9f2c")), { product: "pulse", kind: "ticket", id: "9f2c" });
	assert.deepEqual(parseResource("orbit:task:t_1-A"), { product: "orbit", kind: "task", id: "t_1-A" });
});

test("parseResource: sólo <product>:<kind>:<id>, con las tres partes llenas", () => {
	for (const resource of [
		"",
		"pulse",
		"pulse:ticket",
		"pulse:ticket:",
		":ticket:t1",
		"pulse::t1",
		"pulse:ticket:t1:extra",
		"Pulse:ticket:t1",
		"pulse:Ticket:t1",
		"pulse:ticket:t 1",
		"pulse:ticket:../t1",
		`pulse:ticket:${"a".repeat(129)}`,
	]) {
		assert.equal(parseResource(resource), null, resource);
	}
	assert.deepEqual(parseResource(`pulse:ticket:${"a".repeat(128)}`), { product: "pulse", kind: "ticket", id: "a".repeat(128) });
});

// ── Automatizaciones (2026-10-21, spec ondesk/docs/specs/2026-10-21-automatizaciones.md) ──

test("flowOrigin y parseFlowOrigin van y vuelven", () => {
	assert.equal(FLOW_ORIGIN_PREFIX, "flow:");
	assert.equal(flowOrigin("f1", "r1"), "flow:f1:r1");
	assert.deepEqual(parseFlowOrigin("flow:f1:r1"), { flowId: "f1", runId: "r1" });
	const run = "0123456789abcdef0123456789abcdef";
	assert.deepEqual(parseFlowOrigin(flowOrigin("f_1-A", run)), { flowId: "f_1-A", runId: run });
});

test("parseFlowOrigin: sólo flow:<id>:<id>", () => {
	for (const origin of [null, "", "chat:x", "run:r1", "flow:", "flow:a", "flow:a:", "flow::b", "flow:a:b:c", "flow:a b:c", `flow:${"a".repeat(65)}:b`, "FLOW:a:b"]) {
		assert.equal(parseFlowOrigin(origin), null, String(origin));
	}
});

test("viaOfOrigin: automation sólo para una automatización", () => {
	assert.equal(viaOfOrigin("flow:a:b"), "automation");
	assert.equal(viaOfOrigin("chat:x"), "nova");
	assert.equal(viaOfOrigin("run:r1"), "nova");
	assert.equal(viaOfOrigin(null), "nova");
	assert.equal(AUTOMATION_EVENT_DATA_MAX_CHARS, 2048);
});

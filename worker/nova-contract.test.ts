// La identidad de una ejecución automática de Nova (fase 4): `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { agentSubject, NOVA_AGENT_PREFIX, parseAgentSubject, parseResource, ticketResource } from "./nova-contract.ts";

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

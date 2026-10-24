// El cliente de la API de automatizaciones (2026-10-21): `npm test`.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { automationsApi, AutomationsError, automationsKeys } from "./automations-api.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
});

function answer(status: number, body: unknown) {
	const seen: { url: string; init: RequestInit }[] = [];
	globalThis.fetch = (async (url: string, init: RequestInit) => {
		seen.push({ url, init });
		return status === 204 ? new Response(null, { status }) : new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
	}) as unknown as typeof fetch;
	return seen;
}

test("list manda la cookie y devuelve las automatizaciones", async () => {
	const seen = answer(200, { automations: [{ id: "f1" }] });
	const list = await automationsApi.list("nova.test", "ws1", "orbit");
	assert.deepEqual(list, [{ id: "f1" }]);
	assert.equal(seen[0].url, "https://nova.test/api/automations?workspace=ws1&product=orbit");
	assert.equal(seen[0].init.credentials, "include");
});

test("un error lanza AutomationsError con status y code", async () => {
	answer(402, { error: "Your plan allows 2 automations.", code: "plan_limit" });
	await assert.rejects(automationsApi.create("nova.test", "ws1", { name: "x" } as never), (err: unknown) => {
		assert.ok(err instanceof AutomationsError);
		assert.equal(err.status, 402);
		assert.equal(err.code, "plan_limit");
		assert.equal(err.message, "Your plan allows 2 automations.");
		return true;
	});
});

test("un error sin cuerpo JSON lanza un mensaje genérico", async () => {
	globalThis.fetch = (async () => new Response("<html>", { status: 503 })) as unknown as typeof fetch;
	await assert.rejects(automationsApi.catalog("nova.test", "ws1"), (err: unknown) => err instanceof AutomationsError && err.status === 503 && err.code === null);
});

test("remove devuelve undefined con un 204 y usa DELETE", async () => {
	const seen = answer(204, null);
	assert.equal(await automationsApi.remove("nova.test", "ws1", "f1"), undefined);
	assert.equal(seen[0].init.method, "DELETE");
	assert.equal(seen[0].url, "https://nova.test/api/automations/f1?workspace=ws1");
});

test("update manda confirm_owner en el cuerpo", async () => {
	const seen = answer(200, { automation: { id: "f1" } });
	await automationsApi.update("nova.test", "ws1", "f1", { name: "y" }, { confirmOwner: true });
	assert.equal(seen[0].init.method, "PATCH");
	assert.deepEqual(JSON.parse(String(seen[0].init.body)), { name: "y", confirm_owner: true });
});

test("las claves de caché empiezan por el workspace", () => {
	assert.deepEqual(automationsKeys.all("ws1"), ["automations", "ws1"]);
	assert.deepEqual(automationsKeys.list("ws1", "orbit"), ["automations", "ws1", "list", "orbit"]);
	assert.deepEqual(automationsKeys.runs("ws1"), ["automations", "ws1", "runs", "all"]);
});

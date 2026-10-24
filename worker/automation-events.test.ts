// La bandeja de eventos de automatización de un producto (2026-10-21): `npm test`.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { openTestDb } from "../test/sqlite-d1.mjs";
import {
	AUTOMATION_EVENTS_MAX_LIMIT,
	AUTOMATION_EVENTS_RETENTION_SECONDS,
	AUTOMATION_EVENTS_SQL,
	automationEventsTool,
	enqueueAutomationEvents,
	pokeNovaFor,
	purgeAutomationEvents,
	readAutomationEvents,
	type AutomationEventInput,
} from "./automation-events.ts";

const realFetch = globalThis.fetch;
const realError = console.error;
afterEach(() => {
	globalThis.fetch = realFetch;
	console.error = realError;
});

function setup() {
	const { db, raw } = openTestDb(AUTOMATION_EVENTS_SQL);
	return { db: db as unknown as D1Database, raw };
}

const created: AutomationEventInput = {
	type: "orbit.task.created",
	workspaceId: "ws1",
	resource: "orbit:task:t1",
	actorId: "u1",
	origin: null,
};

test("enqueue escribe las filas con data en JSON y devuelve cuántas", async () => {
	const { db, raw } = setup();
	const n = await enqueueAutomationEvents(db, [created, { ...created, type: "orbit.task.status_changed", data: { from_status: "todo", to_status: "done" }, origin: "flow:f1:r1" }]);
	assert.equal(n, 2);
	const rows = raw.prepare("SELECT * FROM automation_events ORDER BY seq").all() as Record<string, unknown>[];
	assert.equal(rows.length, 2);
	assert.equal(rows[0].data, "{}");
	assert.equal(rows[0].actor_id, "u1");
	assert.equal(rows[0].origin, null);
	assert.equal(rows[1].data, JSON.stringify({ from_status: "todo", to_status: "done" }));
	assert.equal(rows[1].origin, "flow:f1:r1");
	assert.match(String(rows[0].id), /^[0-9a-f-]{36}$/);
	assert.notEqual(rows[0].id, rows[1].id);
});

test("enqueue de una lista vacía no escribe y devuelve 0", async () => {
	const { db, raw } = setup();
	assert.equal(await enqueueAutomationEvents(db, []), 0);
	assert.equal((raw.prepare("SELECT COUNT(*) AS n FROM automation_events").get() as { n: number }).n, 0);
});

test("enqueue guarda {} cuando data no cabe en 2048 caracteres, y lo avisa", async () => {
	const { db, raw } = setup();
	const logged: unknown[] = [];
	console.error = (...args: unknown[]) => logged.push(args);
	await enqueueAutomationEvents(db, [{ ...created, data: { excerpt: "x".repeat(3000) } }]);
	const row = raw.prepare("SELECT data FROM automation_events").get() as { data: string };
	assert.equal(row.data, "{}");
	assert.equal(logged.length, 1);
});

test("enqueue nunca lanza: sin la tabla devuelve 0", async () => {
	const { db } = openTestDb("SELECT 1;");
	console.error = () => {};
	assert.equal(await enqueueAutomationEvents(db as unknown as D1Database, [created]), 0);
});

test("read devuelve los eventos después del cursor en orden, con data como objeto y has_more", async () => {
	const { db } = setup();
	await enqueueAutomationEvents(db, [created, { ...created, data: { comment_id: "c1" } }, created]);
	const first = await readAutomationEvents(db, 0, 2);
	assert.equal(first.events.length, 2);
	assert.equal(first.has_more, true);
	assert.deepEqual(first.events[1].data, { comment_id: "c1" });
	assert.equal(first.events[0].workspace_id, "ws1");
	assert.equal(first.events[0].resource, "orbit:task:t1");
	assert.equal(first.next_after, first.events[1].seq);
	const rest = await readAutomationEvents(db, first.next_after, 2);
	assert.equal(rest.events.length, 1);
	assert.equal(rest.has_more, false);
	const empty = await readAutomationEvents(db, rest.next_after, 2);
	assert.deepEqual(empty, { events: [], next_after: rest.next_after, has_more: false });
});

test("read recorta el límite a 100", async () => {
	const { db } = setup();
	assert.equal(AUTOMATION_EVENTS_MAX_LIMIT, 100);
	await enqueueAutomationEvents(db, Array.from({ length: 101 }, () => created));
	const page = await readAutomationEvents(db, 0, 500);
	assert.equal(page.events.length, 100);
	assert.equal(page.has_more, true);
});

test("purge borra los eventos de más de 3 días", async () => {
	const { db, raw } = setup();
	const now = 2_000_000_000;
	assert.equal(AUTOMATION_EVENTS_RETENTION_SECONDS, 3 * 86_400);
	raw.prepare("INSERT INTO automation_events (id, type, workspace_id, resource, created_at) VALUES ('old', 't', 'ws1', 'r', ?), ('new', 't', 'ws1', 'r', ?)").run(
		now - 3 * 86_400 - 1,
		now - 3 * 86_400 + 1,
	);
	assert.equal(await purgeAutomationEvents(db, now), 1);
	const ids = (raw.prepare("SELECT id FROM automation_events").all() as { id: string }[]).map((r) => r.id);
	assert.deepEqual(ids, ["new"]);
});

test("automationEventsTool: kind index, feed automations, con su nombre", () => {
	const tool = automationEventsTool("orbit");
	assert.equal(tool.name, "orbit.automation_events");
	assert.equal(tool.kind, "index");
	assert.equal(tool.feed, "automations");
	assert.deepEqual(tool.params.required, ["after"]);
});

test("automationEventsTool lee y purga en waitUntil", async () => {
	const { db } = setup();
	await enqueueAutomationEvents(db, [created]);
	const pending: Promise<unknown>[] = [];
	const tool = automationEventsTool("orbit");
	const out = (await tool.run({ env: { DB: db }, waitUntil: (p: Promise<unknown>) => pending.push(p) } as never, { after: 0 })) as { events: unknown[] };
	assert.equal(out.events.length, 1);
	assert.equal(pending.length, 1);
	await Promise.all(pending);
});

test("pokeNovaFor manda {product} a <issuer>/api/events/poke", async () => {
	const sent: { url: string; body: string }[] = [];
	globalThis.fetch = (async (url: string, init: RequestInit) => {
		sent.push({ url, body: String(init.body) });
		return new Response(null, { status: 202 });
	}) as unknown as typeof fetch;
	const pending: Promise<unknown>[] = [];
	pokeNovaFor({ NOVA_ISSUER: "https://nova.test/" }, "orbit", (p) => pending.push(p));
	await Promise.all(pending);
	assert.deepEqual(sent, [{ url: "https://nova.test/api/events/poke", body: JSON.stringify({ product: "orbit" }) }]);
});

test("pokeNovaFor se traga un fallo de red", async () => {
	globalThis.fetch = (async () => {
		throw new Error("offline");
	}) as unknown as typeof fetch;
	console.error = () => {};
	const pending: Promise<unknown>[] = [];
	pokeNovaFor({}, "orbit", (p) => pending.push(p));
	await assert.doesNotReject(Promise.all(pending));
});

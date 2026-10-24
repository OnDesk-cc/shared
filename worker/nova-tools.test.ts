// Pruebas del contrato de herramientas de Nova del lado del producto: `npm test`.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createNovaTools, defineAction, defineTool, NovaToolError, requireResource, type JsonSchema, type NovaToolContext, type NovaToolsEnv } from "./nova-tools.ts";
import { agentSubject, ticketResource, type NovaActionPreview, type NovaTriggerDef } from "./nova-contract.ts";

const realFetch = globalThis.fetch;
const ISSUER = "https://nova.test";
let privateKey: CryptoKey;
let kid = "";

function b64url(bytes: Uint8Array): string {
	let s = "";
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const text = (v: unknown) => b64url(new TextEncoder().encode(JSON.stringify(v)));

// Una sola clave para todo el archivo: la caché del JWKS vive entre pruebas y
// sólo se refresca a la fuerza una vez por minuto.
before(async () => {
	const pair = (await crypto.subtle.generateKey(
		{ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
		true,
		["sign", "verify"],
	)) as CryptoKeyPair;
	privateKey = pair.privateKey;
	const pub = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey;
	kid = crypto.randomUUID();
	globalThis.fetch = (async () => new Response(JSON.stringify({ keys: [{ kty: "RSA", n: pub.n, e: pub.e, kid }] }))) as typeof fetch;
});
after(() => {
	globalThis.fetch = realFetch;
});

async function token(claims: Record<string, unknown>): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const header = { alg: "RS256", kid };
	const payload = { iss: ISSUER, aud: "orbit", sub: "u1", workspace: "ws1", tool: "orbit.echo", origin: "chat:c1", jti: "j", iat: now, exp: now + 60, ...claims };
	const input = `${text(header)}.${text(payload)}`;
	const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(input));
	return `${input}.${b64url(new Uint8Array(sig))}`;
}

type Env = NovaToolsEnv;
const env = { DB: {} as Env["DB"], NOVA_ISSUER: ISSUER } as Env;

const echo = defineTool<Env, { word: string }>({
	name: "orbit.echo",
	description: "Echo",
	kind: "read",
	params: { type: "object", additionalProperties: false, required: ["word"], properties: { word: { type: "string", maxLength: 20 } } },
	run: async (ctx, params) => ({ word: params.word, user: ctx.userId, workspace: ctx.workspaceId, role: ctx.workspaceRole }),
});
const missing = defineTool<Env>({
	name: "orbit.missing",
	description: "Throws not_found",
	kind: "read",
	params: { type: "object", properties: {} },
	run: async () => {
		throw new NovaToolError("not_found", "No such task");
	},
});
const huge = defineTool<Env>({
	name: "orbit.huge",
	description: "Too big",
	kind: "read",
	params: { type: "object", properties: { size: { type: "integer" } } },
	run: async (_ctx, params) => ({ blob: "x".repeat(Number(params.size ?? 70_000)) }),
});
const feed = defineTool<Env>({
	name: "orbit.index_feed",
	description: "Feed",
	kind: "index",
	params: { type: "object", additionalProperties: false, properties: { after: { type: "integer", minimum: 0 } } },
	run: async (ctx) => ({ user: ctx.userId, workspace: ctx.workspaceId, mode: ctx.mode, big: "x".repeat(100_000) }),
});
const whoami = defineTool<Env>({
	name: "orbit.whoami",
	description: "Mode",
	kind: "read",
	params: { type: "object", properties: {} },
	run: async (ctx) => ({ mode: ctx.mode }),
});

// Las acciones (fase 2): cuántas veces se llamó a cada mitad.
const calls = { preview: 0, commit: 0 };
const resetCalls = () => {
	calls.preview = 0;
	calls.commit = 0;
};
const createTask = defineAction<Env, { title: string }>({
	name: "orbit.create_task",
	description: "Create a task",
	params: { type: "object", additionalProperties: false, required: ["title"], properties: { title: { type: "string", maxLength: 40 } } },
	preview: async (ctx, params) => {
		calls.preview++;
		if (params.title === "forbidden") throw new NovaToolError("forbidden", "You cannot create tasks here");
		return { summary: `Create task "${params.title}"`, fields: [{ label: "Title", value: params.title }, { label: "Mode", value: ctx.mode }] };
	},
	commit: async (ctx, params) => {
		calls.commit++;
		return { ok: true, link: "https://orbit.test/t/1", title: params.title, mode: ctx.mode, user: ctx.userId };
	},
});
const deleteTask = defineAction<Env>({
	name: "orbit.delete_task",
	description: "Delete a task",
	destructive: true,
	params: { type: "object", properties: {} },
	preview: async () => ({ summary: "Delete task", fields: [] }),
	commit: async () => ({ ok: true }),
});
let badShape: unknown = null;
const badPreview = defineAction<Env>({
	name: "orbit.bad_preview",
	description: "Returns whatever badShape holds as its preview",
	params: { type: "object", properties: {} },
	preview: async () => badShape as NovaActionPreview,
	commit: async () => "anything",
});

let access: { ok: true; role: string } | { ok: false; status: 402 | 403; message: string } = { ok: true, role: "member" };
const nova = createNovaTools<Env>({
	product: "orbit",
	version: "test",
	guidance: "Be brief.",
	tools: [echo, missing, huge, feed, whoami, createTask, deleteTask, badPreview],
	resolveAccess: async () => access,
});

async function invoke(name: string, body: unknown, auth?: string): Promise<{ status: number; json: Record<string, unknown> }> {
	const request = new Request(`https://orbit.test/api/nova/tools/${name}`, {
		method: "POST",
		headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
		body: JSON.stringify(body),
	});
	const res = (await nova.onInvoke({ request, env, params: { name }, waitUntil: () => {} } as never)) as unknown as Response;
	return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

test("el manifiesto no lleva `run` y sí guía y versión", async () => {
	assert.equal(nova.manifest.product, "orbit");
	assert.equal(nova.manifest.guidance, "Be brief.");
	assert.deepEqual(nova.manifest.tools.map((t) => t.name), [
		"orbit.echo",
		"orbit.missing",
		"orbit.huge",
		"orbit.index_feed",
		"orbit.whoami",
		"orbit.create_task",
		"orbit.delete_task",
		"orbit.bad_preview",
	]);
	assert.equal("run" in nova.manifest.tools[0], false);
});

test("con un token válido ejecuta como ese usuario", async () => {
	access = { ok: true, role: "admin" };
	const { status, json } = await invoke("orbit.echo", { word: "hi" }, await token({}));
	assert.equal(status, 200);
	assert.deepEqual(json, { ok: true, data: { word: "hi", user: "u1", workspace: "ws1", role: "admin" } });
	access = { ok: true, role: "member" };
});

test("sin token → 401 unauthorized", async () => {
	const { status, json } = await invoke("orbit.echo", { word: "hi" });
	assert.equal(status, 401);
	assert.equal(json.code, "unauthorized");
});

test("token para otra herramienta, otro producto u otro emisor → 401", async () => {
	assert.equal((await invoke("orbit.echo", { word: "hi" }, await token({ tool: "orbit.other" }))).status, 401);
	assert.equal((await invoke("orbit.echo", { word: "hi" }, await token({ aud: "vault" }))).status, 401);
	assert.equal((await invoke("orbit.echo", { word: "hi" }, await token({ iss: "https://evil.test" }))).status, 401);
});

test("un sub nova:… que no es el indexador ni un agente → 403, como en la fase 1", async () => {
	for (const sub of ["nova:ws1", "nova:agent:", "nova:agentx:a1"]) {
		const { status, json } = await invoke("orbit.echo", { word: "hi" }, await token({ sub }));
		assert.equal(status, 403, sub);
		assert.equal(json.code, "forbidden");
	}
});

test("sin membresía o sin derecho → 403 / 402", async () => {
	access = { ok: false, status: 403, message: "Forbidden" };
	assert.equal((await invoke("orbit.echo", { word: "hi" }, await token({}))).json.code, "forbidden");
	access = { ok: false, status: 402, message: "no sub" };
	assert.equal((await invoke("orbit.echo", { word: "hi" }, await token({}))).json.code, "payment_required");
	access = { ok: true, role: "member" };
});

test("parámetros inventados → 400 invalid_params con el motivo", async () => {
	const { status, json } = await invoke("orbit.echo", { word: "hi", limit: 9999 }, await token({}));
	assert.equal(status, 400);
	assert.equal(json.code, "invalid_params");
	assert.match(String(json.message), /params\.limit is not allowed/);
});

test("herramienta que no existe → 404 not_found", async () => {
	const { status, json } = await invoke("orbit.nope", {}, await token({ tool: "orbit.nope" }));
	assert.equal(status, 404);
	assert.equal(json.code, "not_found");
});

test("NovaToolError conserva su código", async () => {
	const { status, json } = await invoke("orbit.missing", {}, await token({ tool: "orbit.missing" }));
	assert.equal(status, 404);
	assert.deepEqual(json, { ok: false, code: "not_found", message: "No such task" });
});

test("un snapshot normal de 50 000 caracteres cabe (un hilo largo, un documento abierto)", async () => {
	const { status, json } = await invoke("orbit.huge", { size: 50_000 }, await token({ tool: "orbit.huge" }));
	assert.equal(status, 200);
	assert.equal(json.ok, true);
});

test("una respuesta demasiado grande → 413 too_large", async () => {
	const { status, json } = await invoke("orbit.huge", {}, await token({ tool: "orbit.huge" }));
	assert.equal(status, 413);
	assert.equal(json.code, "too_large");
});

test("una herramienta index sólo la llama el indexador, sin pasar por la membresía, y su respuesta no tiene el tope del modelo", async () => {
	access = { ok: false, status: 403, message: "Forbidden" };
	const ok = await invoke("orbit.index_feed", { after: 0 }, await token({ tool: "orbit.index_feed", sub: "nova:indexer", workspace: "*" }));
	assert.equal(ok.status, 200);
	assert.equal((ok.json.data as { user: string }).user, "nova:indexer");
	access = { ok: true, role: "member" };
});

test("un usuario no puede llamar a una herramienta index, ni el indexador a una de usuario", async () => {
	const asUser = await invoke("orbit.index_feed", { after: 0 }, await token({ tool: "orbit.index_feed" }));
	assert.equal(asUser.status, 403);
	const indexerOnRead = await invoke("orbit.echo", { word: "hi" }, await token({ sub: "nova:indexer", workspace: "*" }));
	assert.equal(indexerOnRead.status, 403);
	const wrongWorkspace = await invoke("orbit.index_feed", { after: 0 }, await token({ tool: "orbit.index_feed", sub: "nova:indexer", workspace: "ws1" }));
	assert.equal(wrongWorkspace.status, 403);
});

// ── Acciones (fase 2): `mode` va firmado en el token, nunca en el cuerpo ──

// Un token para la herramienta `tool`, con `mode` sólo si se pasa (`token` lo
// firma tal cual: cualquier claim de más entra por su `...claims`).
const actionToken = (tool: string, mode?: string, extra: Record<string, unknown> = {}) =>
	token({ tool, ...(mode === undefined ? {} : { mode }), ...extra });

test("una acción sale en el manifiesto como write, con destructive y sin preview, commit ni run", () => {
	const create = nova.manifest.tools.find((t) => t.name === "orbit.create_task")!;
	const del = nova.manifest.tools.find((t) => t.name === "orbit.delete_task")!;
	assert.equal(create.kind, "write");
	assert.equal(create.destructive, false);
	assert.equal(del.destructive, true);
	for (const key of ["preview", "commit", "run"]) assert.equal(key in create, false, `el manifiesto lleva ${key}`);
});

test("una acción sin mode, o con uno desconocido, → 403 y no corre nada", async () => {
	resetCalls();
	const none = await invoke("orbit.create_task", { title: "Ship v2" }, await actionToken("orbit.create_task"));
	assert.equal(none.status, 403);
	assert.equal(none.json.code, "forbidden");
	for (const mode of ["read", "write", "COMMIT", ""]) {
		assert.equal((await invoke("orbit.create_task", { title: "Ship v2" }, await actionToken("orbit.create_task", mode))).status, 403, mode);
	}
	assert.deepEqual(calls, { preview: 0, commit: 0 });
});

test("una lectura o un feed con mode → 403", async () => {
	assert.equal((await invoke("orbit.echo", { word: "hi" }, await actionToken("orbit.echo", "preview"))).status, 403);
	assert.equal((await invoke("orbit.echo", { word: "hi" }, await actionToken("orbit.echo", "commit"))).status, 403);
	const feedWithMode = await invoke("orbit.index_feed", { after: 0 }, await actionToken("orbit.index_feed", "commit", { sub: "nova:indexer", workspace: "*" }));
	assert.equal(feedWithMode.status, 403);
});

test("una lectura y un feed corren con ctx.mode = read", async () => {
	const read = await invoke("orbit.whoami", {}, await actionToken("orbit.whoami"));
	assert.deepEqual(read.json, { ok: true, data: { mode: "read" } });
	const feedOk = await invoke("orbit.index_feed", { after: 0 }, await actionToken("orbit.index_feed", undefined, { sub: "nova:indexer", workspace: "*" }));
	assert.equal((feedOk.json.data as { mode: string }).mode, "read");
});

test("preview: llama sólo a preview y devuelve la tarjeta", async () => {
	resetCalls();
	const { status, json } = await invoke("orbit.create_task", { title: "Ship v2" }, await actionToken("orbit.create_task", "preview"));
	assert.equal(status, 200);
	assert.deepEqual(json, {
		ok: true,
		data: { summary: 'Create task "Ship v2"', fields: [{ label: "Title", value: "Ship v2" }, { label: "Mode", value: "preview" }] },
	});
	assert.deepEqual(calls, { preview: 1, commit: 0 });
});

test("commit: llama sólo a commit, como ese usuario y con ctx.mode = commit", async () => {
	resetCalls();
	const { status, json } = await invoke("orbit.create_task", { title: "Ship v2" }, await actionToken("orbit.create_task", "commit"));
	assert.equal(status, 200);
	assert.deepEqual(json, { ok: true, data: { ok: true, link: "https://orbit.test/t/1", title: "Ship v2", mode: "commit", user: "u1" } });
	assert.deepEqual(calls, { preview: 0, commit: 1 });
});

test("un preview sin permiso → 403 forbidden con su motivo", async () => {
	const { status, json } = await invoke("orbit.create_task", { title: "forbidden" }, await actionToken("orbit.create_task", "preview"));
	assert.equal(status, 403);
	assert.deepEqual(json, { ok: false, code: "forbidden", message: "You cannot create tasks here" });
});

test("una preview mal formada → 500 failed; el commit no se mira", async () => {
	const shapes: unknown[] = [
		null,
		"Create task",
		{ summary: 42, fields: [] },
		{ summary: "", fields: [] },
		{ summary: "Create task" },
		{ summary: "Create task", fields: "Title: x" },
		{ summary: "Create task", fields: [{ label: "Due", value: 5 }] },
		{ summary: "Create task", fields: [null] },
	];
	for (const shape of shapes) {
		badShape = shape;
		const { status, json } = await invoke("orbit.bad_preview", {}, await actionToken("orbit.bad_preview", "preview"));
		assert.equal(status, 500, JSON.stringify(shape));
		assert.equal(json.code, "failed");
	}
	badShape = { summary: "Fine", fields: [{ label: "A", value: "b" }] };
	assert.equal((await invoke("orbit.bad_preview", {}, await actionToken("orbit.bad_preview", "preview"))).status, 200);
	assert.deepEqual((await invoke("orbit.bad_preview", {}, await actionToken("orbit.bad_preview", "commit"))).json, { ok: true, data: "anything" });
});

test("una ejecución automática (nova:…) sigue rechazada en una acción, en preview y en commit", async () => {
	resetCalls();
	for (const mode of ["preview", "commit"]) {
		const { status, json } = await invoke("orbit.create_task", { title: "Ship v2" }, await actionToken("orbit.create_task", mode, { sub: "nova:ws1" }));
		assert.equal(status, 403, mode);
		assert.equal(json.code, "forbidden");
	}
	assert.deepEqual(calls, { preview: 0, commit: 0 });
});

test("parámetros inválidos en una acción → 400 antes de llamar a preview", async () => {
	resetCalls();
	assert.equal((await invoke("orbit.create_task", {}, await actionToken("orbit.create_task", "preview"))).status, 400);
	assert.equal((await invoke("orbit.create_task", { title: "x".repeat(41) }, await actionToken("orbit.create_task", "commit"))).status, 400);
	assert.deepEqual(calls, { preview: 0, commit: 0 });
});

test("sin membresía o sin derecho, una acción no corre", async () => {
	resetCalls();
	access = { ok: false, status: 402, message: "no sub" };
	assert.equal((await invoke("orbit.create_task", { title: "Ship v2" }, await actionToken("orbit.create_task", "commit"))).json.code, "payment_required");
	access = { ok: false, status: 403, message: "Forbidden" };
	assert.equal((await invoke("orbit.create_task", { title: "Ship v2" }, await actionToken("orbit.create_task", "preview"))).json.code, "forbidden");
	access = { ok: true, role: "member" };
	assert.deepEqual(calls, { preview: 0, commit: 0 });
});

// ── Lo automático (fase 4): un agente de Nova, siempre con su ticket ──

// Un producto `pulse` de prueba: lo que llama un agente lleva `automatic`, y el
// ticket del parámetro tiene que ser el del recurso (`requireResource`).
const pulseCalls = { access: 0, preview: 0, commit: 0, destructive: 0 };
const resetPulseCalls = () => {
	pulseCalls.access = 0;
	pulseCalls.preview = 0;
	pulseCalls.commit = 0;
	pulseCalls.destructive = 0;
};
const seen = (ctx: NovaToolContext<Env>) => ({
	user: ctx.userId,
	agent: ctx.agentId,
	resource: ctx.resource,
	key: ctx.key,
	role: ctx.workspaceRole,
	mode: ctx.mode,
});
const ticketParams: JsonSchema = { type: "object", additionalProperties: false, required: ["ticket_id"], properties: { ticket_id: { type: "string", maxLength: 64 } } };

const getTicket = defineTool<Env, { ticket_id: string }>({
	name: "pulse.get_ticket",
	description: "Read one ticket",
	kind: "read",
	automatic: true,
	offer: false,
	params: ticketParams,
	run: async (ctx, params) => {
		requireResource(ctx, "ticket", params.ticket_id);
		return seen(ctx);
	},
});
const listTickets = defineTool<Env>({
	name: "pulse.list_tickets",
	description: "List tickets (not for agents)",
	kind: "read",
	params: { type: "object", properties: {} },
	run: async (ctx) => seen(ctx),
});
const replyTicket = defineAction<Env, { ticket_id: string; text: string }>({
	name: "pulse.reply_ticket",
	description: "Reply to a ticket",
	automatic: true,
	params: { type: "object", additionalProperties: false, required: ["ticket_id", "text"], properties: { ticket_id: { type: "string" }, text: { type: "string" } } },
	preview: async (ctx, params) => {
		pulseCalls.preview++;
		requireResource(ctx, "ticket", params.ticket_id);
		return { summary: "Reply", fields: [{ label: "Agent", value: String(ctx.agentId) }, { label: "Key", value: String(ctx.key) }] };
	},
	commit: async (ctx, params) => {
		pulseCalls.commit++;
		requireResource(ctx, "ticket", params.ticket_id);
		return seen(ctx);
	},
});
const assignTicket = defineAction<Env>({
	name: "pulse.assign_ticket",
	description: "Assign a ticket (not for agents)",
	params: { type: "object", properties: {} },
	preview: async () => ({ summary: "Assign", fields: [] }),
	commit: async () => ({ ok: true }),
});
const closeTicket = defineAction<Env>({
	name: "pulse.close_ticket",
	description: "Close a ticket",
	destructive: true,
	automatic: true,
	params: { type: "object", properties: {} },
	preview: async () => {
		pulseCalls.destructive++;
		return { summary: "Close", fields: [] };
	},
	commit: async () => {
		pulseCalls.destructive++;
		return { ok: true };
	},
});
const events = defineTool<Env>({
	name: "pulse.events",
	description: "Event inbox",
	kind: "index",
	feed: "events",
	params: { type: "object", additionalProperties: false, properties: { after: { type: "integer", minimum: 0 } } },
	run: async (ctx) => ({ events: [], next_after: 0, has_more: false, user: ctx.userId, agent: ctx.agentId }),
});
const mailboxes = defineTool<Env>({
	name: "pulse.mailboxes",
	description: "Mailboxes for the console",
	kind: "read",
	offer: false,
	params: { type: "object", properties: {} },
	run: async () => ({ mailboxes: [] }),
});

const pulse = createNovaTools<Env>({
	product: "pulse",
	version: "test",
	guidance: "Be kind.",
	tools: [getTicket, listTickets, replyTicket, assignTicket, closeTicket, events, mailboxes],
	resolveAccess: async () => {
		pulseCalls.access++;
		return { ok: true, role: "admin" };
	},
});

const AGENT = agentSubject("a1");
const TICKET = ticketResource("t1");

async function invokePulse(name: string, body: unknown, claims: Record<string, unknown>): Promise<{ status: number; json: Record<string, unknown> }> {
	const auth = await token({ aud: "pulse", tool: name, ...claims });
	const request = new Request(`https://pulse.test/api/nova/tools/${name}`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth}` },
		body: JSON.stringify(body),
	});
	const res = (await pulse.onInvoke({ request, env, params: { name }, waitUntil: () => {} } as never)) as unknown as Response;
	return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

test("el manifiesto lleva automatic, offer y feed donde se pusieron, y nada donde no", () => {
	const byName = new Map(pulse.manifest.tools.map((t) => [t.name, t]));
	assert.equal(byName.get("pulse.get_ticket")!.automatic, true);
	assert.equal(byName.get("pulse.get_ticket")!.offer, false);
	assert.equal(byName.get("pulse.mailboxes")!.offer, false);
	assert.equal("automatic" in byName.get("pulse.mailboxes")!, false);
	assert.equal(byName.get("pulse.events")!.feed, "events");
	for (const name of ["pulse.list_tickets", "pulse.assign_ticket"]) {
		for (const key of ["automatic", "offer", "feed"]) assert.equal(key in byName.get(name)!, false, `${name} lleva ${key}`);
	}
	assert.equal("automatic" in nova.manifest.tools[0], false, "una herramienta de antes no cambia");
});

test("defineAction copia automatic y offer al manifiesto, y nunca preview ni commit", () => {
	const reply = pulse.manifest.tools.find((t) => t.name === "pulse.reply_ticket")!;
	assert.equal(reply.kind, "write");
	assert.equal(reply.automatic, true);
	assert.equal("offer" in reply, false);
	const hidden = defineAction<Env>({
		name: "pulse.hidden",
		description: "Hidden",
		automatic: false,
		offer: false,
		params: { type: "object", properties: {} },
		preview: async () => ({ summary: "x", fields: [] }),
		commit: async () => ({ ok: true }),
	});
	const published = createNovaTools<Env>({ product: "pulse", version: "t", guidance: "", tools: [hidden], resolveAccess: async () => ({ ok: true, role: "admin" }) }).manifest.tools[0];
	assert.deepEqual(published, { name: "pulse.hidden", description: "Hidden", kind: "write", destructive: false, automatic: false, offer: false, params: { type: "object", properties: {} } });
	for (const key of ["preview", "commit", "run"]) assert.equal(key in published, false, `el manifiesto lleva ${key}`);
});

test("un agente lee una herramienta automatic con su ticket: rol agent, sin resolveAccess", async () => {
	resetPulseCalls();
	const { status, json } = await invokePulse("pulse.get_ticket", { ticket_id: "t1" }, { sub: AGENT, resource: TICKET, origin: "run:r1" });
	assert.equal(status, 200);
	assert.deepEqual(json, { ok: true, data: { user: "nova:agent:a1", agent: "a1", resource: "pulse:ticket:t1", key: null, role: "agent", mode: "read" } });
	assert.equal(pulseCalls.access, 0);
});

test("un agente escribe en dos tiempos con su ticket y su key", async () => {
	resetPulseCalls();
	const preview = await invokePulse("pulse.reply_ticket", { ticket_id: "t1", text: "Hi" }, { sub: AGENT, resource: TICKET, mode: "preview", key: "r1:reply" });
	assert.equal(preview.status, 200);
	assert.deepEqual(preview.json, { ok: true, data: { summary: "Reply", fields: [{ label: "Agent", value: "a1" }, { label: "Key", value: "r1:reply" }] } });
	const commit = await invokePulse("pulse.reply_ticket", { ticket_id: "t1", text: "Hi" }, { sub: AGENT, resource: TICKET, mode: "commit", key: "r1:reply" });
	assert.equal(commit.status, 200);
	assert.deepEqual(commit.json, { ok: true, data: { user: "nova:agent:a1", agent: "a1", resource: "pulse:ticket:t1", key: "r1:reply", role: "agent", mode: "commit" } });
	assert.deepEqual(pulseCalls, { access: 0, preview: 1, commit: 1, destructive: 0 });
});

test("un agente en una escritura sin mode → 403, como una persona", async () => {
	resetPulseCalls();
	const { status } = await invokePulse("pulse.reply_ticket", { ticket_id: "t1", text: "Hi" }, { sub: AGENT, resource: TICKET, key: "r1:reply" });
	assert.equal(status, 403);
	assert.deepEqual(pulseCalls, { access: 0, preview: 0, commit: 0, destructive: 0 });
});

test("un agente no llama una herramienta sin automatic, ni lectura ni escritura", async () => {
	resetPulseCalls();
	for (const [name, mode] of [["pulse.list_tickets", undefined], ["pulse.mailboxes", undefined], ["pulse.assign_ticket", "commit"]] as const) {
		const { status, json } = await invokePulse(name, {}, { sub: AGENT, resource: TICKET, ...(mode ? { mode, key: "r1:x" } : {}) });
		assert.equal(status, 403, name);
		assert.equal(json.code, "forbidden");
	}
	assert.equal(pulseCalls.access, 0);
});

test("una destructiva nunca, aunque esté marcada automatic", async () => {
	resetPulseCalls();
	for (const mode of ["preview", "commit"]) {
		const { status, json } = await invokePulse("pulse.close_ticket", {}, { sub: AGENT, resource: TICKET, mode, key: "r1:close" });
		assert.equal(status, 403, mode);
		assert.equal(json.code, "forbidden");
	}
	assert.deepEqual(pulseCalls, { access: 0, preview: 0, commit: 0, destructive: 0 });
});

test("un agente sin resource, con uno inválido, de otro producto o con workspace * → 403", async () => {
	resetPulseCalls();
	const cases: Record<string, unknown>[] = [
		{},
		{ resource: "" },
		{ resource: 42 },
		{ resource: "pulse:ticket" },
		{ resource: "pulse:ticket:" },
		{ resource: "ticket:t1" },
		{ resource: "pulse:ticket:t1:x" },
		{ resource: "orbit:task:t1" },
		{ resource: TICKET, workspace: "*" },
	];
	for (const extra of cases) {
		const { status, json } = await invokePulse("pulse.get_ticket", { ticket_id: "t1" }, { sub: AGENT, ...extra });
		assert.equal(status, 403, JSON.stringify(extra));
		assert.equal(json.code, "forbidden");
	}
	assert.equal(pulseCalls.access, 0);
});

test("la key de un agente: hasta 200 caracteres; más, o algo que no es texto → 400 sin escribir", async () => {
	resetPulseCalls();
	const ok = await invokePulse("pulse.reply_ticket", { ticket_id: "t1", text: "Hi" }, { sub: AGENT, resource: TICKET, mode: "commit", key: "k".repeat(200) });
	assert.equal(ok.status, 200);
	for (const key of ["k".repeat(201), "", 7, ["r1"]]) {
		const { status, json } = await invokePulse("pulse.reply_ticket", { ticket_id: "t1", text: "Hi" }, { sub: AGENT, resource: TICKET, mode: "commit", key });
		assert.equal(status, 400, JSON.stringify(key));
		assert.equal(json.code, "invalid_params");
	}
	assert.equal(pulseCalls.commit, 1);
});

test("requireResource: un agente no toca otro ticket aunque el modelo lo pida", async () => {
	resetPulseCalls();
	const read = await invokePulse("pulse.get_ticket", { ticket_id: "t2" }, { sub: AGENT, resource: TICKET });
	assert.equal(read.status, 403);
	assert.deepEqual(read.json, { ok: false, code: "forbidden", message: "This run can only touch its own ticket" });
	const write = await invokePulse("pulse.reply_ticket", { ticket_id: "t12", text: "Refund" }, { sub: AGENT, resource: TICKET, mode: "commit", key: "r1:reply" });
	assert.equal(write.status, 403);
	assert.equal(write.json.code, "forbidden");
	// El kind también cuenta: un recurso `pulse:contact:t1` no abre el ticket t1.
	const otherKind = await invokePulse("pulse.get_ticket", { ticket_id: "t1" }, { sub: AGENT, resource: "pulse:contact:t1" });
	assert.equal(otherKind.status, 403);
});

test("requireResource con una persona no hace nada; con un agente compara kind e id", () => {
	const base = { env, userId: "u1", workspaceId: "ws1", workspaceRole: "admin", origin: "chat:c1", mode: "read" as const, waitUntil: () => {} };
	assert.doesNotThrow(() => requireResource({ ...base, resource: null, agentId: null, key: null }, "ticket", "t9"));
	assert.doesNotThrow(() => requireResource({ ...base, resource: "pulse:ticket:t1", agentId: null, key: null }, "ticket", "t9"));
	// Un contexto de antes de la fase 4, armado a mano en una prueba, sin agentId: es una persona.
	assert.doesNotThrow(() => requireResource(base as never, "ticket", "t9"));
	const agent = { ...base, userId: AGENT, workspaceRole: "agent", resource: TICKET, agentId: "a1", key: null };
	assert.doesNotThrow(() => requireResource(agent, "ticket", "t1"));
	for (const [kind, id] of [["ticket", "t2"], ["contact", "t1"], ["ticket", ""]]) {
		assert.throws(
			() => requireResource(agent, kind, id),
			(err: unknown) => err instanceof NovaToolError && err.code === "forbidden" && err.message === "This run can only touch its own ticket",
			`${kind}:${id}`,
		);
	}
	assert.throws(() => requireResource({ ...agent, resource: null }, "ticket", "t1"), NovaToolError);
	assert.throws(() => requireResource({ ...agent, resource: "garbage" }, "ticket", "t1"), NovaToolError);
});

test("una persona, como hoy: resolveAccess, agentId null, y resource y key si vinieron", async () => {
	resetPulseCalls();
	const plain = await invokePulse("pulse.list_tickets", {}, {});
	assert.deepEqual(plain.json, { ok: true, data: { user: "u1", agent: null, resource: null, key: null, role: "admin", mode: "read" } });
	const other = await invokePulse("pulse.get_ticket", { ticket_id: "t2" }, { resource: TICKET });
	assert.deepEqual(other.json, { ok: true, data: { user: "u1", agent: null, resource: "pulse:ticket:t1", key: null, role: "admin", mode: "read" } });
	assert.equal(pulseCalls.access, 2);
});

test("el indexador lee la bandeja de eventos (feed events); un agente no", async () => {
	resetPulseCalls();
	const ok = await invokePulse("pulse.events", { after: 0 }, { sub: "nova:indexer", workspace: "*" });
	assert.equal(ok.status, 200);
	assert.deepEqual(ok.json, { ok: true, data: { events: [], next_after: 0, has_more: false, user: "nova:indexer", agent: null } });
	const asAgent = await invokePulse("pulse.events", { after: 0 }, { sub: AGENT, resource: TICKET });
	assert.equal(asAgent.status, 403);
	assert.equal(pulseCalls.access, 0);
});

// ── Automatizaciones (2026-10-21): el paso de una automatización corre como su dueño, con key ──

test("una persona con key vacía o de 201 caracteres → 400 sin escribir", async () => {
	resetPulseCalls();
	for (const key of ["", "k".repeat(201), 7]) {
		const { status, json } = await invokePulse("pulse.reply_ticket", { ticket_id: "t1", text: "Hi" }, { mode: "commit", key, origin: "flow:f1:r1" });
		assert.equal(status, 400, JSON.stringify(key));
		assert.equal(json.code, "invalid_params");
	}
	assert.equal(pulseCalls.commit, 0);
});

test("una persona con key r1:0 llega a run con ctx.key", async () => {
	const { status, json } = await invokePulse("pulse.reply_ticket", { ticket_id: "t1", text: "Hi" }, { mode: "commit", key: "r1:0", origin: "flow:f1:r1" });
	assert.equal(status, 200);
	assert.deepEqual(json, { ok: true, data: { user: "u1", agent: null, resource: null, key: "r1:0", role: "admin", mode: "commit" } });
});

const TRIGGER: NovaTriggerDef = {
	type: "orbit.task.created",
	label: "Task created",
	description: "A task is created",
	resource_kind: "task",
	subject_tool: "orbit.automation_subject",
	fields: [{ key: "title", label: "Title", type: "text" }],
};

test("el manifiesto lleva triggers cuando se dan", () => {
	const withTriggers = createNovaTools<Env>({ product: "orbit", version: "t", guidance: "", tools: [echo], triggers: [TRIGGER], resolveAccess: async () => ({ ok: true, role: "admin" }) });
	assert.deepEqual(withTriggers.manifest.triggers, [TRIGGER]);
});

test("sin triggers el manifiesto no lleva la clave", () => {
	const plain = createNovaTools<Env>({ product: "orbit", version: "t", guidance: "", tools: [echo], resolveAccess: async () => ({ ok: true, role: "admin" }) });
	assert.equal("triggers" in plain.manifest, false);
});

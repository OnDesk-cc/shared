// Pruebas del contrato de herramientas de Nova del lado del producto: `npm test`.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createNovaTools, defineTool, NovaToolError, type NovaToolsEnv } from "./nova-tools.ts";

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

let access: { ok: true; role: string } | { ok: false; status: 402 | 403; message: string } = { ok: true, role: "member" };
const nova = createNovaTools<Env>({
	product: "orbit",
	version: "test",
	guidance: "Be brief.",
	tools: [echo, missing, huge],
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
	assert.deepEqual(nova.manifest.tools.map((t) => t.name), ["orbit.echo", "orbit.missing", "orbit.huge"]);
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

test("una ejecución automática (sub nova:…) se rechaza en la fase 1", async () => {
	const { status, json } = await invoke("orbit.echo", { word: "hi" }, await token({ sub: "nova:ws1" }));
	assert.equal(status, 403);
	assert.equal(json.code, "forbidden");
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

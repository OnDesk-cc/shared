// Pruebas de la verificación RS256 contra un JWKS remoto: `npm test`.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { verifyRs256 } from "./rs256.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
});

function b64url(bytes: Uint8Array): string {
	let s = "";
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const text = (v: unknown) => b64url(new TextEncoder().encode(JSON.stringify(v)));

async function keyPair(kid: string) {
	const pair = (await crypto.subtle.generateKey(
		{ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
		true,
		["sign", "verify"],
	)) as CryptoKeyPair;
	const pub = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey;
	return { privateKey: pair.privateKey, jwk: { kty: "RSA", n: pub.n, e: pub.e, kid, alg: "RS256", use: "sig" } };
}

async function sign(privateKey: CryptoKey, header: Record<string, unknown>, payload: Record<string, unknown>): Promise<string> {
	const input = `${text(header)}.${text(payload)}`;
	const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(input));
	return `${input}.${b64url(new Uint8Array(sig))}`;
}

function serveJwks(keys: unknown[]): { calls: number } {
	const counter = { calls: 0 };
	globalThis.fetch = (async () => {
		counter.calls++;
		return new Response(JSON.stringify({ keys }), { headers: { "Content-Type": "application/json" } });
	}) as typeof fetch;
	return counter;
}

const now = () => Math.floor(Date.now() / 1000);

test("un token bien firmado y vigente devuelve su payload", async () => {
	const { privateKey, jwk } = await keyPair("k1");
	serveJwks([jwk]);
	const token = await sign(privateKey, { alg: "RS256", kid: "k1" }, { sub: "u1", exp: now() + 60 });
	const payload = await verifyRs256<{ sub: string }>(token, "https://a.test/jwks");
	assert.equal(payload?.sub, "u1");
});

test("caducado → null", async () => {
	const { privateKey, jwk } = await keyPair("k1");
	serveJwks([jwk]);
	const token = await sign(privateKey, { alg: "RS256", kid: "k1" }, { sub: "u1", exp: now() - 1 });
	assert.equal(await verifyRs256(token, "https://b.test/jwks"), null);
});

test("firmado con otra clave → null", async () => {
	const good = await keyPair("k1");
	const evil = await keyPair("k1");
	serveJwks([good.jwk]);
	const token = await sign(evil.privateKey, { alg: "RS256", kid: "k1" }, { sub: "u1", exp: now() + 60 });
	assert.equal(await verifyRs256(token, "https://c.test/jwks"), null);
});

test("alg distinto de RS256 → null sin pedir el JWKS", async () => {
	const counter = serveJwks([]);
	const token = `${text({ alg: "none" })}.${text({ sub: "u1", exp: now() + 60 })}.`;
	assert.equal(await verifyRs256(token, "https://d.test/jwks"), null);
	assert.equal(counter.calls, 0);
});

test("kid desconocido fuerza un refresco (rotación) y luego valida", async () => {
	const oldKey = await keyPair("old");
	const newKey = await keyPair("new");
	serveJwks([oldKey.jwk]);
	const url = "https://e.test/jwks";
	await verifyRs256(await sign(oldKey.privateKey, { alg: "RS256", kid: "old" }, { sub: "u", exp: now() + 60 }), url);
	serveJwks([oldKey.jwk, newKey.jwk]);
	const payload = await verifyRs256<{ sub: string }>(await sign(newKey.privateKey, { alg: "RS256", kid: "new" }, { sub: "u2", exp: now() + 60 }), url);
	assert.equal(payload?.sub, "u2");
});

test("si el JWKS no responde → null", async () => {
	globalThis.fetch = (async () => {
		throw new TypeError("network down");
	}) as typeof fetch;
	assert.equal(await verifyRs256("a.b.c", "https://f.test/jwks"), null);
});

test("basura → null", async () => {
	serveJwks([]);
	assert.equal(await verifyRs256("not-a-token", "https://g.test/jwks"), null);
	assert.equal(await verifyRs256("%%%.%%%.%%%", "https://g.test/jwks"), null);
});

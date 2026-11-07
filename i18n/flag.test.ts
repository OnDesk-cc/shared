// El interruptor de idiomas visto desde una SPA: `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cachedLanguagesEnabled, fetchLanguagesEnabled } from "./flag.ts";

function memory() {
	const mem = new Map<string, string>();
	return { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
}

test("sin nada guardado, apagado", () => {
	assert.equal(cachedLanguagesEnabled(memory()), false);
});

test("fetchLanguagesEnabled cachea y cae al último valor si la red falla", async () => {
	const s = memory();
	let seen = "";
	const ok = async (url: string | URL | Request) => {
		seen = String(url);
		return new Response('{"enabled":true}');
	};
	assert.equal(await fetchLanguagesEnabled("https://ondesk.cc", ok as typeof fetch, s), true);
	assert.equal(seen, "https://ondesk.cc/api/platform/languages");
	assert.equal(cachedLanguagesEnabled(s), true);
	const offline = async () => {
		throw new Error("offline");
	};
	assert.equal(await fetchLanguagesEnabled("https://ondesk.cc", offline as typeof fetch, s), true);
});

test("una respuesta rara no enciende nada", async () => {
	const s = memory();
	assert.equal(await fetchLanguagesEnabled("https://ondesk.cc", (async () => new Response("<html>", { status: 500 })) as typeof fetch, s), false);
});

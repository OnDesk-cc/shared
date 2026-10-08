// Pruebas de lo que comparten Nova y los productos para la búsqueda: `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
	bestPerItem,
	chunkText,
	NOVA_CANDIDATES_SCHEMA,
	NOVA_INDEX_MAX_CHARS,
	novaExcerpt,
	pickReadable,
	takeFeedPage,
} from "./nova-search.ts";
import { validateParams } from "./json-schema.ts";

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

test("chunkText: nada para un texto vacío, un trozo para uno corto", () => {
	assert.deepEqual(chunkText("   \n "), []);
	assert.deepEqual(chunkText("  hola\n\nmundo  "), ["hola mundo"]);
});

test("chunkText: trozos de 1 200 como mucho, con solape, sin perder palabras", () => {
	const chunks = chunkText(words(3000));
	assert.ok(chunks.length > 5);
	for (const c of chunks) assert.ok(c.length <= 1200, `trozo de ${c.length}`);
	for (let i = 0; i + 1 < chunks.length; i++) {
		const head = chunks[i + 1].split(" ").slice(0, 3).join(" ");
		assert.ok(chunks[i].includes(head), `el trozo ${i + 1} empieza dentro del ${i}`);
	}
	const seen = new Set(chunks.join(" ").split(" "));
	const kept = words(3000).slice(0, NOVA_INDEX_MAX_CHARS).split(" ").slice(0, -1);
	for (const w of kept) assert.ok(seen.has(w), `falta ${w}`);
});

test("chunkText: corta a 24 000 caracteres y es determinista", () => {
	const text = words(20_000);
	const a = chunkText(text);
	assert.ok(a.join(" ").length <= NOVA_INDEX_MAX_CHARS + a.length * 150);
	assert.deepEqual(a, chunkText(text));
});

test("novaExcerpt: el trozo pedido, recortado a 400; el primero si el trozo ya no existe", () => {
	const text = words(3000);
	const ex = novaExcerpt(text, 2);
	assert.ok(ex.length <= 401);
	assert.ok(chunkText(text)[2].startsWith(ex.replace(/…$/, "")));
	assert.equal(novaExcerpt("corto", 7), "corto");
	assert.equal(novaExcerpt("", 0), "");
});

test("bestPerItem: un candidato por objeto, el de más puntuación, ordenados", () => {
	const out = bestPerItem([
		{ kind: "file", id: "a", chunk: 0, score: 0.5 },
		{ kind: "file", id: "a", chunk: 3, score: 0.9 },
		{ kind: "page", id: "a", chunk: 0, score: 0.7 },
	]);
	assert.deepEqual(out.map((c) => `${c.kind}:${c.id}:${c.chunk}`), ["file:a:3", "page:a:0"]);
});

test("pickReadable: descarta lo que el producto no resuelve y respeta el límite", async () => {
	const candidates = [
		{ kind: "file", id: "secret", chunk: 0, score: 0.99 },
		{ kind: "file", id: "ok1", chunk: 0, score: 0.9 },
		{ kind: "file", id: "ok2", chunk: 0, score: 0.8 },
		{ kind: "file", id: "ok3", chunk: 0, score: 0.7 },
	];
	const asked: string[] = [];
	const out = await pickReadable(candidates, 2, async (c) => {
		asked.push(c.id);
		return c.id === "secret" ? null : c.id;
	});
	assert.deepEqual(out, ["ok1", "ok2"]);
	assert.deepEqual(asked, ["secret", "ok1", "ok2"]);
});

test("takeFeedPage: nunca pierde un objeto en el borde del límite", () => {
	const rows = [
		{ seq: 11, kind: "file", item_id: "a", workspace_id: "w" },
		{ seq: 12, kind: "file", item_id: "a", workspace_id: "w" },
		{ seq: 13, kind: "file", item_id: "b", workspace_id: "w" },
		{ seq: 14, kind: "file", item_id: "a", workspace_id: "w" },
		{ seq: 15, kind: "file", item_id: "c", workspace_id: "w" },
	];
	const page = takeFeedPage(rows, 10, 2);
	assert.deepEqual(page.items.map((r) => r.item_id), ["a", "b"]);
	// 15 (c) no cabe: next_after se queda en 14 y la siguiente página empieza por c.
	assert.equal(page.nextAfter, 14);
	assert.equal(page.consumed, 4);
	assert.deepEqual(takeFeedPage([], 10, 2), { items: [], nextAfter: 10, consumed: 0 });
});

test("NOVA_CANDIDATES_SCHEMA acepta candidatos bien formados y rechaza lo demás", () => {
	assert.deepEqual(validateParams(NOVA_CANDIDATES_SCHEMA, [{ kind: "file", id: "x", chunk: 0, score: 0.3 }]), []);
	assert.ok(validateParams(NOVA_CANDIDATES_SCHEMA, [{ kind: "file", id: "x", chunk: 0, score: 0.3, text: "boo" }]).length > 0);
	assert.ok(validateParams(NOVA_CANDIDATES_SCHEMA, Array.from({ length: 51 }, () => ({ kind: "f", id: "x", chunk: 0, score: 0 }))).length > 0);
});

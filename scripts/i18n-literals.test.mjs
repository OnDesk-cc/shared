// El escáner de textos sin traducir: `node --test scripts/i18n-literals.test.mjs`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scanSource } from "./i18n-literals.mjs";

const file = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures/literals.tsx");
const source = readFileSync(file, "utf8");

test("reporta texto JSX, atributos visibles (también en plantillas) y toasts; ignora className, expresiones y puntuación", () => {
	const found = scanSource("literals.tsx", source).map((f) => f.text);
	assert.deepEqual(found, ["Hello", "Search", "Saved", "Copied", "OnDesk", "Remove …"]);
});

test("cada hallazgo lleva su línea", () => {
	const hello = scanSource("literals.tsx", source).find((f) => f.text === "Hello");
	assert.equal(hello?.line, 5);
});

test("la lista de permitidos quita lo que nombra", () => {
	const found = scanSource("literals.tsx", source, ["OnDesk"]).map((f) => f.text);
	assert.equal(found.length, 5);
	assert.ok(!found.includes("OnDesk"));
});

// El aro de Nova tiene que verse en un navegador sin `@property`: `node --test scripts/nova-ring.test.mjs`.
// Sin registro, `var(--sk-nova-turn)` sin respaldo es inválido al calcular el estilo
// y se lleva todo el `background` (relleno blanco incluido) a su valor inicial.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../styles/product.css"), "utf8");

test("cada var(--sk-nova-turn) lleva un respaldo de 0deg", () => {
	const uses = css.match(/var\(--sk-nova-turn[^)]*\)/g) ?? [];
	assert.ok(uses.length > 0, "el aro usa --sk-nova-turn");
	for (const use of uses) assert.equal(use, "var(--sk-nova-turn, 0deg)");
});

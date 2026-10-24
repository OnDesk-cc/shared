// Los estilos de las primitivas de consola (styles/kit.css) valen en los productos
// (`<html class="site sk">`) y en la consola de ondesk (`<div class="site sk">`): `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (name: string) => readFileSync(new URL(`../styles/${name}`, import.meta.url), "utf8");

test("kit.css: las filas, la píldora, el conmutador, el panel sin relleno y el aviso, sin atarse a <html>", () => {
	const kit = read("kit.css");
	for (const cls of [".sk-rows", ".sk-row", ".sk-tag", ".sk-seg", ".sk-flush", ".sk-callout"]) assert.ok(kit.includes(`.site.sk ${cls}`), cls);
	assert.ok(!kit.includes("html.site.sk"), "un selector html.site.sk no se aplica dentro del <div> de ondesk");
});

test("product.css importa kit.css y ya no repite sus reglas", () => {
	const product = read("product.css");
	assert.match(product, /@import "\.\/kit\.css";/);
	assert.ok(!/html\.site\.sk \.sk-(row|tag|seg|flush|callout)\b/.test(product));
});

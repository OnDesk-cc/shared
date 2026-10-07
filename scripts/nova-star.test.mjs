// Prueba de la geometría de la estrella de Nova: `node --test scripts/nova-star.test.mjs`.
// Node 22.18+ quita los tipos del `.ts` que importa; shared no tiene ejecutor de pruebas.
import { test } from "node:test";
import assert from "node:assert/strict";
import { NOVA_HUES, NOVA_STAR_PATH, mixHex, novaHueAt, novaWedges } from "../lib/nova-star.ts";

test("los seis colores son los de las apps, en orden de matiz", () => {
	assert.deepEqual([...NOVA_HUES], ["#ee6c2b", "#5aa82e", "#17996a", "#0b9fb3", "#4466f2", "#8f55e8"]);
});

test("mixHex en los extremos y en medio", () => {
	assert.equal(mixHex("#000000", "#ffffff", 0), "#000000");
	assert.equal(mixHex("#000000", "#ffffff", 1), "#ffffff");
	assert.equal(mixHex("#000000", "#ffffff", 0.5), "#808080");
});

test("el degradado empieza en Orbit, pasa por cada app y cierra la vuelta", () => {
	NOVA_HUES.forEach((hex, i) => assert.equal(novaHueAt(i / 6), hex));
	assert.equal(novaHueAt(1), NOVA_HUES[0]);
	assert.equal(novaHueAt(-1 / 6), NOVA_HUES[5]);
});

test("24 cuñas cerradas que salen del centro, cada una con su color", () => {
	const wedges = novaWedges();
	assert.equal(wedges.length, 24);
	for (const { d, fill } of wedges) {
		assert.match(d, /^M12 12L-?[\d.]+ -?[\d.]+L-?[\d.]+ -?[\d.]+Z$/);
		assert.match(fill, /^#[0-9a-f]{6}$/);
	}
	assert.notEqual(wedges[0].fill, wedges[12].fill);
});

test("la estrella es una sola figura cerrada de cuatro curvas", () => {
	assert.equal((NOVA_STAR_PATH.match(/Q/g) ?? []).length, 4);
	assert.ok(NOVA_STAR_PATH.startsWith("M12 1") && NOVA_STAR_PATH.endsWith("Z"));
});

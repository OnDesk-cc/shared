// Interpolación, plurales y formato con Intl: `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDate, formatNumber, formatRelative, interpolate, plural } from "./format.ts";

test("interpolate rellena y deja intacto un placeholder sin valor", () => {
	assert.equal(interpolate("Hola {name}, {x}", { name: "Ana" }), "Hola Ana, {x}");
	assert.equal(interpolate("{n} de {total}", { n: 3, total: 10 }), "3 de 10");
	assert.equal(interpolate("Sin variables"), "Sin variables");
});

test("plural en es y formato del número", () => {
	const f = { one: "{count} asiento", other: "{count} asientos" };
	assert.equal(plural("es", f, 1), "1 asiento");
	assert.equal(plural("es", f, 0), "0 asientos");
	assert.equal(plural("es", f, 1200), `${new Intl.NumberFormat("es-419").format(1200)} asientos`);
});

test("plural rellena otras variables", () => {
	assert.equal(plural("pt", { one: "{count} item em {where}", other: "{count} itens em {where}" }, 2, { where: "Atlas" }), "2 itens em Atlas");
});

test("formatDate acepta segundos unix", () => {
	assert.match(formatDate("pt", 1767225600, { year: "numeric", timeZone: "UTC" }), /2026/);
	assert.equal(formatDate("en", new Date(Date.UTC(2026, 0, 1)), { month: "long", timeZone: "UTC" }), "January");
	assert.equal(formatDate("es", new Date(Date.UTC(2026, 0, 1)), { month: "long", timeZone: "UTC" }), "enero");
	assert.equal(formatDate("pt", new Date(Date.UTC(2026, 0, 1)), { month: "long", timeZone: "UTC" }), "janeiro");
});

test("formatRelative habla el idioma pedido", () => {
	const now = new Date(Date.UTC(2026, 0, 10, 12));
	assert.equal(formatRelative("en", new Date(Date.UTC(2026, 0, 10, 9)), now), "3 hours ago");
	assert.equal(formatRelative("es", new Date(Date.UTC(2026, 0, 7, 12)), now), "hace 3 días");
	assert.equal(formatRelative("pt", now.getTime() / 1000 - 30, now), "agora");
});

test("formatNumber agrupa según el idioma", () => {
	assert.equal(formatNumber("en", 1234.5), "1,234.5");
	assert.equal(formatNumber("pt", 1234.5), "1.234,5");
});

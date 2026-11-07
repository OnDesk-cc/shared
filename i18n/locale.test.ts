// Resolución del idioma de una persona: `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isLocale, localeFromTag, resolveLocale } from "./locale.ts";

test("resolveLocale: apagado siempre es en", () => {
	assert.equal(resolveLocale({ enabled: false, profile: "es", cookie: "pt", navigator: ["pt-BR"] }), "en");
});

test("resolveLocale: el perfil gana", () => {
	assert.equal(resolveLocale({ enabled: true, profile: "pt", cookie: "es", navigator: ["en-US"] }), "pt");
});

test("resolveLocale: cookie antes que navegador", () => {
	assert.equal(resolveLocale({ enabled: true, profile: null, cookie: "es", navigator: ["pt-BR"] }), "es");
});

test("resolveLocale: cookie inválida se ignora", () => {
	assert.equal(resolveLocale({ enabled: true, profile: null, cookie: "de", navigator: ["pt-PT", "en"] }), "pt");
});

test("resolveLocale: nada conocido es en", () => {
	assert.equal(resolveLocale({ enabled: true, profile: null, cookie: null, navigator: ["de-DE", "fr"] }), "en");
});

test("localeFromTag", () => {
	const cases = [
		["es-mx", "es"],
		["pt-BR", "pt"],
		["en-US", "en"],
		["pt-419", "pt"],
		["es", "es"],
		["de-DE", null],
		["", null],
		[null, null],
		[undefined, null],
	] as const;
	for (const [input, expected] of cases) assert.equal(localeFromTag(input), expected, String(input));
});

test("isLocale", () => {
	assert.equal(isLocale("es"), true);
	assert.equal(isLocale("es-mx"), false);
	assert.equal(isLocale(null), false);
});

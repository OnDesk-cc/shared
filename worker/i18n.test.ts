// Utilidades de idioma del servidor: `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { localeOr, stripeLocale } from "./i18n.ts";

test("stripeLocale", () => {
	assert.deepEqual((["en", "es", "pt"] as const).map(stripeLocale), ["en", "es-419", "pt-BR"]);
});

test("localeOr valida y cae al respaldo", () => {
	assert.equal(localeOr("pt"), "pt");
	assert.equal(localeOr("de"), "en");
	assert.equal(localeOr(null, "es"), "es");
	assert.equal(localeOr(undefined), "en");
});

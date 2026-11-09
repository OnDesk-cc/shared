// Cuándo una app le dice a ondesk el idioma que resolvió: `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldReportLocale } from "./report-locale";

test("con «Automático» y un idioma nuevo, se avisa", () => {
	assert.equal(shouldReportLocale({ locale: null, last_locale: "en" }, "es", null), true);
	assert.equal(shouldReportLocale({ locale: null, last_locale: null }, "pt", null), true);
});

test("no se avisa sin sesión, con un idioma elegido, si ya coincide o si ya se mandó", () => {
	assert.equal(shouldReportLocale(null, "es", null), false);
	assert.equal(shouldReportLocale({ locale: "pt", last_locale: "en" }, "es", null), false);
	assert.equal(shouldReportLocale({ locale: null, last_locale: "es" }, "es", null), false);
	assert.equal(shouldReportLocale({ locale: null, last_locale: "en" }, "es", "es"), false);
});

test("un usuario de una app que todavía no recibe los campos de idioma también avisa", () => {
	assert.equal(shouldReportLocale({}, "es", null), true);
});

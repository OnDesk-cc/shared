// La cookie ondesk_lang: `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { langCookieString, readLangCookie } from "./cookie.ts";

test("cookie con dominio en ondesk.cc y sus subdominios", () => {
	assert.equal(langCookieString("es", "nexus.ondesk.cc", true), "ondesk_lang=es; Domain=.ondesk.cc; Path=/; Max-Age=31536000; SameSite=Lax; Secure");
	assert.match(langCookieString("pt", "ondesk.cc", true), /Domain=\.ondesk\.cc/);
});

test("cookie sin dominio en localhost, pages.dev y dominios parecidos", () => {
	assert.equal(langCookieString("pt", "localhost", false), "ondesk_lang=pt; Path=/; Max-Age=31536000; SameSite=Lax");
	assert.doesNotMatch(langCookieString("pt", "abc.atlas.pages.dev", true), /Domain=/);
	assert.doesNotMatch(langCookieString("pt", "evilondesk.cc", true), /Domain=/);
});

test("readLangCookie", () => {
	assert.equal(readLangCookie("a=1; ondesk_lang=pt; b=2"), "pt");
	assert.equal(readLangCookie("ondesk_lang=xx"), null);
	assert.equal(readLangCookie(""), null);
	assert.equal(readLangCookie("x_ondesk_lang=es"), null);
});

// El correo de producto: `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createEmailer } from "./email.ts";

test("un correo de producto no pide nada a Google Fonts: se queda con las fuentes del sistema", () => {
	const { notificationEmail } = createEmailer({ brandName: "OnDesk Halo", productName: "Halo" });
	const html = notificationEmail({ recipientName: "Ana", heading: "Hello", body: "there", url: "https://halo.ondesk.cc", ctaLabel: "Open", locale: "en" });
	assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic/);
	assert.match(html, /Segoe UI/);
});

test("notificationEmail traduce los textos fijos de la plantilla", () => {
	const { notificationEmail } = createEmailer({ brandName: "OnDesk Halo", productName: "Halo" });
	const base = { recipientName: "Ana", heading: "Nueva reunión", body: "te invitaron", url: "https://halo.ondesk.cc", preview: "x", warning: "y", preferencesUrl: "https://halo.ondesk.cc/p" };
	const es = notificationEmail({ ...base, locale: "es" });
	assert.match(es, /<html lang="es"/);
	assert.match(es, /Hola Ana, te invitaron/);
	assert.match(es, /Abrir en Halo/);
	assert.match(es, /Vista previa/);
	assert.match(es, /Gestionar preferencias/);
	assert.doesNotMatch(es, /Open in|Manage preferences|>Preview</);
	const pt = notificationEmail({ ...base, locale: "pt" });
	assert.match(pt, /<html lang="pt-BR"/);
	assert.match(pt, /Olá Ana/);
	assert.match(pt, /Abrir no Halo/);
	const en = notificationEmail({ ...base, locale: "en" });
	assert.match(en, /Hi Ana, te invitaron/);
	assert.match(en, /Open in Halo/);
});

// El correo de producto: `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createEmailer } from "./email.ts";

test("un correo de producto no pide nada a Google Fonts: se queda con las fuentes del sistema", () => {
	const { notificationEmail } = createEmailer({ brandName: "OnDesk Halo", productName: "Halo" });
	const html = notificationEmail({ recipientName: "Ana", heading: "Hello", body: "there", url: "https://halo.ondesk.cc", ctaLabel: "Open" });
	assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic/);
	assert.match(html, /Segoe UI/);
});

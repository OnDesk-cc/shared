// El detector de idioma de un mensaje entrante (Pulse): `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectTextLocale } from "./detect-language.ts";

test("detecta es/pt/en en textos normales", () => {
	assert.equal(detectTextLocale("Hola, no puedo entrar a mi cuenta desde ayer, ¿me pueden ayudar por favor?"), "es");
	assert.equal(detectTextLocale("Olá, não consigo acessar minha conta desde ontem, vocês podem me ajudar?"), "pt");
	assert.equal(detectTextLocale("Hi, I can't log into my account since yesterday, can you help me please?"), "en");
});

test("texto corto o vacío da null", () => {
	assert.equal(detectTextLocale("ok gracias"), null);
	assert.equal(detectTextLocale(""), null);
	assert.equal(detectTextLocale("   \n "), null);
});

test("ignora la cita y la firma", () => {
	const msg =
		"Obrigado, vocês resolveram muito rápido o meu problema com a fatura.\n\n" +
		"On Mon, Jan 5, Support wrote:\n> Hi, we have fixed the issue with your invoice and the account is now active and you can use it";
	assert.equal(detectTextLocale(msg), "pt");
	const signed = "Necesito cambiar el correo de la cuenta, ya no tengo acceso al anterior.\n-- \nSent from my iPhone. The content of this email is confidential and is intended for the recipient";
	assert.equal(detectTextLocale(signed), "es");
});

test("quita el HTML antes de contar", () => {
	assert.equal(detectTextLocale("<div><p>Bom dia, <b>preciso</b> de uma segunda via do boleto para o mês de março, por favor.</p></div>"), "pt");
});

test("mezcla sin ganador claro da null", () => {
	assert.equal(detectTextLocale("hola hello the de que and para"), null);
});

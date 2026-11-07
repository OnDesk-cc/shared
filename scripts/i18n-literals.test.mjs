// El escáner de textos sin traducir: `node --test scripts/i18n-literals.test.mjs`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDictionaryPath, scanSource } from "./i18n-literals.mjs";

const file = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures/literals.tsx");
const source = readFileSync(file, "utf8");

test("reporta texto JSX, atributos visibles (también en plantillas) y toasts; ignora className, expresiones y puntuación", () => {
	const found = scanSource("literals.tsx", source).map((f) => f.text);
	assert.deepEqual(found, ["Hello", "Search", "Saved", "Copied", "Unnamed", "OnDesk", "Remove …"]);
});

test("cada hallazgo lleva su línea", () => {
	const hello = scanSource("literals.tsx", source).find((f) => f.text === "Hello");
	assert.equal(hello?.line, 5);
});

test("reporta el texto de un objeto (migas, opciones, menús) por el nombre de su campo; ignora ids y valores en minúscula", () => {
	const src = [
		'const crumbs = [{ label: "Account", to: "/account" }, { label: title }];',
		'const opts = [{ id: "form", label: "Form-encoded" }, { id: "json", label: "json" }];',
		'const back = { to: "/", label: "Back to sign in" };',
		'const err = { message: "Something went wrong.", code: "invalid_locale" };',
		'const kind = { type: "Bearer", hint: "Like ?api_key=<key> at the end of every call." };',
	].join("\n");
	const found = scanSource("objects.ts", src).map((f) => f.text);
	assert.deepEqual(found, ["Account", "Form-encoded", "Back to sign in", "Something went wrong.", "Like ?api_key=<key> at the end of every call."]);
});

test("un atributo visible con una condición reporta cada rama de texto (también `error`)", () => {
	const src = 'export const F = () => <Field error={missing ? "A workspace needs a name." : null} label={ok ? "Ready" : label} id={a ? "x-1" : "x-2"} />;';
	const found = scanSource("cond.tsx", src).map((f) => f.text);
	assert.deepEqual(found, ["A workspace needs a name.", "Ready"]);
});

test("las carpetas de diccionarios no se escanean", () => {
	assert.equal(isDictionaryPath("src/console-i18n/en/auth.ts"), true);
	assert.equal(isDictionaryPath("src/i18n/locales/en/about.ts"), true);
	assert.equal(isDictionaryPath("src/features/auth/sign-in.tsx"), false);
});

test("la lista de permitidos quita lo que nombra", () => {
	const found = scanSource("literals.tsx", source, ["OnDesk"]).map((f) => f.text);
	assert.equal(found.length, 6);
	assert.ok(!found.includes("OnDesk"));
});

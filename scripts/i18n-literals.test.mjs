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
		'const opt = { value: "public", blurb: "Everyone in the workspace can read and post." };',
	].join("\n");
	const found = scanSource("objects.ts", src).map((f) => f.text);
	assert.deepEqual(found, ["Account", "Form-encoded", "Back to sign in", "Something went wrong.", "Like ?api_key=<key> at the end of every call.", "Everyone in the workspace can read and post."]);
});

test("un atributo visible con una condición reporta cada rama de texto (también `error`)", () => {
	const src = 'export const F = () => <Field error={missing ? "A workspace needs a name." : null} label={ok ? "Ready" : label} id={a ? "x-1" : "x-2"} />;';
	const found = scanSource("cond.tsx", src).map((f) => f.text);
	assert.deepEqual(found, ["A workspace needs a name.", "Ready"]);
});

test("el mensaje de respaldo de un cliente de API y el texto de un Error se ven; los errores de desarrollo no", () => {
	const src = [
		'export const a = () => apiGet(url, "Could not load your spaces");',
		'export const b = () => unwrap(res, "Could not book that time");',
		'export const c = () => apiSend(url, "POST", body, "Could not save that change");',
		'export const d = () => { throw new Error("That file is too big"); };',
		'export const e = () => { throw new Error("useAuth must be used within AuthProvider"); };',
		'export const f = () => apiGet(url, L().dict.common.requestFailed);',
		'export const g = () => fetch(url, { method: "POST" });',
	].join("\n");
	const found = scanSource("api.ts", src).map((f) => f.text);
	assert.deepEqual(found, ["Could not load your spaces", "Could not book that time", "Could not save that change", "That file is too big"]);
});

test("un rótulo devuelto con return se ve (también en las ramas de una condición); siglas y valores en minúscula no", () => {
	const src = [
		'export function due(d: number) { if (d === 0) return "Today"; return d > 0 ? "Tomorrow" : "Overdue"; }',
		'export function method() { return "GET"; }',
		'export function kind() { return "public"; }',
	].join("\n");
	const found = scanSource("format.ts", src).map((f) => f.text);
	assert.deepEqual(found, ["Today", "Tomorrow", "Overdue"]);
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

test("data-label: el rótulo de columna que el CSS enseña en móvil también es texto visible", () => {
	const found = scanSource("table.tsx", 'export const R = () => <td data-label="Status">x</td>;').map((f) => f.text);
	assert.ok(found.includes("Status"));
});

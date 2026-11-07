// El idioma en el espejo de los productos: `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { openTestDb } from "../test/sqlite-d1.mjs";
import { upsertMirroredUser, upsertMirroredWorkspace } from "./mirror.ts";

const SCHEMA = `
CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, logo_url TEXT, locale TEXT,
  updated_at INTEGER);
CREATE TABLE workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL, description TEXT, logo_url TEXT,
  audit_log_enabled INTEGER NOT NULL DEFAULT 1, created_by TEXT, customer_locale TEXT, updated_at INTEGER);
`;

function open(schema: string) {
	return openTestDb(schema).db as any;
}

const OLD_SCHEMA = `
CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, logo_url TEXT, updated_at INTEGER);
`;

test("upsertMirroredUser guarda locale", async () => {
	const db = open(SCHEMA);
	await upsertMirroredUser(db, { id: "u1", name: "Ana", email: "A@x.com", logo_url: null, locale: "pt" });
	assert.equal((await db.prepare("SELECT locale FROM users WHERE id = 'u1'").first())?.locale, "pt");
});

test("upsertMirroredUser sin locale no toca el guardado", async () => {
	const db = open(SCHEMA);
	await upsertMirroredUser(db, { id: "u1", name: "Ana", email: "a@x.com", logo_url: null, locale: "es" });
	await upsertMirroredUser(db, { id: "u1", name: "Ana B", email: "a@x.com", logo_url: null });
	const row = await db.prepare("SELECT name, locale FROM users WHERE id = 'u1'").first();
	assert.deepEqual({ ...row }, { name: "Ana B", locale: "es" });
});

test("upsertMirroredUser sin locale funciona en un producto sin la columna", async () => {
	const db = open(OLD_SCHEMA);
	await upsertMirroredUser(db, { id: "u1", name: "Ana", email: "a@x.com", logo_url: null });
	assert.equal((await db.prepare("SELECT name FROM users").first())?.name, "Ana");
});

test("upsertMirroredWorkspace guarda customer_locale", async () => {
	const db = open(SCHEMA);
	await upsertMirroredWorkspace(db, { id: "w1", name: "Acme", slug: "acme", logo_url: null, customer_locale: "pt" }, "u1");
	const row = await db.prepare("SELECT customer_locale FROM workspaces").first();
	assert.deepEqual({ ...row }, { customer_locale: "pt" });
	await upsertMirroredWorkspace(db, { id: "w1", name: "Acme 2", slug: "acme", logo_url: null }, "u1");
	const after = await db.prepare("SELECT name, customer_locale FROM workspaces").first();
	assert.deepEqual({ ...after }, { name: "Acme 2", customer_locale: "pt" });
});

// La purga de un workspace borrado: `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
	PURGE_DELAY_SECONDS,
	WORKSPACE_PURGES_SQL,
	keysFromCdnUrls,
	runDuePurges,
	scheduleWorkspacePurge,
} from "./workspace-purge.ts";

/** Una D1 mínima sobre node:sqlite, con las claves foráneas encendidas como en D1. */
function d1(raw: DatabaseSync): D1Database {
	const statement = (sql: string, args: unknown[] = []) => ({
		bind: (...next: unknown[]) => statement(sql, next),
		async first<T>() {
			return (raw.prepare(sql).get(...(args as never[])) ?? null) as T | null;
		},
		async all<T>() {
			return { results: raw.prepare(sql).all(...(args as never[])) as T[], success: true, meta: {} };
		},
		async run() {
			const r = raw.prepare(sql).run(...(args as never[]));
			return { success: true, meta: { changes: Number(r.changes) } };
		},
	});
	return { prepare: (sql: string) => statement(sql) } as unknown as D1Database;
}

function seeded() {
	const raw = new DatabaseSync(":memory:");
	raw.exec("PRAGMA foreign_keys = ON;");
	raw.exec(WORKSPACE_PURGES_SQL);
	raw.exec(`
		CREATE TABLE workspaces (id TEXT PRIMARY KEY);
		CREATE TABLE projects (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE);
		-- Una tabla con workspace_id SIN cascada que apunta a projects SIN cascada y va después en orden alfabético: el primer intento de borrar projects falla y se reintenta.
		CREATE TABLE zz_audit (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, project_id TEXT REFERENCES projects(id));
		-- Sin workspace_id: cae en cascada con su proyecto.
		CREATE TABLE tasks (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE);
		INSERT INTO workspaces VALUES ('w1'), ('w2');
		INSERT INTO projects VALUES ('p1', 'w1'), ('p2', 'w2');
		INSERT INTO zz_audit VALUES ('a1', 'w1', 'p1'), ('a2', 'w2', 'p2');
		INSERT INTO tasks VALUES ('t1', 'p1'), ('t2', 'p2');
	`);
	return { raw, db: d1(raw) };
}

const count = (raw: DatabaseSync, sql: string) => (raw.prepare(sql).get() as { n: number }).n;

test("scheduleWorkspacePurge: a 30 días, y programarla dos veces no mueve la fecha", async () => {
	const { raw, db } = seeded();
	await scheduleWorkspacePurge(db, "w1", 1000);
	await scheduleWorkspacePurge(db, "w1", 5000);
	const row = raw.prepare("SELECT due_at FROM workspace_purges WHERE workspace_id = 'w1'").get() as { due_at: number };
	assert.equal(row.due_at, 1000 + PURGE_DELAY_SECONDS);
});

test("runDuePurges: antes de la fecha no borra nada; después borra todo lo del workspace, también sin cascada, y deja el resto", async () => {
	const { raw, db } = seeded();
	await scheduleWorkspacePurge(db, "w1", 0);
	const deleted: string[] = [];
	const listed: string[] = [];
	const storage = {
		list: async ({ prefix }: { prefix: string }) => {
			listed.push(prefix);
			return { objects: [{ key: `${prefix}a` }, { key: `${prefix}b` }], truncated: false };
		},
		delete: async (keys: string[]) => {
			deleted.push(...keys);
		},
	};
	const before: string[] = [];
	const opts = {
		storage,
		objects: async (ws: string) => ({ prefixes: [`w/${ws}/`], keys: ["inbox/1/0"] }),
		beforeRows: async (ws: string) => {
			before.push(ws);
		},
	};

	assert.deepEqual(await runDuePurges(db, { ...opts, now: PURGE_DELAY_SECONDS - 1 }), []);
	assert.equal(count(raw, "SELECT COUNT(*) AS n FROM projects"), 2);

	assert.deepEqual(await runDuePurges(db, { ...opts, now: PURGE_DELAY_SECONDS }), ["w1"]);
	assert.equal(count(raw, "SELECT COUNT(*) AS n FROM workspaces WHERE id = 'w1'"), 0);
	assert.equal(count(raw, "SELECT COUNT(*) AS n FROM zz_audit WHERE workspace_id = 'w1'"), 0);
	assert.equal(count(raw, "SELECT COUNT(*) AS n FROM tasks WHERE id = 't1'"), 0);
	assert.equal(count(raw, "SELECT COUNT(*) AS n FROM projects WHERE workspace_id = 'w2'"), 1);
	assert.equal(count(raw, "SELECT COUNT(*) AS n FROM tasks WHERE id = 't2'"), 1);
	assert.deepEqual(listed, ["w/w1/"]);
	assert.deepEqual(before, ["w1"]);
	assert.deepEqual(deleted.sort(), ["inbox/1/0", "w/w1/a", "w/w1/b"]);
	assert.ok((raw.prepare("SELECT done_at FROM workspace_purges WHERE workspace_id = 'w1'").get() as { done_at: number }).done_at);

	// Hecha una vez, no se repite.
	assert.deepEqual(await runDuePurges(db, { ...opts, now: PURGE_DELAY_SECONDS * 2 }), []);
});

test("keysFromCdnUrls: la clave de R2 detrás de cada /cdn/, sin repetir, ignorando lo demás", () => {
	assert.deepEqual(
		keysFromCdnUrls(["/cdn/logos/a.png", "https://pulse.ondesk.cc/cdn/avatars/b.webp", null, "https://example.com/x.png", "/cdn/logos/a.png"]),
		["logos/a.png", "avatars/b.webp"],
	);
});

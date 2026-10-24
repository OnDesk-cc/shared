/**
 * Una D1 de juguete para las pruebas de shared (node:test vía tsx): node:sqlite
 * en memoria con el esquema que pasa la prueba (shared no tiene base propia),
 * y la misma forma que el binding de D1
 * (`prepare().bind().first|all|run` y `batch`). Copiada de
 * nexus/test/sqlite-d1.mjs (que viene de pulse y de nova).
 *
 *  - Las claves foráneas van encendidas, como en D1: los `ON DELETE CASCADE` se
 *    prueban de verdad.
 *  - `batch` es una transacción: si una sentencia falla, no queda nada.
 *  - Un `boolean` o un `undefined` en `bind` lanzan, igual que en D1: el código
 *    tiene que pasar 0/1 y null.
 *  - Más de 100 parámetros en una sentencia también lanzan, como en D1: una
 *    consulta `IN (…)` tiene que ir en trozos.
 *
 * Es .mjs y vive fuera de worker/ y components/ para que `tsc` (que no conoce los
 * tipos de Node), ESLint (sólo mira .ts/.tsx) y `npm test` no lo miren.
 */
import { DatabaseSync } from "node:sqlite";

const MAX_PARAMS = 100;

function checkArgs(args) {
	if (args.length > MAX_PARAMS) throw new RangeError(`D1_ERROR: too many SQL variables (${args.length} > ${MAX_PARAMS})`);
	for (const a of args) {
		if (a === undefined) throw new TypeError("D1_TYPE_ERROR: undefined is not supported");
		if (typeof a === "boolean") throw new TypeError("D1_TYPE_ERROR: boolean is not supported, bind 0/1");
	}
	return args;
}

const plain = (row) => (row ? { ...row } : row);
const isRead = (sql) => /^\s*(SELECT|WITH)\b/i.test(sql) || /\bRETURNING\b/i.test(sql);

function statement(raw, sql, args = []) {
	return {
		bind: (...next) => statement(raw, sql, checkArgs(next)),
		async first(column) {
			const row = raw.prepare(sql).get(...args);
			if (!row) return null;
			return column ? row[column] : plain(row);
		},
		async all() {
			return { results: raw.prepare(sql).all(...args).map(plain), success: true, meta: {} };
		},
		async run() {
			const res = raw.prepare(sql).run(...args);
			return { results: [], success: true, meta: { changes: Number(res.changes), last_row_id: Number(res.lastInsertRowid) } };
		},
		/** Lo que devuelve D1 por sentencia dentro de un batch. */
		execForBatch() {
			if (isRead(sql)) return { results: raw.prepare(sql).all(...args).map(plain), success: true, meta: {} };
			const res = raw.prepare(sql).run(...args);
			return { results: [], success: true, meta: { changes: Number(res.changes), last_row_id: Number(res.lastInsertRowid) } };
		},
	};
}

/** `{ db, raw }`: `db` hace de D1Database; `raw` es el DatabaseSync, para sembrar y mirar las tablas. */
export function openTestDb(schemaSql) {
	const raw = new DatabaseSync(":memory:");
	raw.exec("PRAGMA foreign_keys = ON;");
	raw.exec(schemaSql);
	const db = {
		prepare: (sql) => statement(raw, sql),
		async batch(statements) {
			raw.exec("BEGIN");
			try {
				const out = statements.map((s) => s.execForBatch());
				raw.exec("COMMIT");
				return out;
			} catch (err) {
				raw.exec("ROLLBACK");
				throw err;
			}
		},
		async exec(sql) {
			raw.exec(sql);
			return { count: 0, duration: 0 };
		},
	};
	return { db, raw };
}

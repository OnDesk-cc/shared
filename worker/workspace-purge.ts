/**
 * La purga de un workspace borrado, igual en los seis productos (2026-10-30).
 *
 * ─── Por qué ─────────────────────────────────────────────────────────────────
 *
 * Cuando el dueño borra un workspace, ondesk borra sus filas y emite
 * `workspace.deleted`. Hasta ahora cada producto sólo revocaba el acceso y se
 * quedaba con todo (filas y objetos de R2) para siempre, y el DPA promete lo
 * contrario: «you have thirty days to export, after which we delete your content
 * from the live systems». El webhook programa la purga a `PURGE_DELAY_SECONDS`
 * (`scheduleWorkspacePurge`) y el reconcile horario ejecuta las vencidas
 * (`runDuePurges`). Los treinta días dejan deshacer un borrado por error
 * escribiendo a soporte.
 *
 * ─── Cómo borra ──────────────────────────────────────────────────────────────
 *
 * Sin una lista de tablas por producto que se quede vieja con la siguiente
 * migración: lee del propio esquema las tablas que tienen `workspace_id` y las
 * vacía de ese workspace, repitiendo las que una clave foránea sin cascada
 * todavía no deja borrar, y al final borra la fila de `workspaces`, que se lleva
 * en cascada lo que cuelga de ella. Los objetos de R2 se borran DESPUÉS de las
 * filas y se leen ANTES (una fila borrada ya no dice qué objeto era suyo): por
 * prefijo cuando el producto guarda bajo uno por workspace (Atlas `w/<id>/`, Halo
 * `recordings/<id>/`), por clave suelta cuando no (`keysFromCdnUrls`).
 *
 * Las tablas espejo que no son de un workspace (`users`) no se tocan.
 */

/** Treinta días: el plazo del DPA para exportar antes de que se borre. */
export const PURGE_DELAY_SECONDS = 30 * 24 * 60 * 60;

/** La tabla de purgas; cada producto la crea en su migración y en schema.sql. */
export const WORKSPACE_PURGES_SQL = `CREATE TABLE IF NOT EXISTS workspace_purges (
  workspace_id TEXT    PRIMARY KEY,
  due_at       INTEGER NOT NULL,
  done_at      INTEGER,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);`;

/** Lo que el webhook hace con `workspace.deleted`. Idempotente: no mueve una fecha ya puesta. */
export async function scheduleWorkspacePurge(db: D1Database, workspaceId: string, now = Math.floor(Date.now() / 1000)): Promise<void> {
	await db
		.prepare("INSERT INTO workspace_purges (workspace_id, due_at) VALUES (?, ?) ON CONFLICT(workspace_id) DO NOTHING")
		.bind(workspaceId, now + PURGE_DELAY_SECONDS)
		.run();
}

/** Los objetos de R2 de un workspace: prefijos que listar y claves sueltas. */
export interface PurgeObjects {
	prefixes: string[];
	keys: string[];
}

/** Lo justo del binding de R2 que usa la purga. */
export interface PurgeStorage {
	list(options: { prefix: string; cursor?: string }): Promise<{ objects: { key: string }[]; truncated: boolean; cursor?: string }>;
	delete(keys: string[]): Promise<void>;
}

/** La clave de R2 detrás de cada URL `/cdn/<clave>` (logos y avatares subidos), sin repetir. */
export function keysFromCdnUrls(urls: (string | null | undefined)[]): string[] {
	const keys = new Set<string>();
	for (const url of urls) {
		if (!url) continue;
		const at = url.indexOf("/cdn/");
		if (at === -1) continue;
		const key = url.slice(at + "/cdn/".length).split(/[?#]/)[0];
		if (key) keys.add(key);
	}
	return [...keys];
}

/** Las tablas de este esquema con columna `workspace_id`, salvo `workspaces` y las purgas. */
async function workspaceTables(db: D1Database): Promise<string[]> {
	const { results } = await db
		.prepare(
			`SELECT m.name AS name FROM sqlite_master m
			 WHERE m.type = 'table' AND m.name NOT LIKE 'sqlite_%' AND m.name NOT LIKE '_cf_%'
			   AND m.name NOT IN ('workspaces', 'workspace_purges')
			   AND EXISTS (SELECT 1 FROM pragma_table_info(m.name) p WHERE p.name = 'workspace_id')
			 ORDER BY m.name`,
		)
		.all<{ name: string }>();
	return results.map((row) => row.name);
}

/** Borra todas las filas de un workspace, en el orden que dejen las claves foráneas. */
async function purgeWorkspaceRows(db: D1Database, workspaceId: string): Promise<void> {
	let pending = await workspaceTables(db);
	// Cada pasada borra lo que pueda; una clave foránea sin cascada hace esperar
	// a la tabla que apunta hasta que caiga la apuntada. Sin progreso, se lanza.
	while (pending.length > 0) {
		const failed: string[] = [];
		let lastError: unknown = null;
		for (const table of pending) {
			try {
				await db.prepare(`DELETE FROM "${table.replace(/"/g, '""')}" WHERE workspace_id = ?`).bind(workspaceId).run();
			} catch (err) {
				failed.push(table);
				lastError = err;
			}
		}
		if (failed.length === pending.length) throw lastError;
		pending = failed;
	}
	await db.prepare("DELETE FROM workspaces WHERE id = ?").bind(workspaceId).run();
}

async function deleteObjects(storage: PurgeStorage, objects: PurgeObjects): Promise<void> {
	const keys = [...objects.keys];
	for (const prefix of objects.prefixes) {
		let cursor: string | undefined;
		do {
			const page = await storage.list({ prefix, ...(cursor ? { cursor } : {}) });
			keys.push(...page.objects.map((object) => object.key));
			cursor = page.truncated ? page.cursor : undefined;
		} while (cursor);
	}
	// R2 borra hasta 1000 claves por llamada.
	for (let i = 0; i < keys.length; i += 1000) await storage.delete(keys.slice(i, i + 1000));
}

/**
 * Ejecuta las purgas vencidas y devuelve los workspaces purgados. Lo llama el
 * reconcile horario de cada producto. Una purga que falla se queda pendiente y se
 * reintenta en la siguiente pasada; no tumba a las demás.
 */
export async function runDuePurges(
	db: D1Database,
	opts: {
		storage?: PurgeStorage;
		/** Los objetos de R2 del workspace, leídos antes de borrar las filas. */
		objects?: (workspaceId: string) => Promise<PurgeObjects>;
		/**
		 * Lo que hay que borrar a mano antes de las filas: una tabla sin
		 * `workspace_id` que apunta sin cascada a una que sí lo tiene (en Pulse,
		 * `email_tickets` → `tickets`). Sin esto la purga se queda a medias.
		 */
		beforeRows?: (workspaceId: string) => Promise<void>;
		now?: number;
	} = {},
): Promise<string[]> {
	const now = opts.now ?? Math.floor(Date.now() / 1000);
	const { results } = await db
		.prepare("SELECT workspace_id FROM workspace_purges WHERE done_at IS NULL AND due_at <= ? ORDER BY due_at LIMIT 20")
		.bind(now)
		.all<{ workspace_id: string }>();

	const purged: string[] = [];
	for (const { workspace_id: workspaceId } of results) {
		try {
			const objects = opts.objects ? await opts.objects(workspaceId) : { prefixes: [], keys: [] };
			if (opts.beforeRows) await opts.beforeRows(workspaceId);
			await purgeWorkspaceRows(db, workspaceId);
			if (opts.storage) await deleteObjects(opts.storage, objects);
			await db.prepare("UPDATE workspace_purges SET done_at = ? WHERE workspace_id = ?").bind(now, workspaceId).run();
			purged.push(workspaceId);
		} catch (err) {
			console.error(`Workspace purge failed for ${workspaceId}; it stays pending:`, err);
		}
	}
	return purged;
}

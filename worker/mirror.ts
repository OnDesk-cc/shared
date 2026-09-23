import type { D1Database } from "@cloudflare/workers-types";

/**
 * El espejo del estado de OnDesk — las escrituras que cada producto hace de forma
 * idéntica.
 *
 * `users`, `workspaces` y `workspace_members` no son de ningún producto — son una
 * caché local del control plane, que se guarda para que las claves foráneas
 * resuelvan y las consultas puedan hacer JOIN sin llamar a ondesk. Los únicos que
 * escriben son el webhook de la plataforma y el job de reconciliación; cualquier
 * otra cosa que escriba en estas tablas se desviará, y la desviación sigue siendo
 * invisible hasta que un JOIN empieza a devolver las filas equivocadas.
 *
 * Lo que NO está aquí es lo que difiere por producto: `removeMirroredMember`
 * (cada producto borra en cascada sus propias filas ligadas a la membresía —
 * concesiones, miembros de canal, miembros de proyecto), el espejo de equipos
 * (no todos los productos tienen equipos), y las escrituras de aprovisionamiento
 * `ensureDefault*`. Eso se queda en el `_lib/db/mirror.ts` de cada app, que
 * reexporta este módulo para el resto.
 */

export interface MirroredUser {
	id: string;
	name: string;
	email: string;
	logo_url: string | null;
}

export async function upsertMirroredUser(db: D1Database, user: MirroredUser): Promise<void> {
	await db
		.prepare(
			`INSERT INTO users (id, name, email, logo_url)
			 VALUES (?, ?, ?, ?)
			 ON CONFLICT(id) DO UPDATE SET
			   name       = excluded.name,
			   email      = excluded.email,
			   logo_url   = excluded.logo_url,
			   updated_at = unixepoch()`,
		)
		.bind(user.id, user.name, user.email.toLowerCase(), user.logo_url)
		.run();
}

export async function upsertMirroredWorkspace(
	db: D1Database,
	workspace: {
		id: string;
		name: string;
		slug: string;
		description?: string | null;
		logo_url: string | null;
		audit_log_enabled?: boolean;
	},
	createdBy: string,
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO workspaces (id, name, slug, description, logo_url, audit_log_enabled, created_by)
			 VALUES (?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(id) DO UPDATE SET
			   name              = excluded.name,
			   slug              = excluded.slug,
			   description       = excluded.description,
			   logo_url          = excluded.logo_url,
			   audit_log_enabled = excluded.audit_log_enabled,
			   updated_at        = unixepoch()`,
		)
		.bind(
			workspace.id,
			workspace.name,
			workspace.slug,
			workspace.description ?? null,
			workspace.logo_url,
			workspace.audit_log_enabled === false ? 0 : 1,
			createdBy,
		)
		.run();
}

/**
 * Todo lo que ondesk nos puede contar de una membresía más allá del rol en el
 * workspace.
 *
 * **En todos los campos, undefined significa «no tocar», y de eso depende
 * todo.** Un webhook salta por la única cosa que cambió, y un control plane más
 * antiguo envía campos de los que esta build nunca ha oído hablar — u omite otros
 * que sí conoce. Escribir `?? null` para un campo ausente dejaría que un
 * `member_updated` que sólo lleva un cambio de rol dejara en blanco un cargo, o
 * que un `permissions_updated` reiniciara una fecha de alta.
 *
 * `job_title: null` es, por tanto, distinto de que `job_title` no venga: lo
 * primero es «un admin lo borró», lo segundo es «esta entrega no dice nada de
 * él».
 */
export interface MirroredMemberPatch {
	/**
	 * Lo que ondesk resolvió a partir del rol del asiento de producto de este
	 * miembro — la respuesta, no la fila de rol de la que salió. Un array vacío es
	 * un miembro sin concesiones, que es algo legítimo de guardar, así que no hay
	 * caso de «borrarlo».
	 */
	permissions?: string[];
	/** A qué se dedica en este workspace. Se pone en la consola de OnDesk, nunca aquí. */
	job_title?: string | null;
	/**
	 * Cuándo entró en el WORKSPACE, según ondesk. El valor por defecto de la
	 * propia columna es el momento en que el espejo insertó la fila por primera
	 * vez — el día en que se le dio un asiento, que no suele ser el día en que
	 * entró — así que el valor de ondesk lo sobrescribe siempre que llega uno.
	 */
	joined_at?: number;
}

export async function upsertMirroredMember(
	db: D1Database,
	workspaceId: string,
	userId: string,
	role: string,
	patch: MirroredMemberPatch = {},
): Promise<void> {
	// Se construye columna a columna y no como una sentencia fija: si no, tres
	// campos opcionales serían una rama por combinación, y la rama que se olvida
	// es la que en silencio escribe un NULL encima del cargo de alguien. Los
	// nombres de abajo son literales de este archivo y nunca vienen del payload.
	const columns = ["id", "workspace_id", "user_id", "role"];
	const values: unknown[] = [crypto.randomUUID(), workspaceId, userId, role];
	const updates = ["role = excluded.role"];

	function include(column: string, value: unknown): void {
		columns.push(column);
		values.push(value);
		updates.push(`${column} = excluded.${column}`);
	}

	if (patch.permissions !== undefined) include("permissions", JSON.stringify(patch.permissions));
	if (patch.job_title !== undefined) include("job_title", patch.job_title);
	if (patch.joined_at !== undefined) include("joined_at", patch.joined_at);

	await db
		.prepare(
			`INSERT INTO workspace_members (${columns.join(", ")})
			 VALUES (${columns.map(() => "?").join(", ")})
			 ON CONFLICT(workspace_id, user_id) DO UPDATE SET ${updates.join(", ")}`,
		)
		.bind(...values)
		.run();
}

/**
 * Editar un rol en ondesk cambia lo que pueden hacer varias personas a la vez,
 * así que llega como un solo evento con todos los que tienen asiento en vez de
 * uno por miembro. A quien no esté en la lista no se le toca: no tiene asiento en
 * este producto y no hay nada que actualizar.
 */
export async function applyMirroredPermissions(
	db: D1Database,
	workspaceId: string,
	members: { user_id: string; permissions: string[] }[],
): Promise<void> {
	for (const member of members) {
		await db
			.prepare("UPDATE workspace_members SET permissions = ? WHERE workspace_id = ? AND user_id = ?")
			.bind(JSON.stringify(member.permissions), workspaceId, member.user_id)
			.run();
	}
}

export async function upsertEntitlement(
	db: D1Database,
	workspaceId: string,
	entitlement: { plan: string; status: string; agent_count: number; current_period_end: number | null },
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO workspace_entitlements (workspace_id, plan, status, agent_count, current_period_end)
			 VALUES (?, ?, ?, ?, ?)
			 ON CONFLICT(workspace_id) DO UPDATE SET
			   plan               = excluded.plan,
			   status             = excluded.status,
			   agent_count        = excluded.agent_count,
			   current_period_end = excluded.current_period_end,
			   updated_at         = unixepoch()`,
		)
		.bind(
			workspaceId,
			entitlement.plan,
			entitlement.status,
			entitlement.agent_count,
			entitlement.current_period_end,
		)
		.run();
}

export async function clearEntitlement(db: D1Database, workspaceId: string): Promise<void> {
	await db
		.prepare(
			"UPDATE workspace_entitlements SET status = 'canceled', updated_at = unixepoch() WHERE workspace_id = ?",
		)
		.bind(workspaceId)
		.run();
}

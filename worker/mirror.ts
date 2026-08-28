import type { D1Database } from "@cloudflare/workers-types";

/**
 * The mirror of OnDesk state — the writes every product performs identically.
 *
 * `users`, `workspaces` and `workspace_members` are not owned by a product —
 * they are a local cache of the control plane, kept so foreign keys resolve and
 * queries can JOIN without calling ondesk. The only writers are the platform
 * webhook and the reconcile job; anything else that writes these tables will
 * drift, and the drift stays invisible until a JOIN starts returning the wrong
 * rows.
 *
 * What is NOT here is what differs per product: `removeMirroredMember` (each
 * product cascades its own membership-scoped rows — grants, channel members,
 * project members), team mirroring (not every product has teams), and the
 * `ensureDefault*` provisioning writes. Those stay in each app's
 * `_lib/db/mirror.ts`, which re-exports this module for the rest.
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
 * Everything ondesk can tell us about one membership beyond the tenancy role.
 *
 * **Every field is undefined-means-leave-alone, and that is load-bearing.** A
 * webhook fires on the one thing that changed, and an older control plane sends
 * fields this build has never heard of — or omits ones it has. Writing `?? null`
 * for an absent field would let a `member_updated` carrying only a role change
 * blank a job title, or let a `permissions_updated` reset a join date.
 *
 * `job_title: null` is therefore different from `job_title` absent: the first is
 * "an admin cleared it", the second is "this delivery says nothing about it".
 */
export interface MirroredMemberPatch {
	/**
	 * What ondesk resolved from the role on this member's product seat — the
	 * answer, not the role row it came from. An empty array is a member with no
	 * grants, which is a legitimate thing to store, so there is no "clear it" case.
	 */
	permissions?: string[];
	/** What they do in this workspace. Set in the OnDesk console, never here. */
	job_title?: string | null;
	/**
	 * When they joined the WORKSPACE, per ondesk. The column's own default is the
	 * moment the mirror first inserted the row — the day they were given a seat,
	 * which is usually not the day they joined — so ondesk's value overwrites it
	 * whenever one arrives.
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
	// Built column-wise rather than as one fixed statement: three optional fields
	// would otherwise be a branch per combination, and the branch that gets
	// forgotten is the one that silently writes a NULL over somebody's title. The
	// names below are literals from this file and never come from the payload.
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
 * A role edit at ondesk changes what several people may do at once, so it
 * arrives as one event carrying every seat holder rather than one per member.
 * Anyone absent from the list is not touched: they hold no seat on this product
 * and have nothing to update.
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

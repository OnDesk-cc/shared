/**
 * La pregunta «¿es miembro de este workspace y tiene un derecho vivo para este
 * producto?», en una sola consulta (2026-10-07). Antes vivía dentro de
 * `withWorkspace` (worker/middleware.ts); se sacó para que el contrato de
 * herramientas de Nova (worker/nova-tools.ts) responda exactamente lo mismo que
 * la sesión de la app, con los mismos mensajes.
 */
import type { D1Database } from "@cloudflare/workers-types";

export type WorkspaceAccess = { ok: true; role: string } | { ok: false; status: 402 | 403; message: string };

const LIVE = ["active", "trialing", "past_due"];

export async function checkWorkspaceAccess(db: D1Database, workspaceId: string, userId: string, productName: string): Promise<WorkspaceAccess> {
	const row = await db
		.prepare(
			`SELECT wm.role, we.status
			   FROM workspace_members wm
			   LEFT JOIN workspace_entitlements we ON we.workspace_id = wm.workspace_id
			  WHERE wm.workspace_id = ? AND wm.user_id = ?
			  LIMIT 1`,
		)
		.bind(workspaceId, userId)
		.first<{ role: string; status: string | null }>();

	if (!row) return { ok: false, status: 403, message: "Forbidden" };
	if (row.status === null || !LIVE.includes(row.status)) {
		return { ok: false, status: 402, message: `This workspace does not have an active ${productName} subscription` };
	}
	return { ok: true, role: row.role };
}

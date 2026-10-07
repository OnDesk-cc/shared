// Membresía + derecho, la misma respuesta que daba withWorkspace: `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkWorkspaceAccess } from "./access.ts";

function db(row: { role: string; status: string | null } | null, seen: unknown[] = []) {
	return {
		prepare: () => ({
			bind: (...args: unknown[]) => {
				seen.push(...args);
				return { first: async () => row };
			},
		}),
	} as never;
}

test("miembro con derecho vivo → su rol, consultando por workspace y usuario", async () => {
	const seen: unknown[] = [];
	assert.deepEqual(await checkWorkspaceAccess(db({ role: "admin", status: "trialing" }, seen), "ws1", "u1", "Orbit"), { ok: true, role: "admin" });
	assert.deepEqual(seen, ["ws1", "u1"]);
});

test("no es miembro → 403 Forbidden", async () => {
	assert.deepEqual(await checkWorkspaceAccess(db(null), "ws1", "u1", "Orbit"), { ok: false, status: 403, message: "Forbidden" });
});

test("sin derecho o caducado → 402 con el nombre del producto", async () => {
	for (const status of [null, "canceled"]) {
		assert.deepEqual(await checkWorkspaceAccess(db({ role: "member", status }), "ws1", "u1", "Vault"), {
			ok: false,
			status: 402,
			message: "This workspace does not have an active Vault subscription",
		});
	}
});

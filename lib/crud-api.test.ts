// El cliente CRUD de shared: `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkspaceScopedApi } from "./crud-api.ts";

function stubFetch(status: number, body: unknown) {
	globalThis.fetch = (async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })) as typeof fetch;
}

test("con `fail`, el error de una respuesta lo escribe la app (su serverError, en el idioma de quien lee)", async () => {
	stubFetch(400, { error: "Contact not found", code: "not_found" });
	const api = createWorkspaceScopedApi<{ id: string }, { workspace_id: string }, object>({
		basePath: "/api/contacts",
		listKey: "contacts",
		itemKey: "contact",
		fail: (body, action) => `${action}: ${body.code ?? "?"}`,
	});
	await assert.rejects(api.getAll("w1"), { message: "fetch: not_found" });
	await assert.rejects(api.delete("c1"), { message: "delete: not_found" });
});

test("sin `fail`, como siempre: el texto del servidor, o el respaldo inglés", async () => {
	stubFetch(500, {});
	const api = createWorkspaceScopedApi<{ id: string }, { workspace_id: string }, object>({ basePath: "/api/x", listKey: "xs", itemKey: "x" });
	await assert.rejects(api.getAll("w1"), { message: "Failed to fetch xs" });
});

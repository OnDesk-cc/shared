// Pruebas de las piezas puras de la hoja de Nova central: `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
	actionErrorText,
	actionVerb,
	asPreviewData,
	chatErrorText,
	classifyHistoryStatus,
	collectPreviews,
	conversationKey,
	latestUsage,
	messageText,
	realToolName,
	runningLabel,
	safeLink,
	toolCards,
	usageLine,
	usageUrl,
	type NovaToolCard,
} from "./nova-chat-parts.ts";

test("el estado de get-messages decide qué hacer", () => {
	assert.equal(classifyHistoryStatus(200), "ok");
	// Sesión caducada: decírselo a la persona, no vaciar el historial en silencio.
	assert.equal(classifyHistoryStatus(401), "expired");
	// La conversación guardada es de otra persona u otro workspace: empezar otra.
	assert.equal(classifyHistoryStatus(403), "foreign");
	assert.equal(classifyHistoryStatus(404), "foreign");
	assert.equal(classifyHistoryStatus(502), "error");
});

test("los errores conocidos del chat se dicen en una frase", () => {
	assert.match(chatErrorText("WebSocket closed mid-stream.") ?? "", /connection to Nova dropped/i);
	assert.match(chatErrorText("You're asking Nova too fast. Wait a minute and try again.") ?? "", /too fast/);
	assert.match(chatErrorText("Your session expired. Reload the page to keep talking to Nova.") ?? "", /session expired/i);
	assert.match(chatErrorText("That question is too long for Nova (4,000 characters at most). Shorten it and try again.") ?? "", /too long/);
	// Lo interno (nombres de producto, dueños, errores del modelo) no llega tal cual.
	assert.equal(chatErrorText("This conversation has no owner"), null);
	assert.equal(chatErrorText("Unknown product"), null);
});

test("messageText une sólo las partes de texto", () => {
	const message = {
		id: "m1",
		role: "assistant" as const,
		parts: [
			{ type: "step-start" },
			{ type: "tool-orbit__search_tasks", toolCallId: "t", state: "output-available", input: {}, output: {} },
			{ type: "text", text: "Hay " },
			{ type: "text", text: "3 tareas." },
		],
	};
	assert.equal(messageText(message as never), "Hay 3 tareas.");
});

test("conversationKey separa producto y workspace", () => {
	assert.equal(conversationKey("orbit", "ws_1"), "nova:conversation:orbit:ws_1");
	assert.notEqual(conversationKey("orbit", "ws_1"), conversationKey("vault", "ws_1"));
});

test("conversationKey con alcance: una conversación por ticket, aparte de la de la barra", () => {
	assert.equal(conversationKey("pulse", "ws_1", "ticket:t_9"), "nova:conversation:pulse:ws_1:ticket:t_9");
	assert.notEqual(conversationKey("pulse", "ws_1", "ticket:t_9"), conversationKey("pulse", "ws_1"));
	assert.notEqual(conversationKey("pulse", "ws_1", "ticket:t_9"), conversationKey("pulse", "ws_1", "ticket:t_10"));
});

// ─── fase 2: herramientas, tarjetas y saldo ─────────────────────────────────

const previewData = {
	toolCallId: "c1",
	product: "orbit",
	tool: "orbit.delete_task",
	destructive: true,
	preview: { summary: 'Delete task "Ship v2" in Launch', fields: [{ label: "Project", value: "Launch" }] },
};
const withPreview = { parts: [{ type: "data-nova-preview", id: "c1", data: previewData }] };
const part = (state: string, extra: Record<string, unknown> = {}) => ({
	type: "tool-orbit__delete_task",
	toolCallId: "c1",
	state,
	input: { task_id: "t1" },
	...extra,
});
function cardsFor(p: Record<string, unknown>, opts: { latest?: boolean; live?: boolean } = {}): NovaToolCard[] {
	return toolCards({ parts: [p] } as never, {
		previews: collectPreviews([withPreview] as never),
		latest: opts.latest ?? true,
		live: opts.live ?? false,
	});
}
function actionCard(p: Record<string, unknown>, opts: { latest?: boolean } = {}) {
	const [card] = cardsFor(p, opts);
	return card?.kind === "action" ? card : null;
}

test("nombres: del modelo al real, el verbo de una acción y lo que se dice mientras corre", () => {
	assert.equal(realToolName("orbit__delete_task"), "orbit.delete_task");
	assert.equal(actionVerb("orbit.delete_task"), "Delete task");
	assert.equal(actionVerb("nexus.archive_channel"), "Archive channel");
	assert.equal(runningLabel("orbit.search_tasks", {}), "Checking Orbit…");
	assert.equal(runningLabel("open_product", { product: "halo" }), "Opening Halo…");
	assert.equal(runningLabel("open_product", { product: "nope" }), "Opening another product…");
	assert.equal(runningLabel("weird", {}), "Working…");
});

test("una lectura en curso es una línea discreta; terminada, nada", () => {
	const read = { type: "tool-orbit__search_tasks", toolCallId: "r1", state: "input-available", input: { query: "x" } };
	assert.deepEqual(cardsFor(read, { live: true }), [{ kind: "running", toolCallId: "r1", label: "Checking Orbit…" }]);
	// Si el turno ya no corre, no se queda colgada una línea «Checking…».
	assert.deepEqual(cardsFor(read, { live: false }), []);
	assert.deepEqual(cardsFor({ ...read, state: "output-available", output: [] }), []);
	// Un preview rechazado (sin permiso) no deja tarjeta: lo cuenta el modelo.
	assert.deepEqual(
		cardsFor({ type: "tool-orbit__create_task", toolCallId: "x9", state: "output-available", input: {}, output: { error: "forbidden", message: "…" } }),
		[],
	);
});

test("la tarjeta pide aprobación con el preview, sólo en el último mensaje", () => {
	const card = actionCard(part("approval-requested", { approval: { id: "a1" } }));
	assert.equal(card?.status, "awaiting");
	assert.equal(card?.approvalId, "a1");
	assert.equal(card?.destructive, true);
	assert.equal(card?.product, "orbit");
	assert.equal(card?.tool, "orbit.delete_task");
	assert.equal(card?.preview?.summary, 'Delete task "Ship v2" in Launch');
	assert.deepEqual(card?.preview?.fields, [{ label: "Project", value: "Launch" }]);
	// En un mensaje viejo ya no se puede aprobar: Nova la dio por no aprobada.
	assert.equal(actionCard(part("approval-requested", { approval: { id: "a1" } }), { latest: false })?.status, "expired");
});

test("después de contestar: trabajando, hecho con su enlace, cancelado o error", () => {
	const approved = { approval: { id: "a1", approved: true } };
	assert.equal(actionCard(part("approval-responded", approved))?.status, "approving");
	const done = actionCard(part("output-available", { ...approved, output: { ok: true, link: "https://orbit.ondesk.cc/t/1" } }));
	assert.equal(done?.status, "done");
	assert.equal(done?.link, "https://orbit.ondesk.cc/t/1");
	assert.equal(actionCard(part("output-available", { ...approved, output: { ok: true, link: "javascript:alert(1)" } }))?.link, null);
	assert.equal(actionCard(part("output-denied", { approval: { id: "a1", approved: false } }))?.status, "cancelled");
	const failed = actionCard(part("output-available", { ...approved, output: { error: "forbidden", message: "…" } }));
	assert.equal(failed?.status, "failed");
	assert.equal(failed?.error, "You don't have permission to do this.");
	assert.equal(actionCard(part("output-error", { ...approved, errorText: "boom" }))?.status, "failed");
	assert.match(actionErrorText("unknown_outcome", "Orbit"), /Check in Orbit before trying again/);
	assert.equal(actionErrorText("something_else", "Orbit"), "This couldn't be done.");
});

test("asPreviewData descarta lo mal formado; safeLink sólo deja http(s)", () => {
	assert.equal(asPreviewData({ toolCallId: "c1" }), null);
	assert.equal(asPreviewData(null), null);
	assert.deepEqual(
		asPreviewData({ ...previewData, preview: { summary: "s", fields: [{ label: "a", value: "b" }, { label: 1 }, "x"] } })?.preview.fields,
		[{ label: "a", value: "b" }],
	);
	assert.equal(safeLink("https://atlas.ondesk.cc/p/1"), "https://atlas.ondesk.cc/p/1");
	assert.equal(safeLink("javascript:alert(1)"), null);
	assert.equal(safeLink("not a url"), null);
	assert.equal(safeLink(42), null);
});

const usage = (remaining: number, limit = 1000, renews_at = "2026-11-01T00:00:00.000Z") => ({ remaining, limit, scope: "workspace" as const, renews_at });

test("la línea de saldo sale desde que se ha usado el 80 %", () => {
	assert.equal(usageLine(null), null);
	assert.equal(usageLine(usage(201)), null);
	assert.equal(usageLine(usage(200)), "You have 200 credits left this month.");
	assert.equal(usageLine(usage(1)), "You have 1 credit left this month.");
	assert.equal(usageLine(usage(0)), "No Nova credits left this month. They renew on November 1 (UTC).");
	assert.equal(usageLine(usage(1500, 10_000, "2026-11-01T00:00:00.000Z")), "You have 1,500 credits left this month.");
	assert.equal(usageLine(usage(0, 0)), null);
});

test("el saldo es el del último mensaje del asistente de este mes; si no, el que pasó el producto", () => {
	const now = new Date("2026-10-20T12:00:00Z");
	const messages = [
		{ role: "assistant", metadata: { nova_usage: usage(500) } },
		{ role: "user" },
		{ role: "assistant", metadata: { nova_usage: usage(150) } },
		{ role: "user" },
	];
	assert.equal(latestUsage(messages as never, null, now)?.remaining, 150);
	const initial = usage(900);
	assert.equal(latestUsage([] as never, initial, now), initial);
	// El saldo de un mes que ya pasó no dice nada del de ahora: manda el inicial.
	assert.equal(latestUsage([{ role: "assistant", metadata: { nova_usage: usage(10, 1000, "2026-10-01T00:00:00.000Z") } }] as never, initial, now), initial);
	assert.equal(latestUsage([{ role: "assistant", metadata: { nova_usage: { remaining: "x" } } }] as never, null, now), null);
});

test("usageUrl: siempre con el producto de la hoja, y http sólo en local", () => {
	assert.equal(usageUrl("nova.ondesk.cc", "ws 1", "orbit"), "https://nova.ondesk.cc/api/me/usage?workspace=ws+1&product=orbit");
	assert.equal(usageUrl("localhost:8787", "ws1", "halo"), "http://localhost:8787/api/me/usage?workspace=ws1&product=halo");
	assert.equal(usageUrl("127.0.0.1:8787", "ws1", "halo"), "http://127.0.0.1:8787/api/me/usage?workspace=ws1&product=halo");
});

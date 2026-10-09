// Las piezas puras del panel de Nova: `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
	DOCK_DEFAULT_WIDTH,
	DOCK_DESKTOP_QUERY,
	DOCK_MAX_WIDTH,
	DOCK_MAX_WORKSPACES,
	DOCK_MIN_WIDTH,
	asConversationList,
	clampWidth,
	conversationOf,
	cookieDomainFor,
	cookieString,
	defaultPrefs,
	dockWidthBounds,
	groupConversations,
	historyTime,
	historyUrl,
	parsePrefs,
	readCookie,
	rememberConversation,
	serializePrefs,
	startedInText,
	surfaceName,
	type NovaConversationSummary,
} from "./nova-dock-state.ts";
import { usageUrl } from "./nova-chat-parts.ts";

const A = "3f1c2a9e-8b7d-4c6e-9a1b-2c3d4e5f6a7b";
const B = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

test("parsePrefs: nada, JSON roto o de otra forma → lo de por defecto, sin lanzar", () => {
	for (const raw of [null, undefined, "", "{", "[]", "42", '{"open":"yes"}']) {
		assert.deepEqual(parsePrefs(raw), defaultPrefs(), String(raw));
	}
	assert.deepEqual(defaultPrefs(), { v: 1, open: false, width: DOCK_DEFAULT_WIDTH, conv: [] });
});

test("parsePrefs: el ancho se queda entre el mínimo y el máximo; conv sólo con pares buenos", () => {
	const p = parsePrefs(JSON.stringify({ v: 1, open: true, width: 5000, conv: [["ws_1", A], ["ws 2", B], ["ws_3", "nope"], ["ws_4"]] }));
	assert.equal(p.open, true);
	assert.equal(p.width, DOCK_MAX_WIDTH);
	assert.deepEqual(p.conv, [["ws_1", A]]);
	assert.equal(parsePrefs(JSON.stringify({ width: 10 })).width, DOCK_MIN_WIDTH);
});

test("serializePrefs ↔ parsePrefs", () => {
	const p = { v: 1 as const, open: true, width: 512, conv: [["ws_1", A]] as [string, string][] };
	assert.deepEqual(parsePrefs(serializePrefs(p)), p);
});

test("rememberConversation: la más reciente al final, 20 workspaces como mucho, ids numéricos sin reordenar", () => {
	let p = defaultPrefs();
	p = rememberConversation(p, "123", A);
	p = rememberConversation(p, "ws_b", B);
	p = rememberConversation(p, "123", B);
	assert.deepEqual(p.conv, [["ws_b", B], ["123", B]]);
	assert.equal(conversationOf(p, "123"), B);
	assert.equal(conversationOf(p, "nadie"), null);
	for (let i = 0; i < DOCK_MAX_WORKSPACES + 5; i++) p = rememberConversation(p, `ws_${i}`, A);
	assert.equal(p.conv.length, DOCK_MAX_WORKSPACES);
	assert.equal(p.conv.at(-1)?.[0], `ws_${DOCK_MAX_WORKSPACES + 4}`);
});

test("dockWidthBounds/clampWidth: la página guarda 40rem y el panel cede, pero nunca baja de 22rem", () => {
	assert.deepEqual(dockWidthBounds(1920), { min: 352, max: 768 });
	assert.deepEqual(dockWidthBounds(1440), { min: 352, max: 544 });
	assert.deepEqual(dockWidthBounds(1280), { min: 352, max: 384 });
	assert.deepEqual(dockWidthBounds(1024), { min: 352, max: 352 });
	assert.equal(DOCK_DESKTOP_QUERY, "(min-width: 1280px)");
	assert.equal(clampWidth(700, 1100), 352);
	assert.equal(clampWidth(400.4, 1920), 400);
	assert.equal(clampWidth(100, 1920), 352);
});

test("cookieDomainFor: dentro de ondesk.cc, la cookie compartida; fuera, null", () => {
	assert.equal(cookieDomainFor("ondesk.cc"), ".ondesk.cc");
	assert.equal(cookieDomainFor("atlas.ondesk.cc"), ".ondesk.cc");
	assert.equal(cookieDomainFor("atlas-6pq.pages.dev"), null);
	assert.equal(cookieDomainFor("localhost"), null);
	assert.equal(cookieDomainFor("ondesk.cc.evil.com"), null);
});

test("readCookie/cookieString", () => {
	const value = serializePrefs({ v: 1, open: true, width: 448, conv: [["ws_1", A]] });
	const line = cookieString("nova_dock", value, ".ondesk.cc");
	assert.match(line, /; Domain=\.ondesk\.cc; Path=\/; Max-Age=31536000; SameSite=Lax; Secure$/);
	const jar = `theme=light; ${line.split(";")[0]}; other=1`;
	assert.equal(readCookie(jar, "nova_dock"), value);
	assert.equal(readCookie(jar, "nova"), null);
	assert.equal(readCookie("nova_dock=%E0%A4%A", "nova_dock"), null);
	assert.ok(line.length < 4096);
});

const at = (iso: string) => Math.floor(Date.parse(iso) / 1000);
const item = (id: string, iso: string, product: string | null = "atlas"): NovaConversationSummary => ({ id, workspace_id: "ws_1", product, title: id, updated_at: at(iso) });

test("groupConversations: hoy, los 7 días anteriores y antes, en la zona de quien lee", () => {
	const now = new Date("2026-10-08T10:00:00Z");
	const groups = groupConversations(
		[item("a", "2026-10-08T01:00:00Z"), item("b", "2026-10-07T23:30:00Z"), item("c", "2026-10-01T12:00:00Z"), item("d", "2026-09-29T12:00:00Z")],
		now,
		"Europe/Madrid",
	);
	assert.deepEqual(
		groups.map((g) => [g.label, g.items.map((i) => i.id)]),
		[
			["Today", ["a", "b"]],
			["Previous 7 days", ["c"]],
			["Earlier", ["d"]],
		],
	);
	assert.deepEqual(groupConversations([], now, "UTC"), []);
});

test("historyTime: la hora si es de hoy, la fecha corta si no", () => {
	const now = new Date("2026-10-08T18:00:00Z");
	assert.match(historyTime(at("2026-10-08T14:05:00Z"), now, "UTC"), /^2:05\sPM$/u);
	assert.equal(historyTime(at("2026-10-03T14:05:00Z"), now, "UTC"), "Oct 3");
});

test("asConversationList: sólo filas con forma de conversación", () => {
	assert.deepEqual(asConversationList(null), []);
	assert.deepEqual(asConversationList({ conversations: "x" }), []);
	const good = { id: A, workspace_id: "ws_1", product: null, title: "Hi", updated_at: 5 };
	assert.deepEqual(asConversationList({ conversations: [good, { id: 3 }] }), [good]);
});

test("las direcciones de Nova: https fuera, http en local", () => {
	assert.equal(historyUrl("nova.ondesk.cc", "ws_1"), "https://nova.ondesk.cc/api/me/conversations?workspace=ws_1");
	assert.equal(historyUrl("127.0.0.1:8787", "ws_1"), "http://127.0.0.1:8787/api/me/conversations?workspace=ws_1");
	assert.equal(usageUrl("nova.ondesk.cc", "ws_1", "console"), "https://nova.ondesk.cc/api/me/usage?workspace=ws_1&product=console");
});

test("surfaceName/startedInText", () => {
	assert.equal(surfaceName("console"), "the OnDesk console");
	assert.equal(surfaceName("atlas"), "Atlas");
	assert.equal(surfaceName("crm"), null);
	assert.equal(startedInText("atlas", "pulse"), "Started in Atlas");
	assert.equal(startedInText("console", "pulse"), "Started in the OnDesk console");
	assert.equal(startedInText("pulse", "pulse"), null);
	assert.equal(startedInText(null, "pulse"), null);
});

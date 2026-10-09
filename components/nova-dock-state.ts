/**
 * Las piezas sin React del panel acoplado de Nova (components/nova-dock.tsx),
 * aparte para probarlas con node:test. Spec: ondesk/docs/specs/2026-10-08-nova-dock.md.
 *
 *   DockPrefs            lo que se recuerda: abierta, ancho y la conversación en
 *                        curso de cada workspace (20 como mucho, la más reciente al
 *                        final). Va en la cookie `nova_dock` de .ondesk.cc para
 *                        que pasar de Pulse a Atlas o a la consola la deje igual;
 *                        fuera de ese dominio, en localStorage.
 *   dockWidthBounds      cuánto puede medir el panel con la ventana que hay: la
 *                        página cede hasta 32rem y después el panel, hasta 22rem.
 *   groupConversations   el historial en Today / Previous 7 days / Earlier, por el
 *                        día de quien lee (no por UTC).
 *
 * `conv` es una lista de pares y no un objeto: un objeto pone primero las claves
 * que parecen enteros, y un workspace con id «123» saltaría al principio.
 */
import { NOVA_PRODUCT_NAMES, novaOrigin, type NovaProduct, type NovaSurface } from "./nova-chat-parts";

export const NOVA_DOCK_KEY = "nova_dock";
export const DOCK_DEFAULT_WIDTH = 448; // 28rem
export const DOCK_MIN_WIDTH = 352; // 22rem
export const DOCK_MAX_WIDTH = 768; // 48rem
export const DOCK_KEY_STEP = 16;
export const DOCK_MAX_WORKSPACES = 20;
/** Desde aquí, columna; por debajo, la hoja a pantalla completa. */
export const DOCK_DESKTOP_QUERY = "(min-width: 1024px)";

const SIDEBAR_WIDTH = 256; // 16rem, la barra lateral de los marcos
const PAGE_MIN_WIDTH = 512; // 32rem
const WORKSPACE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface DockPrefs {
	v: 1;
	open: boolean;
	width: number;
	conv: [string, string][];
}

export function defaultPrefs(): DockPrefs {
	return { v: 1, open: false, width: DOCK_DEFAULT_WIDTH, conv: [] };
}

const keepLast = (conv: [string, string][]) => conv.slice(-DOCK_MAX_WORKSPACES);

/** La cookie (o su copia en localStorage), comprobada: llega de un navegador y puede venir de cualquier versión. */
export function parsePrefs(raw: string | null | undefined): DockPrefs {
	if (!raw) return defaultPrefs();
	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		return defaultPrefs();
	}
	if (!value || typeof value !== "object" || Array.isArray(value)) return defaultPrefs();
	const v = value as Record<string, unknown>;
	const width = typeof v.width === "number" && Number.isFinite(v.width) ? Math.round(v.width) : DOCK_DEFAULT_WIDTH;
	const conv: [string, string][] = [];
	if (Array.isArray(v.conv)) {
		for (const pair of v.conv) {
			if (!Array.isArray(pair) || pair.length !== 2) continue;
			const [ws, id] = pair as unknown[];
			if (typeof ws === "string" && WORKSPACE_ID.test(ws) && typeof id === "string" && UUID.test(id)) conv.push([ws, id]);
		}
	}
	return { v: 1, open: v.open === true, width: Math.min(DOCK_MAX_WIDTH, Math.max(DOCK_MIN_WIDTH, width)), conv: keepLast(conv) };
}

export function serializePrefs(prefs: DockPrefs): string {
	return JSON.stringify(prefs);
}

export function conversationOf(prefs: DockPrefs, workspaceId: string): string | null {
	return prefs.conv.find(([ws]) => ws === workspaceId)?.[1] ?? null;
}

/** La conversación en curso de un workspace pasa al final (la más reciente); sobran las del principio. */
export function rememberConversation(prefs: DockPrefs, workspaceId: string, conversationId: string): DockPrefs {
	return { ...prefs, conv: keepLast([...prefs.conv.filter(([ws]) => ws !== workspaceId), [workspaceId, conversationId]]) };
}

/** El ancho que cabe: 22rem siempre; como mucho 48rem, la mitad de la ventana, o lo que deje 32rem a la página. */
export function dockWidthBounds(viewport: number): { min: number; max: number } {
	const room = Math.min(DOCK_MAX_WIDTH, Math.floor(viewport * 0.5), viewport - SIDEBAR_WIDTH - PAGE_MIN_WIDTH);
	return { min: DOCK_MIN_WIDTH, max: Math.max(DOCK_MIN_WIDTH, room) };
}

export function clampWidth(width: number, viewport: number): number {
	const { min, max } = dockWidthBounds(viewport);
	return Math.min(max, Math.max(min, Math.round(width)));
}

/** `.ondesk.cc` en la plataforma; null fuera (Atlas en *.pages.dev, localhost), donde manda localStorage. */
export function cookieDomainFor(hostname: string): string | null {
	return hostname === "ondesk.cc" || hostname.endsWith(".ondesk.cc") ? ".ondesk.cc" : null;
}

export function readCookie(cookies: string, name: string): string | null {
	for (const part of cookies.split(";")) {
		const eq = part.indexOf("=");
		if (eq === -1 || part.slice(0, eq).trim() !== name) continue;
		try {
			return decodeURIComponent(part.slice(eq + 1).trim());
		} catch {
			return null;
		}
	}
	return null;
}

export function cookieString(name: string, value: string, domain: string): string {
	return `${name}=${encodeURIComponent(value)}; Domain=${domain}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
}

// ─── el historial ────────────────────────────────────────────────────────────

/** Una fila de `GET /api/me/conversations?workspace=` (nova/src/me.ts). */
export interface NovaConversationSummary {
	id: string;
	workspace_id: string;
	product: string | null;
	title: string | null;
	updated_at: number;
}

export function asConversationList(body: unknown): NovaConversationSummary[] {
	const list = (body as { conversations?: unknown } | null)?.conversations;
	if (!Array.isArray(list)) return [];
	return list.filter((c): c is NovaConversationSummary => {
		if (!c || typeof c !== "object") return false;
		const r = c as Record<string, unknown>;
		return (
			typeof r.id === "string" &&
			typeof r.workspace_id === "string" &&
			(r.product === null || typeof r.product === "string") &&
			(r.title === null || typeof r.title === "string") &&
			typeof r.updated_at === "number"
		);
	});
}

export type HistoryLabel = "Today" | "Previous 7 days" | "Earlier";
export interface HistoryGroup {
	label: HistoryLabel;
	items: NovaConversationSummary[];
}

const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** El día del calendario de `timeZone`, como número de días desde 1970. */
function dayNumber(date: Date, timeZone: string): number {
	const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date).split("-").map(Number);
	return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** En el orden en que llegan (las más recientes primero); los grupos vacíos no salen. */
export function groupConversations(items: NovaConversationSummary[], now: Date, timeZone: string = localZone()): HistoryGroup[] {
	const today = dayNumber(now, timeZone);
	const groups: HistoryGroup[] = [
		{ label: "Today", items: [] },
		{ label: "Previous 7 days", items: [] },
		{ label: "Earlier", items: [] },
	];
	for (const item of items) {
		const age = today - dayNumber(new Date(item.updated_at * 1000), timeZone);
		groups[age <= 0 ? 0 : age <= 7 ? 1 : 2].items.push(item);
	}
	return groups.filter((g) => g.items.length > 0);
}

/** «2:05 PM» si es de hoy; «Oct 3» si no. En inglés, como el resto del panel. */
export function historyTime(updatedAt: number, now: Date, timeZone: string = localZone()): string {
	const date = new Date(updatedAt * 1000);
	if (dayNumber(date, timeZone) >= dayNumber(now, timeZone)) {
		return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(date);
	}
	return new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric" }).format(date);
}

export function historyUrl(novaHost: string, workspaceId: string): string {
	return `${novaOrigin(novaHost)}/api/me/conversations?${new URLSearchParams({ workspace: workspaceId }).toString()}`;
}

/** «the OnDesk console», «Atlas», o null para lo que no se conoce. */
export function surfaceName(surface: string | null): string | null {
	if (surface === "console") return "the OnDesk console";
	return surface && Object.hasOwn(NOVA_PRODUCT_NAMES, surface) ? NOVA_PRODUCT_NAMES[surface as NovaProduct] : null;
}

/** La línea encima de una conversación empezada en otra superficie. */
export function startedInText(origin: string | null, current: NovaSurface): string | null {
	if (!origin || origin === current) return null;
	const name = surfaceName(origin);
	return name ? `Started in ${name}` : null;
}

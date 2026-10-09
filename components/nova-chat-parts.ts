/**
 * Las piezas sin React de la hoja de Nova central (components/nova-chat.tsx),
 * aparte para poder probarlas con node:test.
 *
 * Fase 2 (2026-10-08):
 *  - `toolCards`: de las partes de herramienta del AI SDK a lo que se pinta.
 *    Una lectura en curso es una línea («Checking Orbit…»); una acción, su
 *    tarjeta, con estos estados:
 *      approval-requested → awaiting, o expired si no está en el último mensaje;
 *      approval-responded → approving;
 *      output-available → done, o failed si trae `error`;
 *      output-error → failed;
 *      output-denied → cancelled.
 *  - La preview llega en la parte `data-nova-preview` (worker/nova-contract.ts).
 *  - El saldo de créditos sale de `metadata.nova_usage` del último mensaje del
 *    asistente, o del que pasa el producto (`initialUsage`). Se dice desde que
 *    se ha usado el 80 %.
 */
import type { UIMessage } from "ai";
import { NOVA_PREVIEW_PART, type NovaActionPreview, type NovaPreviewData, type NovaUsage } from "../worker/nova-contract";

export type NovaProduct = "pulse" | "vault" | "orbit" | "nexus" | "halo" | "atlas";

/** Dónde está la persona: una de las seis apps o la consola de OnDesk (2026-10-08). */
export type NovaSurface = NovaProduct | "console";

/** El texto de un mensaje: sólo las partes `text`, sin llamadas a herramientas ni pasos. */
export function messageText(message: UIMessage): string {
	return message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
}

/**
 * Qué hacer con la respuesta de `get-messages` (el historial). El SDK convierte
 * cualquier fallo en «sin mensajes», así que la hoja lo pide ella y decide:
 * 401 → la sesión caducó (se dice); 403/404 → la conversación guardada es de
 * otra persona u otro workspace (se empieza otra); el resto → error.
 */
export function classifyHistoryStatus(status: number): "ok" | "expired" | "foreign" | "error" {
	if (status >= 200 && status < 300) return "ok";
	if (status === 401) return "expired";
	if (status === 403 || status === 404) return "foreign";
	return "error";
}

/**
 * Los errores del chat que merecen su propia frase. `null` para el resto: lo
 * interno (un producto desconocido, una conversación sin dueño, un error del
 * modelo) no se le enseña tal cual a nadie, y la hoja cae a `novaErrorMessage`.
 */
export function chatErrorText(message: string): string | null {
	if (/closed mid-stream|websocket closed/i.test(message)) return "The connection to Nova dropped. Try again.";
	if (/too fast/i.test(message)) return "You're asking Nova too fast. Wait a minute and try again.";
	if (/session expired/i.test(message)) return "Your session expired. Reload the page to keep talking to Nova.";
	if (/too long for Nova/i.test(message)) return message;
	return null;
}

/**
 * Dónde guarda la pestaña la conversación en curso de un producto y un
 * workspace. `scope` separa una conversación atada a un objeto (el asistente de
 * un ticket: `ticket:<id>`) de la de la barra superior y de la de otro ticket.
 */
export function conversationKey(product: NovaSurface, workspaceId: string, scope?: string): string {
	return `nova:conversation:${product}:${workspaceId}${scope ? `:${scope}` : ""}`;
}

// ─── fase 2: herramientas y acciones ─────────────────────────────────────────

export const NOVA_PRODUCT_NAMES: Record<NovaProduct, string> = {
	pulse: "Pulse",
	vault: "Vault",
	orbit: "Orbit",
	nexus: "Nexus",
	halo: "Halo",
	atlas: "Atlas",
};

function isNovaProduct(value: unknown): value is NovaProduct {
	return typeof value === "string" && Object.hasOwn(NOVA_PRODUCT_NAMES, value);
}

/** `orbit__delete_task` (el nombre que ve el modelo, sin puntos) → `orbit.delete_task`. */
export function realToolName(modelName: string): string {
	return modelName.replace(/__/g, ".");
}

/** El producto de una herramienta, por su prefijo: `orbit.search_tasks` → orbit. */
export function toolProduct(tool: string): NovaProduct | null {
	const head = tool.split(".")[0];
	return isNovaProduct(head) ? head : null;
}

/** El verbo de una acción, para el botón de una destructiva: `orbit.delete_task` → «Delete task». */
export function actionVerb(tool: string): string {
	const action = tool.includes(".") ? tool.slice(tool.indexOf(".") + 1) : tool;
	const words = action.split("_").filter(Boolean).join(" ");
	return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Approve";
}

/** Lo que dice la línea de una lectura mientras corre. */
export function runningLabel(tool: string, input: unknown): string {
	if (tool === "open_product") {
		const product = (input as { product?: unknown } | null | undefined)?.product;
		return isNovaProduct(product) ? `Opening ${NOVA_PRODUCT_NAMES[product]}…` : "Opening another product…";
	}
	const product = toolProduct(tool);
	return product ? `Checking ${NOVA_PRODUCT_NAMES[product]}…` : "Working…";
}

/** Por qué no se hizo una acción, en una frase para la persona (lo que lee el modelo es otro texto). */
export function actionErrorText(code: unknown, productName: string): string {
	switch (code) {
		case "forbidden":
		case "unauthorized":
			return "You don't have permission to do this.";
		case "payment_required":
			return `${productName} isn't active in this workspace.`;
		case "not_found":
			return "It no longer exists.";
		case "invalid_params":
			return "Some of the details weren't valid.";
		case "unknown_outcome":
			return `Nova lost track of this action. Check in ${productName} before trying again.`;
		case "disabled":
			return "This action was turned off for this workspace.";
		default:
			return "This couldn't be done.";
	}
}

/** Un enlace que puede ir en un `href`: sólo http(s). Nunca `javascript:`. */
export function safeLink(value: unknown): string | null {
	if (typeof value !== "string") return null;
	try {
		const url = new URL(value);
		return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
	} catch {
		return null;
	}
}

/** La preview de una parte `data-nova-preview`, comprobada (llega de la red y del historial guardado). */
export function asPreviewData(value: unknown): NovaPreviewData | null {
	if (!value || typeof value !== "object") return null;
	const v = value as Record<string, unknown>;
	if (typeof v.toolCallId !== "string" || typeof v.product !== "string" || typeof v.tool !== "string") return null;
	const preview = v.preview as Record<string, unknown> | null | undefined;
	if (!preview || typeof preview.summary !== "string" || !Array.isArray(preview.fields)) return null;
	const fields = preview.fields
		.filter((f): f is { label: string; value: string } => {
			if (typeof f !== "object" || f === null) return false;
			const field = f as Record<string, unknown>;
			return typeof field.label === "string" && typeof field.value === "string";
		})
		.map((f) => ({ label: f.label, value: f.value }));
	return { toolCallId: v.toolCallId, product: v.product, tool: v.tool, destructive: v.destructive === true, preview: { summary: preview.summary, fields } };
}

/** Las previews de toda la conversación, por `toolCallId`. */
export function collectPreviews(messages: Pick<UIMessage, "parts">[]): Map<string, NovaPreviewData> {
	const out = new Map<string, NovaPreviewData>();
	for (const message of messages) {
		for (const part of message.parts) {
			if (part.type !== NOVA_PREVIEW_PART) continue;
			const data = asPreviewData((part as { data?: unknown }).data);
			if (data) out.set(data.toolCallId, data);
		}
	}
	return out;
}

export type NovaActionStatus = "awaiting" | "approving" | "done" | "cancelled" | "failed" | "expired";

export type NovaToolCard =
	| { kind: "running"; toolCallId: string; label: string }
	| {
			kind: "action";
			toolCallId: string;
			status: NovaActionStatus;
			/** El id que espera `addToolApprovalResponse`; null si no hay nada que contestar. */
			approvalId: string | null;
			tool: string;
			product: NovaProduct | null;
			destructive: boolean;
			preview: NovaActionPreview | null;
			link: string | null;
			error: string | null;
	  };

type ToolPartView = {
	type: string;
	toolCallId?: unknown;
	toolName?: unknown;
	state?: unknown;
	input?: unknown;
	output?: unknown;
	approval?: { id?: unknown; approved?: unknown } | null;
};

/**
 * Lo que se pinta de las herramientas de un mensaje.
 * - `latest`: es el último mensaje y no corre nada (sólo ahí se puede aprobar).
 * - `live`: es el último mensaje y el turno sigue corriendo (sólo ahí sale la línea de una lectura).
 */
export function toolCards(message: Pick<UIMessage, "parts">, opts: { previews: Map<string, NovaPreviewData>; latest: boolean; live: boolean }): NovaToolCard[] {
	const cards: NovaToolCard[] = [];
	for (const raw of message.parts) {
		const part = raw as ToolPartView;
		const isTool = part.type.startsWith("tool-") || part.type === "dynamic-tool";
		if (!isTool || typeof part.toolCallId !== "string") continue;
		const toolCallId = part.toolCallId;
		const tool = realToolName(part.type === "dynamic-tool" ? String(part.toolName ?? "") : part.type.slice("tool-".length));
		const state = part.state;

		if (state === "input-streaming" || state === "input-available") {
			if (opts.live) cards.push({ kind: "running", toolCallId, label: runningLabel(tool, part.input) });
			continue;
		}

		const data = opts.previews.get(toolCallId) ?? null;
		const approvalId = part.approval && typeof part.approval.id === "string" ? part.approval.id : null;
		// Una lectura terminada no deja rastro; una acción, su tarjeta.
		if (!data && !approvalId) continue;

		const product = (data && isNovaProduct(data.product) ? data.product : null) ?? toolProduct(tool);
		const productName = product ? NOVA_PRODUCT_NAMES[product] : "OnDesk";
		const output = (part.output ?? null) as { error?: unknown; link?: unknown } | null;
		let status: NovaActionStatus;
		let error: string | null = null;
		let link: string | null = null;
		switch (state) {
			case "approval-requested":
				status = opts.latest ? "awaiting" : "expired";
				break;
			case "approval-responded":
				status = part.approval?.approved === false ? "cancelled" : "approving";
				break;
			case "output-denied":
				status = "cancelled";
				break;
			case "output-error":
				status = "failed";
				error = actionErrorText(null, productName);
				break;
			case "output-available":
				if (output && typeof output.error === "string") {
					status = output.error === "cancelled" ? "cancelled" : "failed";
					error = status === "failed" ? actionErrorText(output.error, productName) : null;
				} else {
					status = "done";
					link = safeLink(output?.link);
				}
				break;
			default:
				continue;
		}
		cards.push({
			kind: "action",
			toolCallId,
			status,
			approvalId,
			tool,
			product,
			destructive: data?.destructive === true,
			preview: data?.preview ?? null,
			link,
			error,
		});
	}
	return cards;
}

// ─── fase 2: el saldo de créditos ────────────────────────────────────────────

/** Desde qué parte usada del límite que manda se enseña el saldo (spec § 2c: el 80 %). */
export const NOVA_USAGE_WARN_AT = 0.8;

/** `metadata.nova_usage`, comprobado: llega de la red. */
export function asUsage(value: unknown): NovaUsage | null {
	if (!value || typeof value !== "object") return null;
	const u = value as Record<string, unknown>;
	if (typeof u.remaining !== "number" || typeof u.limit !== "number" || typeof u.renews_at !== "string") return null;
	if (u.scope !== "workspace" && u.scope !== "user" && u.scope !== "product") return null;
	return { remaining: u.remaining, limit: u.limit, scope: u.scope, renews_at: u.renews_at };
}

/**
 * El saldo más reciente que se conoce: el del último mensaje del asistente que lo
 * lleve, si es de este mes (`renews_at` todavía no ha pasado); si no, el que pasó
 * el producto al abrir la hoja.
 */
export function latestUsage(messages: Pick<UIMessage, "role" | "metadata">[], initial: NovaUsage | null, now: Date): NovaUsage | null {
	for (let i = messages.length - 1; i >= 0; i--) {
		const message = messages[i];
		if (message.role !== "assistant") continue;
		const usage = asUsage((message.metadata as { nova_usage?: unknown } | null | undefined)?.nova_usage);
		if (!usage) continue;
		return Date.parse(usage.renews_at) > now.getTime() ? usage : initial;
	}
	return initial;
}

function renewDay(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "the 1st of next month";
	return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(date);
}

/** La línea de saldo de la hoja, o null mientras no se haya usado el 80 % del límite que manda. */
export function usageLine(usage: NovaUsage | null): string | null {
	if (!usage || usage.limit <= 0) return null;
	if (usage.limit - usage.remaining < usage.limit * NOVA_USAGE_WARN_AT) return null;
	if (usage.remaining <= 0) return `No Nova credits left this month. They renew on ${renewDay(usage.renews_at)} (UTC).`;
	const n = Math.floor(usage.remaining);
	return `You have ${n.toLocaleString("en-US")} ${n === 1 ? "credit" : "credits"} left this month.`;
}

/** `https://nova.ondesk.cc`; http sólo en local. `novaHost` va sin protocolo, como en `useAgent`. */
export function novaOrigin(novaHost: string): string {
	const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(novaHost);
	return `${local ? "http" : "https"}://${novaHost}`;
}

/**
 * `GET /api/me/usage` de Nova, siempre con la superficie del panel: sin ella el
 * tope por producto no entraría en el saldo que se enseña (la consola no tiene).
 */
export function usageUrl(novaHost: string, workspaceId: string, surface: NovaSurface): string {
	const params = new URLSearchParams({ workspace: workspaceId, product: surface });
	return `${novaOrigin(novaHost)}/api/me/usage?${params.toString()}`;
}

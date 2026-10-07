/**
 * Las piezas sin React de la hoja de Nova central (components/nova-chat.tsx),
 * aparte para poder probarlas con node:test.
 */
import type { UIMessage } from "ai";

export type NovaProduct = "pulse" | "vault" | "orbit" | "nexus" | "halo" | "atlas";

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

/** Dónde guarda la pestaña la conversación en curso de un producto y un workspace. */
export function conversationKey(product: NovaProduct, workspaceId: string): string {
	return `nova:conversation:${product}:${workspaceId}`;
}

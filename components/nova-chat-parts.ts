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

/** Dónde guarda la pestaña la conversación en curso de un producto y un workspace. */
export function conversationKey(product: NovaProduct, workspaceId: string): string {
	return `nova:conversation:${product}:${workspaceId}`;
}

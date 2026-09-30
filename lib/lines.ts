/**
 * Las seis líneas del mapa de red, tal como las conocen los seis productos.
 *
 * El mundo visual de OnDesk dibuja cada app como una línea de color sobre papel
 * blanco (ver `styles/site.css`). Este módulo es la copia para los productos de
 * `ondesk/src/features/frontend/lines.ts` y de los nombres de
 * `ondesk/src/features/console/apps.ts`: el orden de siempre, el nombre propio
 * (nunca se traduce), la frase de una línea de cada app y el color de su línea
 * como variable CSS del mundo.
 *
 * Un color de línea se aplica a `stroke`, `background` o al `fill` de un
 * rectángulo, nunca a `color`: en el mapa nada se escribe en rojo, verde, azul,
 * naranja, magenta ni turquesa.
 */

export type ProductId = "pulse" | "vault" | "orbit" | "nexus" | "halo" | "atlas";

/** El orden de la banda de seis líneas, y de cualquier clave o intercambiador. */
export const PRODUCT_IDS: readonly ProductId[] = ["pulse", "vault", "orbit", "nexus", "halo", "atlas"];

export const APP_NAME: Record<ProductId, string> = {
	pulse: "Pulse",
	vault: "Vault",
	orbit: "Orbit",
	nexus: "Nexus",
	halo: "Halo",
	atlas: "Atlas",
};

/** Lo que hace cada app, en una frase de la clave del mapa. */
export const APP_TAGLINE: Record<ProductId, string> = {
	pulse: "Customer support",
	vault: "Shared credentials",
	orbit: "Projects and tasks",
	nexus: "Channels and calls",
	halo: "Meetings",
	atlas: "Files and knowledge",
};

/** El origen de producción de cada app; cada producto lo puede sobrescribir por entorno. */
export const APP_ORIGIN: Record<ProductId, string> = {
	pulse: "https://pulse.ondesk.cc",
	vault: "https://vault.ondesk.cc",
	orbit: "https://orbit.ondesk.cc",
	nexus: "https://nexus.ondesk.cc",
	halo: "https://halo.ondesk.cc",
	atlas: "https://atlas.ondesk.cc",
};

export function isProductId(id: string): id is ProductId {
	return (PRODUCT_IDS as readonly string[]).includes(id);
}

/** El color de línea de una app, como variable del mundo `.site`. */
export function lineColor(id: string): string {
	return `var(--l-${id})`;
}

/** Las líneas claras (naranja, turquesa) llevan el rótulo en tinta; el resto, en papel. */
export function labelClass(id: string): string {
	return id === "nexus" || id === "atlas" ? "map-label map-label--ink" : "map-label";
}

/** El nombre de una app por su id, o el id tal cual si no es una de las seis. */
export function appName(id: string): string {
	return isProductId(id) ? APP_NAME[id] : id === "suite" ? "Business Suite" : id;
}

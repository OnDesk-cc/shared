/**
 * La geometría de la estrella de Nova (2026-10-06): su silueta, los seis colores
 * de las apps en el orden en que los recorre el degradado cónico, y las cuñas
 * que dibujan ese degradado, porque SVG no tiene degradado cónico. Puro y sin
 * React: lo pinta `components/nova-mark.tsx` y lo prueba
 * `scripts/nova-star.test.mjs`.
 *
 * ondesk lleva una copia idéntica en `src/features/frontend/sky/nova-star.ts`
 * (sigue fijado a una versión de shared sin UI) y su prueba compara las dos: si
 * cambias algo aquí, cámbialo allí.
 */

/** Los colores de las apps en orden de matiz, desde arriba y en el sentido del reloj: Orbit, Atlas, Vault, Pulse, Nexus, Halo. */
export const NOVA_HUES = ["#ee6c2b", "#5aa82e", "#17996a", "#0b9fb3", "#4466f2", "#8f55e8"] as const;

/**
 * La estrella en un viewBox de 24: puntas verticales de radio 11, horizontales
 * de 9,5, lados cóncavos. La cintura (los puntos de control a 2,8 del centro) es
 * ancha a propósito: más fina, a 18 px el color no llega a verse.
 */
export const NOVA_STAR_PATH = "M12 1Q14.8 9.2 21.5 12Q14.8 14.8 12 23Q9.2 14.8 2.5 12Q9.2 9.2 12 1Z";

/** El radio del brillo blanco del centro y su opacidad por defecto (sobre tinta, 1). */
export const NOVA_GLOW_RADIUS = 3;
export const NOVA_GLOW_OPACITY = 0.8;

/** Mezcla lineal de dos `#rrggbb` en sRGB: `t` = 0 da `a`, 1 da `b`. */
export function mixHex(a: string, b: string, t: number): string {
	const x = parseInt(a.slice(1), 16);
	const y = parseInt(b.slice(1), 16);
	const channel = (s: number) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t);
	return `#${[16, 8, 0].map((s) => channel(s).toString(16).padStart(2, "0")).join("")}`;
}

/** El color del degradado cónico en la fracción `f` de la vuelta (0 = arriba, crece en el sentido del reloj). */
export function novaHueAt(f: number): string {
	const n = NOVA_HUES.length;
	const p = (((f % 1) + 1) % 1) * n;
	const i = Math.floor(p);
	return mixHex(NOVA_HUES[i % n], NOVA_HUES[(i + 1) % n], p - i);
}

export interface NovaWedge {
	d: string;
	fill: string;
}

/**
 * Las cuñas que pintan el degradado cónico: triángulos desde el centro hasta un
 * radio que cubre la estrella, cada uno del color de su ángulo medio. Se solapan
 * 0,6° para que no se vean costuras; el desenfoque de `NovaMark` las funde.
 */
export function novaWedges(count = 24): NovaWedge[] {
	const r = 14;
	const at = (deg: number) => {
		const a = (deg * Math.PI) / 180;
		return `${(12 + r * Math.cos(a)).toFixed(3)} ${(12 + r * Math.sin(a)).toFixed(3)}`;
	};
	return Array.from({ length: count }, (_, i) => {
		const from = -90 + (i * 360) / count - 0.6;
		const to = -90 + ((i + 1) * 360) / count + 0.6;
		return { d: `M12 12L${at(from)}L${at(to)}Z`, fill: novaHueAt((i + 0.5) / count) };
	});
}

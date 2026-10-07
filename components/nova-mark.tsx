/**
 * La marca de Nova (2026-10-06): una estrella de cuatro puntas rellena con los
 * seis colores de las apps, porque Nova es la que ve las seis, y un brillo
 * blanco en el centro. La geometría y los colores están en `lib/nova-star`.
 *
 *   color   las seis luces y el brillo (por defecto)
 *   mono    la estrella en currentColor, para huecos pequeños y texto
 *   onDark  las seis luces con el brillo más fuerte, sobre tinta
 *
 * El brillo lleva la clase `sk-nova-glow`: el CSS de `product.css` lo sube al
 * pasar por el botón de Nova y lo hace latir mientras Nova escribe.
 */
import { useId } from "react";
import { NOVA_GLOW_OPACITY, NOVA_GLOW_RADIUS, NOVA_STAR_PATH, novaWedges } from "../lib/nova-star";

const WEDGES = novaWedges();

export type NovaMarkVariant = "color" | "mono" | "onDark";

export function NovaMark({
	variant = "color",
	size = 18,
	glow,
	title,
	className = "",
}: {
	variant?: NovaMarkVariant;
	/** Lado en px; una clase de tamaño en `className` lo pisa. */
	size?: number;
	/** Opacidad del brillo del centro, 0..1. Por defecto 0,8 (1 en `onDark`). */
	glow?: number;
	/** Con `title` la marca se anuncia como imagen; sin él es decorativa. */
	title?: string;
	className?: string;
}) {
	// useId trae caracteres que una referencia url(#…) de SVG no admite.
	const id = `nv${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
	const a11y = title ? { role: "img", "aria-label": title } : { "aria-hidden": true };

	if (variant === "mono") {
		return (
			<svg viewBox="0 0 24 24" width={size} height={size} className={`shrink-0 ${className}`} {...a11y}>
				<path d={NOVA_STAR_PATH} fill="currentColor" />
			</svg>
		);
	}

	return (
		<svg viewBox="0 0 24 24" width={size} height={size} className={`shrink-0 ${className}`} {...a11y}>
			<defs>
				<clipPath id={`${id}-c`}>
					<path d={NOVA_STAR_PATH} />
				</clipPath>
				<filter id={`${id}-b`} x="-10%" y="-10%" width="120%" height="120%">
					<feGaussianBlur stdDeviation="1.1" />
				</filter>
				<radialGradient id={`${id}-g`} cx="12" cy="12" r={NOVA_GLOW_RADIUS} gradientUnits="userSpaceOnUse">
					<stop offset="0" stopColor="#ffffff" />
					<stop offset="0.45" stopColor="#ffffff" stopOpacity="0.75" />
					<stop offset="1" stopColor="#ffffff" stopOpacity="0" />
				</radialGradient>
			</defs>
			<g clipPath={`url(#${id}-c)`}>
				<g filter={`url(#${id}-b)`}>
					{WEDGES.map((w) => (
						<path key={w.d} d={w.d} fill={w.fill} />
					))}
				</g>
				<circle className="sk-nova-glow" cx="12" cy="12" r={NOVA_GLOW_RADIUS} fill={`url(#${id}-g)`} opacity={glow ?? (variant === "onDark" ? 1 : NOVA_GLOW_OPACITY)} />
			</g>
		</svg>
	);
}

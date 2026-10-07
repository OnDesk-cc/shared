/**
 * El aviso (2026-10-06): lo que una pantalla tiene que decir antes de lo demás o
 * al lado de ello — que una acción queda auditada, que nadie más puede ver un
 * proyecto privado, que el servidor devolvió un error. Antes había nueve
 * variantes a mano en las seis apps (cajas de filete gris, bandas ámbar, cajas
 * con borde rojo, filetes de color en el canto izquierdo, cajas punteadas); todas
 * son esta pieza.
 *
 *   Callout  el fondo tintado con su glifo, un título opcional y el texto
 *
 * Los tonos:
 *
 *   info     niebla: la letra pequeña que acompaña (por defecto)
 *   accent   el tinte del acento: lo que es tuyo o una pista
 *   warning  ámbar: lo que hay que leer antes de seguir
 *   danger   rojo apagado: un error, o lo que no se deshace
 *
 * Sin borde y sin filete de color: el tono lo dicen el fondo y el glifo. Con
 * `band` va de canto a canto y sin radio (dentro de una hoja, sobre una lista).
 * `Note` y `Alert` de `console-kit` son esta pieza con su tono puesto.
 */
import type { ElementType, ReactNode } from "react";
import { CircleAlert, Info, TriangleAlert } from "lucide-react";

export type CalloutTone = "info" | "accent" | "warning" | "danger";

const ICONS: Record<CalloutTone, ElementType> = {
	info: Info,
	accent: Info,
	warning: TriangleAlert,
	danger: CircleAlert,
};

export function Callout({
	tone = "info",
	icon,
	title,
	action,
	band = false,
	role,
	className = "",
	children,
}: {
	tone?: CalloutTone;
	/** Otro glifo de lucide, o `false` para ninguno. */
	icon?: ElementType | false;
	title?: ReactNode;
	/** Un enlace o un botón pequeño al final del texto. */
	action?: ReactNode;
	/** De canto a canto y sin radio. */
	band?: boolean;
	/** `alert` para un error que acaba de pasar; por defecto ninguno (`status` si cambia en vivo). */
	role?: "alert" | "status";
	className?: string;
	children?: ReactNode;
}) {
	const Icon = icon === false ? null : (icon ?? ICONS[tone]);
	return (
		<div data-slot="callout" data-tone={tone} role={role} className={`sk-callout ${band ? "sk-callout--band" : ""} ${className}`}>
			{Icon && <Icon className="sk-callout-icon" strokeWidth={1.75} aria-hidden="true" />}
			<div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
				{title && <p className="sk-callout-title">{title}</p>}
				{children && <div className={`max-w-[72ch] ${title ? "mt-0.5" : ""}`}>{children}</div>}
				{action && <div className="mt-2 flex flex-wrap items-center gap-2">{action}</div>}
			</div>
		</div>
	);
}

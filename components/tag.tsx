/**
 * La píldora de un dato (2026-10-06): el tipo de un elemento, un permiso, un
 * estado, una prioridad. Antes cada app la dibujaba a mano —un `<span>` con
 * borde, monoespaciada de 9px en mayúsculas— y el `Badge` de shadcn pintaba
 * `secondary` como una píldora de tinta sólida que tapaba el texto de al lado.
 * `Badge` (`ui/badge`) y `Stamp` (`console-kit`) son ahora esta pieza.
 *
 *   Tag   la palabra en su píldora, con un icono opcional y un tono
 *
 * Los tonos son los de `GLYPH_TONES` de la barra superior, para que el glifo de
 * un aviso y la píldora del mismo estado se lean igual:
 *
 *   neutral  niebla y tinta secundaria (por defecto: casi todo es esto)
 *   accent   el tinte del acento, para lo que es tuyo o está elegido
 *   warning  ámbar, para lo que pide mirarse
 *   danger   rojo apagado, para lo que se paró o no se deshace
 *   success  verde, sólo para lo que terminó bien
 *   ink      tinta sólida, para lo que está en marcha ahora
 *
 * El color nunca dice el estado solo: la palabra va siempre. El CSS (`.sk-tag`)
 * vive en el bloque de productos de `product.css`, sin capa, así que una clase de
 * la pantalla vieja (`rounded-none`, `font-mono`, un borde) no la deshace.
 */
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

export type TagTone = "neutral" | "accent" | "warning" | "danger" | "success" | "ink";

export function Tag({
	tone = "neutral",
	icon: Icon,
	size = "sm",
	className = "",
	children,
	...rest
}: Omit<ComponentPropsWithoutRef<"span">, "children"> & {
	tone?: TagTone;
	/** Un icono de lucide delante de la palabra. */
	icon?: ElementType;
	size?: "sm" | "md";
	children: ReactNode;
}) {
	return (
		<span data-slot="tag" data-tone={tone} data-size={size} className={`sk-tag ${className}`} {...rest}>
			{Icon && <Icon strokeWidth={2} aria-hidden="true" />}
			<span>{children}</span>
		</span>
	);
}

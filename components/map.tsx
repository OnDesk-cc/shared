/**
 * Las piezas pequeñas del mapa que llevan los seis productos: la banda de seis
 * líneas y el cierre de seis tramos. Copiadas de
 * `ondesk/src/features/frontend/network-map.tsx`; la banda añade `focus`, que
 * es lo propio de un producto: dentro de una app se viaja en UNA línea, así que
 * la suya va encendida y las otras cinco se apagan al 18 %, la misma regla que
 * el mapa de la portada cuando se elige a un viajero.
 */
import type { CSSProperties } from "react";
import { PRODUCT_IDS, lineColor, type ProductId } from "../lib/lines";

/**
 * Las seis líneas apiladas como una banda: la franja de colores de un andén.
 * Con `focus`, la línea de esa app queda encendida y las demás se atenúan; con
 * `focus` a `null` la banda vuelve a estar toda encendida.
 */
export function LineBand({ className = "", focus }: { className?: string; focus?: ProductId | null }) {
	return (
		<div className={`flex flex-col ${focus ? "band--focus" : ""} ${className}`} aria-hidden="true">
			{PRODUCT_IDS.map((id) => (
				<span key={id} className={`band-row block h-1 ${id === focus ? "is-lit" : ""}`} style={{ background: lineColor(id) }} />
			))}
		</div>
	);
}

/** Seis tramos cortos que acaban en su barra de terminal: el cierre de una página. */
export function LineStub({ className = "" }: { className?: string }) {
	const h = 6 * 22 + 10;
	return (
		<svg viewBox={`0 0 240 ${h}`} className={`block h-auto ${className}`} aria-hidden="true">
			{PRODUCT_IDS.map((id, i) => {
				const y = 12 + i * 22;
				return (
					<g key={id}>
						<path d={`M 0 ${y} H 200`} className="map-line" style={{ stroke: lineColor(id) }} />
						<line x1={210} x2={210} y1={y - 12} y2={y + 12} stroke="currentColor" strokeWidth={4} />
					</g>
				);
			})}
		</svg>
	);
}

/** El tramo de una línea junto a su nombre: cómo se nombra una app en una fila. */
export function AppLine({ id, name, className = "" }: { id: ProductId | string; name?: string; className?: string }) {
	return (
		<span className={`inline-flex min-w-0 items-center gap-2.5 ${className}`}>
			<span className="swatch" style={{ "--swatch": lineColor(id), width: "1.25rem" } as CSSProperties} aria-hidden="true" />
			<span className="min-w-0 truncate font-bold">{name ?? id}</span>
		</span>
	);
}

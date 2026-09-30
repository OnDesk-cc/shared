/**
 * Las piezas de página que las seis apps ya usaban (`PageHeader`, `StatGrid`,
 * `StatTile`, `PanelHeader`, `EmptyState`, `ConsoleTag`), redibujadas en el
 * mundo del mapa de red con la misma API, para que cada pantalla que las monta
 * se lea como una hoja de paradas sin tocarla.
 *
 *   PageHeader   la primera parada de la página: el filete grueso, la marca que
 *                cruza el eje en el color de la línea, la meta de estación a la
 *                derecha, el título y su única acción
 *   PanelHeader  una parada menor: el filete con el rótulo de andén
 *   StatGrid     una tabla de zonas (celdas separadas por el trazo del mundo)
 *   StatTile     una celda: rótulo, cifra en display tabular, nota
 *   EmptyState   una frase en negrita y su nota; sin icono decorativo
 *   ConsoleTag   el rótulo de andén
 *
 * Lo que se retira sin sustituto: el antetítulo en monoespaciada con cursor
 * parpadeante, la numeración («02 — TICKETS»: se limpia si llega), el punto
 * lima que late y la línea de barrido.
 */
import type { ReactNode, ElementType } from "react";

/** El rótulo de andén: condensado, en versalitas espaciadas, en tinta secundaria. */
export function ConsoleTag({ children, className = "" }: { children: ReactNode; className?: string }) {
	return <span className={`t-tab text-(--ink-2) ${className}`}>{children}</span>;
}

/** «01 — Overview» → «Overview»: la numeración de sección no existe en el mapa. */
function stripOrdinal(tag: string): string {
	return tag.replace(/^\s*\d{1,2}\s*[—–-]\s*/, "").trim();
}

/**
 * La primera parada de una página. `tag` era el antetítulo; ahora es la meta de
 * estación a la derecha del filete, y sólo se imprime si dice algo que el
 * título no dice ya (la vieja «01 — Overview» sobre «Overview» no se imprime).
 */
export function PageHeader({
	tag,
	title,
	description,
	actions,
	meta,
}: {
	/** El nombre corto de la sección; se imprime como meta de estación si difiere del título. */
	tag?: string;
	title: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
	/** El dato vivo de la página («14 open · 3 waiting»); manda sobre `tag`. */
	meta?: ReactNode;
}) {
	const tagText = tag ? stripOrdinal(tag) : "";
	const stationMeta = meta ?? (tagText && (typeof title !== "string" || tagText.toLowerCase() !== title.toLowerCase()) ? tagText : null);
	return (
		<header className="rule pt-4">
			<div className="flex min-h-7 items-center justify-between gap-6">
				<span className="stop-mark" aria-hidden="true" />
				{stationMeta && <span className="t-tab text-right text-(--ink-2)">{stationMeta}</span>}
			</div>
			<div className="mt-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
				<div className="min-w-0 max-w-3xl">
					<h1 className="t-h2 text-[1.5rem] md:text-[1.625rem]">{title}</h1>
					{description && <p className="mt-2 max-w-[72ch] text-[1.05rem] leading-snug text-(--ink-2)">{description}</p>}
				</div>
				{actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
			</div>
		</header>
	);
}

/**
 * Una tabla de zonas: las celdas separadas por el trazo del mundo, como la tabla
 * de niveles de la página de precios. Las columnas van por className, p. ej.
 * `sm:grid-cols-2 lg:grid-cols-4`.
 */
export function StatGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
	return <div className={`zone ${className}`}>{children}</div>;
}

/**
 * Una celda de la tabla de zonas: el rótulo de andén, la cifra en display con
 * cifras tabulares y una nota. `tone` sólo distingue lo que se paró (`alert`,
 * en rojo de error); lo demás es tinta, porque en el mapa una cifra buena o mala
 * se dice con la nota, no con un color. `icon` se acepta y no se pinta.
 */
export function StatTile({
	label,
	value,
	hint,
	tone = "default",
}: {
	label: string;
	value: ReactNode;
	hint?: ReactNode;
	icon?: ElementType;
	tone?: "default" | "accent" | "warning" | "destructive" | "alert";
}) {
	const alert = tone === "destructive" || tone === "alert";
	return (
		<div className="flex min-w-0 flex-col p-4 md:p-5">
			<p className="t-tab text-(--ink-2)">{label}</p>
			<p className={`t-display t-num mt-3 text-[2rem] md:text-[2.5rem] ${alert ? "text-(--destructive)" : ""}`}>{value}</p>
			{hint && <p className="mt-2 text-[0.9rem] leading-snug text-(--ink-2)">{hint}</p>}
		</div>
	);
}

/** Una parada menor: el filete grueso con el rótulo de andén a la izquierda y lo que haga falta a la derecha. */
export function PanelHeader({ label, right, className = "" }: { label: string; right?: ReactNode; className?: string }) {
	return (
		<div className={`rule flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-3 pb-3 ${className}`}>
			<p className="t-tab">{label}</p>
			{right && <div className="flex items-center gap-2">{right}</div>}
		</div>
	);
}

/**
 * Lo que dice una parada cuando no hay nada en ella: una frase en negrita que
 * nombra el hueco y una nota que dice cómo se llenará. Sin icono: el mundo no
 * lleva glifos decorativos, y `icon` se acepta sólo por compatibilidad.
 */
export function EmptyState({
	title,
	description,
	action,
	className = "",
}: {
	icon?: ElementType;
	title: string;
	description?: string;
	action?: ReactNode;
	className?: string;
}) {
	return (
		<div className={`flex flex-col items-start justify-center gap-1 py-8 ${className}`}>
			<p className="font-bold leading-snug">{title}</p>
			{description && <p className="max-w-[60ch] text-[0.95rem] leading-snug text-(--ink-2)">{description}</p>}
			{action && <div className="mt-3">{action}</div>}
		</div>
	);
}

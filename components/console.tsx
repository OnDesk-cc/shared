/**
 * Las piezas de página que las seis apps ya usaban (`PageHeader`, `StatGrid`,
 * `StatTile`, `PanelHeader`, `EmptyState`, `ConsoleTag`), en el mundo «Clear
 * Sky» desde el 2026-10-04 y con la misma API, para que cada pantalla que las
 * monta se mude sin tocarla.
 *
 *   PageHeader   el titular de la página, su frase y su única acción
 *   PanelHeader  el titular de un bloque, con lo que haga falta a la derecha
 *   StatGrid     una rejilla de cifras
 *   StatTile     una tarjeta blanca: rótulo, cifra, nota
 *   EmptyState   una frase que nombra el hueco y otra que dice cómo se llena
 *   ConsoleTag   un rótulo pequeño
 *
 * Sin antetítulos: `tag` sólo se imprime, pequeño y debajo, si dice algo que el
 * título no dice ya, y la numeración («02 — TICKETS») se limpia si llega.
 */
import type { ReactNode, ElementType } from "react";

/** Un rótulo pequeño, en tinta terciaria. */
export function ConsoleTag({ children, className = "" }: { children: ReactNode; className?: string }) {
	return <span className={`text-[0.8125rem] font-medium text-(--sk-ink-3) ${className}`}>{children}</span>;
}

/** «01 — Overview» → «Overview»: la numeración de sección es un adorno. */
function stripOrdinal(tag: string): string {
	return tag.replace(/^\s*\d{1,2}\s*[—–-]\s*/, "").trim();
}

/** El titular de una página: el título, su frase, el dato vivo y su única acción. */
export function PageHeader({
	tag,
	title,
	description,
	actions,
	meta,
}: {
	/** El nombre corto de la sección; se imprime sólo si difiere del título. */
	tag?: string;
	title: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
	/** El dato vivo de la página («14 open · 3 waiting»); manda sobre `tag`. */
	meta?: ReactNode;
}) {
	const tagText = tag ? stripOrdinal(tag) : "";
	const note = meta ?? (tagText && (typeof title !== "string" || tagText.toLowerCase() !== title.toLowerCase()) ? tagText : null);
	return (
		<header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pt-2">
			<div className="min-w-0 max-w-3xl">
				<h1 className="text-[1.625rem] font-medium leading-[1.15] tracking-[-0.03em] text-balance text-(--sk-ink) md:text-[1.875rem]">{title}</h1>
				{description && <p className="mt-2 max-w-[68ch] text-[0.9375rem] leading-relaxed text-(--sk-ink-2)">{description}</p>}
				{note && <p className="mt-2 text-[0.8125rem] text-(--sk-ink-3)">{note}</p>}
			</div>
			{actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
		</header>
	);
}

/** Una rejilla de cifras. Las columnas van por className, p. ej. `sm:grid-cols-2 lg:grid-cols-4`. */
export function StatGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
	return <div className={`grid gap-4 ${className}`}>{children}</div>;
}

/**
 * Una cifra en su tarjeta: el rótulo, la cifra tabular y una nota. `tone` sólo
 * distingue lo que se paró (`alert`, en rojo); una cifra buena o mala se dice
 * con la nota, no con un color. `icon` se acepta y no se pinta.
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
		<div className="flex min-w-0 flex-col rounded-[18px] bg-white p-5 shadow-(--sk-shadow-1)">
			<p className="text-[0.8125rem] font-medium text-(--sk-ink-3)">{label}</p>
			<p className={`mt-3 text-[1.875rem] font-medium leading-none tracking-[-0.035em] tabular-nums ${alert ? "text-[#b3261e]" : "text-(--sk-ink)"}`}>{value}</p>
			{hint && <p className="mt-2.5 text-[0.8125rem] leading-snug text-(--sk-ink-3)">{hint}</p>}
		</div>
	);
}

/** El titular de un bloque, con lo que haga falta a la derecha. Dentro de una tarjeta toma su relleno. */
export function PanelHeader({ label, right, className = "" }: { label: string; right?: ReactNode; className?: string }) {
	return (
		<div data-slot="panel-header" className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pb-3 in-data-[slot=card]:px-5 in-data-[slot=card]:pt-4 ${className}`}>
			<p className="text-[0.9375rem] font-medium tracking-[-0.01em] text-(--sk-ink)">{label}</p>
			{right && <div className="flex items-center gap-2">{right}</div>}
		</div>
	);
}

/**
 * Lo que dice un bloque cuando no hay nada en él: una frase que nombra el hueco
 * y una nota que dice cómo se llenará. Sin icono decorativo; `icon` se acepta
 * sólo por compatibilidad. Dentro de una tarjeta toma su relleno.
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
		<div data-slot="empty-state" className={`flex flex-col items-start justify-center gap-1 py-8 in-data-[slot=card]:px-5 ${className}`}>
			<p className="text-[0.9375rem] font-medium leading-snug text-(--sk-ink)">{title}</p>
			{description && <p className="max-w-[60ch] text-[0.875rem] leading-relaxed text-(--sk-ink-3)">{description}</p>}
			{action && <div className="mt-3">{action}</div>}
		</div>
	);
}

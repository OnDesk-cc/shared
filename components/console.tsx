/**
 * Las piezas de página que las seis apps ya usaban (`PageHeader`, `StatGrid`,
 * `StatTile`, `PanelHeader`, `EmptyState`, `ConsoleTag`), en el mundo «Clear
 * Sky» desde el 2026-10-04 y con la misma API, para que cada pantalla que las
 * monta se mude sin tocarla.
 *
 *   PageHeader   el titular de la página, su frase y su única acción
 *   PanelHeader  el titular de un bloque, con lo que haga falta a la derecha
 *   StatGrid     una rejilla de cifras
 *   StatTile     una tarjeta blanca: rótulo, cifra, nota y su icono en un círculo
 *   EmptyState   una frase que nombra el hueco y otra que dice cómo se llena
 *   ConsoleTag   un rótulo pequeño
 *
 * Y, desde el 2026-10-06, las piezas con las que la consola de ondesk compone
 * su inicio, para que los seis paneles de producto se lean igual que ella en
 * vez de inventar cada uno su caja y su fila:
 *
 *   Panel          la tarjeta de sección de la consola (`Section`): título, dato
 *                  vivo debajo y su única acción a la derecha
 *   textLinkClass  el enlace de texto de la consola: acento, subrayado al pasar
 *   LinkArrow      su flecha, que avanza al pasar
 *   ChartTooltip   el tooltip de recharts: tarjeta blanca, una fila por serie
 *   RowList        una lista de filas con filete fino, dentro del relleno
 *   rowClass       la fila que es un enlace o un botón (se pone en el `<Link>`
 *                  de cada app: shared no conoce sus rutas)
 *   RowContent     lo de dentro de una fila: icono, título, línea y final
 *
 * Sin antetítulos: `tag` sólo se imprime, pequeño y debajo, si dice algo que el
 * título no dice ya, y la numeración («02 — TICKETS») se limpia si llega.
 */
import { useId, type ReactNode, type ElementType } from "react";
import { ArrowRight } from "lucide-react";
import { Section } from "./console-kit";

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
 * Una cifra en su tarjeta, como las del inicio de la consola de ondesk: el
 * rótulo, su icono en un círculo de niebla, la cifra tabular y una nota. `tone`
 * sólo distingue lo que se paró (`alert`/`destructive`, en rojo en la cifra y
 * en el círculo) y lo que pide mirarse (`warning`, sólo el círculo); una cifra
 * buena o mala se dice con la nota, no con un color.
 */
export function StatTile({
	label,
	value,
	hint,
	icon: Icon,
	tone = "default",
}: {
	label: string;
	value: ReactNode;
	hint?: ReactNode;
	icon?: ElementType;
	tone?: "default" | "accent" | "warning" | "destructive" | "alert";
}) {
	const alert = tone === "destructive" || tone === "alert";
	const ring = alert ? "bg-[#fbeceb] text-[#b3261e]" : tone === "warning" ? "bg-[#fdf1e1] text-[#a35f00]" : "bg-(--sk-ground) text-(--sk-ink-2)";
	return (
		<div className="flex min-w-0 flex-col rounded-[18px] bg-white p-5 shadow-(--sk-shadow-1)">
			<div className="flex items-start justify-between gap-3">
				<p className="text-[0.8125rem] font-medium text-(--sk-ink-2)">{label}</p>
				{Icon && (
					<span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full ${ring}`} aria-hidden="true">
						<Icon className="size-4" strokeWidth={1.75} />
					</span>
				)}
			</div>
			<p
				className={`text-[2rem] font-medium leading-none tracking-[-0.03em] tabular-nums ${Icon ? "mt-2" : "mt-3"} ${alert ? "text-[#b3261e]" : "text-(--sk-ink)"}`}>
				{value}
			</p>
			{hint && <p className="mt-2 text-[0.8125rem] leading-snug text-(--sk-ink-3)">{hint}</p>}
		</div>
	);
}

// ─── las piezas del inicio de la consola ─────────────────────────────────────

/**
 * Una sección del panel: la tarjeta blanca de la consola de ondesk, la misma
 * `Section` y no una imitación. El título, el dato vivo debajo en voz pequeña
 * («3 open · 1 overdue», «last 7 days») y su única acción a la derecha, que es
 * un enlace con `textLinkClass`. `id` sólo hace falta si alguien enlaza a la
 * sección con un ancla.
 */
export function Panel({
	id,
	title,
	meta,
	action,
	className = "",
	children,
}: {
	id?: string;
	title: ReactNode;
	meta?: ReactNode;
	action?: ReactNode;
	/** Para colocarla en una rejilla: `lg:col-span-7`. */
	className?: string;
	children: ReactNode;
}) {
	const fallback = useId().replace(/:/g, "");
	const section = (
		<Section id={id ?? `panel-${fallback}`} title={title} meta={meta} action={action}>
			{children}
		</Section>
	);
	return className ? <div className={`min-w-0 [&>section]:h-full ${className}`}>{section}</div> : section;
}

/**
 * El enlace de texto de la consola: acento, sin subrayado hasta que se pasa por
 * encima. Va en el `<Link>` (o el `<button>`) de cada app.
 */
export const textLinkClass =
	"group/link inline-flex items-center gap-1 rounded-[4px] font-medium text-(--sk-accent) no-underline underline-offset-[0.2em] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--sk-accent)";

/** La flecha de un enlace de sección («All tickets →»): avanza un poco al pasar por el enlace. */
export function LinkArrow() {
	return (
		<ArrowRight
			className="size-4 transition-transform duration-200 ease-out group-hover/link:translate-x-0.5 motion-reduce:transition-none"
			strokeWidth={1.75}
			aria-hidden="true"
		/>
	);
}

// ─── el tooltip de los gráficos ──────────────────────────────────────────────

/** Las marcas de los ejes de recharts: la voz del cielo, en tinta terciaria. */
export const chartTick = { fill: "var(--sk-ink-3)", fontSize: 12, fontFamily: "var(--sk-font)" };
/** La leyenda de recharts (`<Legend wrapperStyle={chartLegend} />`): la misma voz, en tinta secundaria. */
export const chartLegend = { fontSize: 12, fontFamily: "var(--sk-font)", color: "var(--sk-ink-2)" };

type TooltipItem = {
	name?: string | number;
	value?: number | string | Array<number | string>;
	color?: string;
	stroke?: string;
	fill?: string;
	dataKey?: string | number | ((obj: unknown) => unknown);
	payload?: { fill?: string } & Record<string, unknown>;
};

/**
 * El tooltip de recharts en el mundo del cielo: una tarjeta blanca con su
 * sombra, la etiqueta arriba y una fila por serie con su trazo, su nombre y la
 * cifra tabular. Se monta con `<Tooltip content={<ChartTooltip />} />` y respeta
 * el `formatter` y el `labelFormatter` que ya lleve el `<Tooltip>` (recharts se
 * los pasa al contenido).
 */
export function ChartTooltip({
	active,
	payload,
	label,
	formatter,
	labelFormatter,
}: {
	active?: boolean;
	payload?: TooltipItem[];
	label?: ReactNode;
	// La firma de recharts: (value, name, item, index, payload) → valor o [valor, nombre].
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	formatter?: (...args: any[]) => ReactNode | [ReactNode, ReactNode];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	labelFormatter?: (...args: any[]) => ReactNode;
}) {
	if (!active || !payload?.length) return null;
	const heading = labelFormatter ? labelFormatter(label, payload) : label;
	return (
		<div className="min-w-36 rounded-[12px] bg-white px-3 py-2.5 text-[0.8125rem] shadow-(--sk-shadow-2)">
			{heading !== undefined && heading !== null && heading !== "" && <p className="mb-1.5 font-medium text-(--sk-ink)">{heading}</p>}
			<ul className="flex flex-col gap-1">
				{payload.map((item, i) => {
					const raw = formatter ? formatter(item.value, item.name, item, i, payload) : item.value;
					const [value, name] = Array.isArray(raw) && raw.length === 2 && !Array.isArray(item.value) ? raw : [raw, item.name];
					const color = item.color ?? item.stroke ?? item.fill ?? item.payload?.fill ?? "var(--sk-ink-3)";
					return (
						<li key={`${String(item.dataKey ?? item.name)}-${i}`} className="flex items-center gap-2 text-(--sk-ink-2)">
							<span className="h-0.75 w-3 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
							<span className="flex-1">{name as ReactNode}</span>
							<span className="font-medium text-(--sk-ink) tabular-nums">{value as ReactNode}</span>
						</li>
					);
				})}
			</ul>
		</div>
	);
}

/** Una lista de filas con filete fino. Sus filas sobresalen un poco del texto para que el fondo al pasar respire. */
export function RowList({ children, label }: { children: ReactNode; label?: string }) {
	return (
		<ul className="sk-rows" aria-label={label}>
			{children}
		</ul>
	);
}

/** La fila que es un enlace o un botón: cursor de mano, fondo de niebla al pasar, foco visible. */
export const rowClass = "sk-row";
/** Una fila que no lleva a ninguna parte: el mismo ritmo, sin fondo ni cursor. */
export const rowStaticClass = "sk-row sk-row--static";

/**
 * Lo de dentro de una fila: el icono (o la cara) a la izquierda, el título y su
 * línea pequeña, y al final lo que se compara de un vistazo (una cifra, una
 * fecha, una píldora).
 */
export function RowContent({
	icon: Icon,
	lead,
	title,
	sub,
	end,
}: {
	/** Un icono de lucide, pintado en su cuadro de niebla. */
	icon?: ElementType;
	/** O lo que vaya a la izquierda tal cual: una cara (`Monogram`, `Avatar`), un punto de estado. */
	lead?: ReactNode;
	title: ReactNode;
	sub?: ReactNode;
	end?: ReactNode;
}) {
	return (
		<>
			{Icon ? (
				<span className="sk-row-icon" aria-hidden="true">
					<Icon className="size-4" strokeWidth={1.75} />
				</span>
			) : (
				lead
			)}
			<span className="min-w-0 flex-1">
				<span className="sk-row-title">{title}</span>
				{sub && <span className="sk-row-sub">{sub}</span>}
			</span>
			{end && <span className="sk-row-end">{end}</span>}
		</>
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

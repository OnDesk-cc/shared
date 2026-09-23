/**
 * Primitivas de consola — esquinas duras, rejillas de línea fina, rótulos de
 * telemetría en monoespaciada, líneas de escaneo lima. El lenguaje de panel
 * compartido de Halo, Nexus, Orbit, Pulse y Vault; la contraparte de marketing a
 * la que antes apuntaba vive ahora en ondesk.
 * ▸ Hoy: Atlas también lo usa.
 *
 * Úsalas en lugar de cabeceras de Card improvisadas para que cada página de
 * panel se lea como el mismo cuadro de instrumentos.
 */
import type { ReactNode, ElementType } from "react";

/** Micro-rótulo de telemetría en monoespaciada, p. ej. `02 — TICKETS`. */
export function ConsoleTag({ children, className = "" }: { children: ReactNode; className?: string }) {
	return <span className={`console-label ${className}`}>{children}</span>;
}

/**
 * Cabecera estándar de página de panel: antetítulo en monoespaciada con cursor
 * parpadeante, título grueso con el interletrado apretado, descripción y
 * acciones opcionales, y cerrada por una línea fina.
 */
export function PageHeader({
	tag,
	title,
	description,
	actions,
}: {
	/** Antetítulo en monoespaciada, p. ej. «TICKETS» o «02 — ANALYTICS» */
	tag: string;
	title: ReactNode;
	description?: string;
	actions?: ReactNode;
}) {
	return (
		<div className="border-b border-border pb-4">
			<div className="flex items-center gap-2 mb-1.5">
				<span className="size-1.5 rounded-full bg-accent dot-live text-accent" />
				<ConsoleTag className="text-primary dark:text-accent">
					{tag}
					<span className="blink-cursor text-accent">_</span>
				</ConsoleTag>
			</div>
			<div className="flex items-end justify-between gap-4 flex-wrap">
				<div>
					<h1 className="text-2xl font-black tracking-tight text-balance">{title}</h1>
					{description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
				</div>
				{actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
			</div>
		</div>
	);
}

/**
 * Rejilla de cifras de línea fina — celdas separadas por bordes de 1px, estilo
 * editorial. Envuelve hijos StatTile. Las columnas van por className, p. ej.
 * `sm:grid-cols-2 lg:grid-cols-4`.
 */
export function StatGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
	return <div className={`grid gap-px border border-border bg-border ${className}`}>{children}</div>;
}

/** Una celda de un StatGrid: rótulo en monoespaciada, número tabular grande, variación o pista opcional. */
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
	tone?: "default" | "accent" | "warning" | "destructive";
}) {
	const valueTone =
		tone === "accent"
			? "text-accent"
			: tone === "warning"
				? "text-warning"
				: tone === "destructive"
					? "text-destructive"
					: "text-foreground";
	return (
		<div className="group relative bg-card p-4">
			<div className="flex items-center justify-between gap-2">
				<ConsoleTag>{label}</ConsoleTag>
				{Icon && <Icon className="size-3.5 text-muted-foreground/60" />}
			</div>
			<div className={`mt-2 text-3xl font-black tracking-tight tabular-nums ${valueTone}`}>{value}</div>
			{hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>}
			<span className="scan-line" />
		</div>
	);
}

/** Fila de cabecera de panel de línea fina: rótulo en monoespaciada a la izquierda, metadatos opcionales a la derecha. */
export function PanelHeader({ label, right, className = "" }: { label: string; right?: ReactNode; className?: string }) {
	return (
		<div className={`flex items-center justify-between border-b border-border px-4 py-2.5 ${className}`}>
			<ConsoleTag className="text-primary dark:text-accent">{label}</ConsoleTag>
			{right && <div className="flex items-center gap-2">{right}</div>}
		</div>
	);
}

/**
 * Estado vacío cuadrado con leyenda en monoespaciada.
 *
 * El icono es opcional. Un estado vacío dentro de un panel que ya lleva una
 * cabecera con rótulo es un glifo explicando lo que la cabecera acaba de decir, y
 * una columna de ellos a lo largo de una página se lee como decoración y no como
 * significado. Pasa uno cuando el estado vacío ES la página.
 */
export function EmptyState({
	icon: Icon,
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
		<div className={`flex flex-col items-center justify-center gap-2 py-10 text-center ${className}`}>
			{Icon && (
				<div className="flex size-10 items-center justify-center border border-border bg-secondary/60 mb-1">
					<Icon className="size-4.5 text-muted-foreground" />
				</div>
			)}
			<p className="font-mono text-xs uppercase tracking-[0.12em] font-semibold">{title}</p>
			{description && <p className="text-xs text-muted-foreground max-w-xs">{description}</p>}
			{action && <div className="mt-2">{action}</div>}
		</div>
	);
}

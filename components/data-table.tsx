/**
 * La tabla de una página (2026-10-06): auditoría, avisos, listas de elementos.
 * Antes cada app ponía su `ui/table` dentro de una caja cuadrada de 1px, con su
 * vacío en otra caja y su paginador escrito a mano.
 *
 *   DataTable   un `Panel` sin relleno: cabecera, barra de filtros opcional, la
 *               tabla, el vacío, la carga, el error y el paginador
 *   Pagination  «1–25 of 132», filas por página y anterior/siguiente
 *
 * Las columnas se declaran (`columns`); una fila con `onRowClick` responde al
 * pasar, al Intro y al espacio. `hideBelow` esconde una columna secundaria en un
 * teléfono en vez de obligar a desplazar de lado.
 */
import type { KeyboardEvent, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Panel, EmptyState } from "./console";
import { Callout } from "./callout";
import { Skeleton } from "./console-kit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";

// ─── el paginador ────────────────────────────────────────────────────────────

export interface PaginationProps {
	/** Empieza en 1. */
	page: number;
	pageSize: number;
	total: number;
	onPageChange: (page: number) => void;
	pageSizeOptions?: number[];
	onPageSizeChange?: (size: number) => void;
	className?: string;
}

/**
 * «1–25 of 132» a la izquierda; a la derecha las filas por página (si se pueden
 * cambiar), la página y las flechas. No se pinta si todo cabe en una página y no
 * hay nada que cambiar.
 */
export function Pagination({ page, pageSize, total, onPageChange, pageSizeOptions, onPageSizeChange, className = "" }: PaginationProps) {
	const smallest = Math.min(pageSize, ...(onPageSizeChange && pageSizeOptions?.length ? pageSizeOptions : [pageSize]));
	if (total <= smallest) return null;
	const pages = Math.max(1, Math.ceil(total / pageSize));
	const current = Math.min(Math.max(1, page), pages);
	const from = (current - 1) * pageSize + 1;
	const to = Math.min(current * pageSize, total);
	const fmt = (n: number) => n.toLocaleString("en");
	return (
		<nav className={`sk-pager ${className}`} aria-label="Pagination">
			<p aria-live="polite">
				<span className="text-(--sk-ink-2)">
					{fmt(from)}–{fmt(to)}
				</span>{" "}
				of {fmt(total)}
			</p>
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
				{onPageSizeChange && pageSizeOptions && pageSizeOptions.length > 1 && (
					<label className="flex items-center gap-2">
						<span>Rows per page</span>
						<select
							className="field field--sm sk-select w-auto! min-h-[30px]! py-0! pr-8!"
							value={pageSize}
							onChange={(e) => onPageSizeChange(Number(e.target.value))}>
							{pageSizeOptions.map((n) => (
								<option key={n} value={n}>
									{n}
								</option>
							))}
						</select>
					</label>
				)}
				<div className="flex items-center gap-1.5">
					<span className="mr-1">
						Page {fmt(current)} of {fmt(pages)}
					</span>
					<button
						type="button"
						className="ticket ticket--glyph ticket--xs"
						aria-label="Previous page"
						disabled={current <= 1}
						onClick={() => onPageChange(current - 1)}>
						<ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
					</button>
					<button
						type="button"
						className="ticket ticket--glyph ticket--xs"
						aria-label="Next page"
						disabled={current >= pages}
						onClick={() => onPageChange(current + 1)}>
						<ChevronRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
					</button>
				</div>
			</div>
		</nav>
	);
}

// ─── la tabla ────────────────────────────────────────────────────────────────

export interface DataColumn<T> {
	key: string;
	header: ReactNode;
	cell: (row: T) => ReactNode;
	/** Para la celda y su cabecera: anchura, `whitespace-nowrap`… */
	className?: string;
	align?: "start" | "end";
	/** Por debajo de este ancho la columna no se pinta. */
	hideBelow?: "sm" | "md" | "lg";
}

const HIDE: Record<NonNullable<DataColumn<unknown>["hideBelow"]>, string> = {
	sm: "hidden sm:table-cell",
	md: "hidden md:table-cell",
	lg: "hidden lg:table-cell",
};

export function DataTable<T>({
	id,
	title,
	meta,
	action,
	toolbar,
	columns,
	rows,
	rowKey,
	onRowClick,
	selectedKey,
	isLoading = false,
	error,
	empty,
	pagination,
	className,
}: {
	id?: string;
	title?: ReactNode;
	meta?: ReactNode;
	action?: ReactNode;
	/** Los filtros: van bajo la cabecera, dentro de la tarjeta. */
	toolbar?: ReactNode;
	columns: DataColumn<T>[];
	rows: T[];
	rowKey: (row: T) => string;
	onRowClick?: (row: T) => void;
	/** La fila abierta en un panel o una hoja. */
	selectedKey?: string | null;
	isLoading?: boolean;
	error?: Error | null;
	/** El vacío: `title` y, si se quiere, `description` y `action`. */
	empty: { title: ReactNode; description?: ReactNode; action?: ReactNode };
	pagination?: PaginationProps;
	className?: string;
}) {
	const cellClass = (c: DataColumn<T>) => `${c.hideBelow ? HIDE[c.hideBelow] : ""} ${c.align === "end" ? "text-right" : ""} ${c.className ?? ""}`;

	let body: ReactNode;
	if (error) {
		body = (
			<div className="px-5 pb-5 sm:px-7 sm:pb-6">
				<Callout tone="danger" role="alert">
					{error.message || "This list couldn't load. Try again in a moment."}
				</Callout>
			</div>
		);
	} else if (isLoading && rows.length === 0) {
		body = (
			<div className="px-5 pb-6 pt-2 sm:px-7">
				<Skeleton rows={5} />
			</div>
		);
	} else if (rows.length === 0) {
		body = <EmptyState title={empty.title} description={empty.description} action={empty.action} />;
	} else {
		body = (
			<Table aria-busy={isLoading || undefined}>
				<TableHeader>
					<TableRow>
						{columns.map((c) => (
							<TableHead key={c.key} className={cellClass(c)}>
								{c.header}
							</TableHead>
						))}
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.map((row) => {
						const key = rowKey(row);
						const open = onRowClick ? () => onRowClick(row) : undefined;
						return (
							<TableRow
								key={key}
								data-selected={selectedKey === key || undefined}
								aria-selected={selectedKey ? selectedKey === key : undefined}
								tabIndex={open ? 0 : undefined}
								onClick={open}
								onKeyDown={
									open
										? (e: KeyboardEvent<HTMLTableRowElement>) => {
												if (e.target !== e.currentTarget) return;
												if (e.key === "Enter" || e.key === " ") {
													e.preventDefault();
													open();
												}
											}
										: undefined
								}>
								{columns.map((c) => (
									<TableCell key={c.key} className={cellClass(c)}>
										{c.cell(row)}
									</TableCell>
								))}
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		);
	}

	const showPager = pagination && !error && rows.length > 0;
	return (
		<Panel id={id} title={title} meta={meta} action={action} variant="flush" className={className}>
			{toolbar && <div className="sk-flush-bar">{toolbar}</div>}
			{body}
			{showPager && (
				<div className="sk-flush-foot empty:hidden">
					<Pagination {...pagination} />
				</div>
			)}
		</Panel>
	);
}

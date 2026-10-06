/**
 * Las piezas de la barra superior de un producto (2026-10-06): el buscador, la
 * campana, la ayuda y el botón de glifo sobre el que van. Antes cada app tenía
 * su copia de cada una, montada sobre el `Popover` de shadcn y cada una con su
 * alto, su rótulo y su manera de decir «Mark all read». Aquí está la forma; cada
 * app pone sólo lo suyo: qué busca, qué avisa y qué preguntas responde.
 *
 *   TopbarButton       el botón redondo de glifo de la barra
 *   NotificationsMenu  la campana con su contador y el panel de avisos
 *   NotificationGlyph  el icono de un aviso en su cuadro, con su tono
 *   TopbarSearch       el campo de la barra y su panel de resultados
 *   SearchGroup        un grupo de resultados con su rótulo
 *   SearchResult       un resultado: cara o icono, título y dato
 *   HelpMenu           las preguntas de siempre, cada una con su respuesta
 *
 * Los paneles son los menús de vidrio de la cuenta (`menu-panel`), no un
 * `Popover`: los mismos radios, la misma sombra, la misma entrada.
 */
import { forwardRef, useCallback, useId, useRef, useState, type ButtonHTMLAttributes, type ElementType, type ReactNode } from "react";
import { ArrowUpRight, Bell, HelpCircle, Search, Sparkles, X } from "lucide-react";
import { useDismiss } from "../hooks/map";
import { LinkArrow, textLinkClass } from "./console";

// ─── el botón ────────────────────────────────────────────────────────────────

/** El botón redondo de glifo de la barra superior: sin forma hasta que se pasa por encima o se abre. */
export const TopbarButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(function TopbarButton(
	{ className = "", children, ...rest },
	ref,
) {
	return (
		<button
			ref={ref}
			type="button"
			className={`relative inline-flex size-9 shrink-0 items-center justify-center rounded-full text-(--sk-ink-2) transition-colors duration-150 hover:bg-[rgba(14,27,46,0.05)] hover:text-(--sk-ink) aria-expanded:bg-[rgba(14,27,46,0.06)] aria-expanded:text-(--sk-ink) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--sk-accent) ${className}`}
			{...rest}>
			{children}
		</button>
	);
});

/** Un panel de vidrio que cuelga de la barra, con el ciclo de abrir y cerrar de todos. */
function usePanel() {
	const [open, setOpen] = useState(false);
	const box = useRef<HTMLDivElement>(null);
	const trigger = useRef<HTMLButtonElement>(null);
	const close = useCallback(() => setOpen(false), []);
	useDismiss(open, box, trigger, close);
	return { open, setOpen, close, box, trigger };
}

// ─── la campana ──────────────────────────────────────────────────────────────

export type GlyphTone = "default" | "accent" | "warning" | "alert" | "success";

const GLYPH_TONES: Record<GlyphTone, string> = {
	default: "bg-(--sk-ground) text-(--sk-ink-2)",
	accent: "bg-[#e8effc] text-(--sk-accent)",
	warning: "bg-[#fdf1e1] text-[#a35f00]",
	alert: "bg-[#fbeceb] text-[#b3261e]",
	success: "bg-[#e6f4ee] text-[#17795a]",
};

/**
 * El icono de un aviso en su cuadro redondeado. Cada app decide qué icono y qué
 * tono lleva cada tipo (en su `NotificationIcon`); el cuadro es éste en todas.
 */
export function NotificationGlyph({ icon: Icon, tone = "default", size = "sm" }: { icon: ElementType; tone?: GlyphTone; size?: "sm" | "md" }) {
	const box = size === "md" ? "size-10 rounded-[12px]" : "size-8 rounded-[10px]";
	return (
		<span className={`inline-flex shrink-0 items-center justify-center ${box} ${GLYPH_TONES[tone]}`} aria-hidden="true">
			<Icon className={size === "md" ? "size-5" : "size-4"} strokeWidth={1.75} />
		</span>
	);
}

export interface NotificationItem {
	id: string;
	title: string;
	description?: string | null;
	/** Ya formateado: «6h ago». */
	time: string;
	read: boolean;
	/** El `NotificationIcon` de la app (que pinta un `NotificationGlyph`). */
	icon: ReactNode;
	/** Si pulsarlo lleva a algún sitio: entonces el panel se cierra al pulsar. */
	opens: boolean;
}

/**
 * La campana: el contador sobre el glifo (se corta en «99+», por encima el número
 * deja de informar) y el panel con los últimos avisos. Pulsar uno lo marca leído
 * (lo hace `onSelect`) y, si lleva a algún sitio, cierra el panel antes de
 * navegar: si no, el panel se queda abierto sobre la página nueva.
 */
export function NotificationsMenu({
	items,
	unreadCount,
	isLoading = false,
	onSelect,
	onDismiss,
	onMarkAllRead,
	onViewAll,
	emptyText = "A reply, an assignment or a mention will appear here.",
}: {
	items: NotificationItem[];
	unreadCount: number;
	isLoading?: boolean;
	onSelect: (id: string) => void;
	onDismiss: (id: string) => void;
	onMarkAllRead: () => void;
	onViewAll: () => void;
	emptyText?: string;
}) {
	const { open, setOpen, close, box, trigger } = usePanel();
	const count = unreadCount > 99 ? "99+" : String(unreadCount);

	return (
		<div ref={box} className="relative">
			<TopbarButton
				ref={trigger}
				aria-haspopup="dialog"
				aria-expanded={open}
				aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
				onClick={() => setOpen((v) => !v)}>
				<Bell className="size-[1.125rem]" strokeWidth={1.75} aria-hidden="true" />
				{unreadCount > 0 && (
					<span
						className="absolute -right-1 -top-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-(--sk-accent) px-1 text-[0.6875rem] font-semibold leading-none text-white tabular-nums ring-2 ring-(--sk-ground)"
						aria-hidden="true">
						{count}
					</span>
				)}
			</TopbarButton>

			{open && (
				<div role="dialog" aria-label="Notifications" className="menu-panel absolute right-0 top-full z-50 mt-2 flex w-[24rem] max-w-[calc(100vw-2rem)] flex-col p-0!">
					<div className="flex items-center justify-between gap-3 px-4 pb-2.5 pt-3.5">
						<p className="flex items-center gap-2 text-[0.9375rem] font-medium text-(--sk-ink)">
							Notifications
							{unreadCount > 0 && <span className="rounded-full bg-(--sk-mist) px-2 py-0.5 text-[0.75rem] font-medium text-(--sk-ink-2) tabular-nums">{count} new</span>}
						</p>
						{unreadCount > 0 && (
							<button type="button" className={`${textLinkClass} text-[0.8125rem]`} onClick={onMarkAllRead}>
								Mark all read
							</button>
						)}
					</div>

					<div className="max-h-[22rem] overflow-y-auto overscroll-contain border-y border-(--sk-hair) px-1.5 py-1.5">
						{isLoading ? (
							<p className="sk-small px-3 py-6">Loading…</p>
						) : items.length === 0 ? (
							<div className="px-3 py-6">
								<p className="text-[0.9375rem] font-medium text-(--sk-ink)">Nothing new</p>
								<p className="sk-small mt-1">{emptyText}</p>
							</div>
						) : (
							<ul className="flex flex-col gap-0.5">
								{items.map((item) => (
									<li key={item.id} className="group relative flex items-start gap-3 rounded-[12px] px-2.5 py-2.5 transition-colors duration-150 hover:bg-[rgba(14,27,46,0.04)]">
										{/* El acto principal cubre la fila; descartar queda por encima. */}
										<button
											type="button"
											className={`absolute inset-0 rounded-[12px] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--sk-accent) ${item.opens ? "cursor-pointer" : "cursor-default"}`}
											onClick={() => {
												onSelect(item.id);
												if (item.opens) close();
											}}>
											<span className="sr-only">
												{item.read ? "" : "Unread: "}
												{item.title}
											</span>
										</button>
										{item.icon}
										<div className="pointer-events-none min-w-0 flex-1">
											<p className={`flex items-center gap-2 text-[0.875rem] leading-snug ${item.read ? "text-(--sk-ink-2)" : "font-medium text-(--sk-ink)"}`}>
												<span className="truncate">{item.title}</span>
												{!item.read && <span className="size-2 shrink-0 rounded-full bg-(--sk-accent)" aria-hidden="true" />}
											</p>
											{item.description && <p className="mt-0.5 line-clamp-2 text-[0.8125rem] leading-snug text-(--sk-ink-3)">{item.description}</p>}
											<p className="mt-1 text-[0.75rem] text-(--sk-ink-3)">{item.time}</p>
										</div>
										<button
											type="button"
											className="relative z-10 -mr-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-(--sk-ink-3) opacity-60 transition-[opacity,background-color] duration-150 hover:bg-[rgba(14,27,46,0.06)] hover:text-(--sk-ink) focus-visible:opacity-100 group-hover:opacity-100"
											aria-label={`Dismiss: ${item.title}`}
											onClick={() => onDismiss(item.id)}>
											<X className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
										</button>
									</li>
								))}
							</ul>
						)}
					</div>

					<div className="px-4 py-3">
						<button
							type="button"
							className={`${textLinkClass} text-[0.875rem]`}
							onClick={() => {
								close();
								onViewAll();
							}}>
							All notifications
							<LinkArrow />
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

// ─── el buscador ─────────────────────────────────────────────────────────────

/**
 * El campo de la barra superior y su panel. El panel se abre en cuanto hay
 * `minChars` letras y el campo tiene el foco, y se cierra con Escape, con un clic
 * fuera o al elegir un resultado (`children` recibe `close`, que además vacía el
 * campo). `hasResults` decide entre los resultados y el hueco.
 */
export function TopbarSearch({
	value,
	onChange,
	placeholder,
	label,
	minChars = 1,
	hasResults,
	emptyTitle = "Nothing matches",
	emptyText,
	children,
}: {
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	/** Para el lector de pantalla: «Search tickets, teams, agents or contacts». */
	label: string;
	minChars?: number;
	hasResults: boolean;
	emptyTitle?: string;
	/** Qué se busca y qué no: «Secrets are encrypted and cannot be searched.» */
	emptyText?: string;
	children: (close: () => void) => ReactNode;
}) {
	const [focused, setFocused] = useState(false);
	const box = useRef<HTMLDivElement>(null);
	const input = useRef<HTMLInputElement>(null);
	const panelId = useId();
	const open = focused && value.trim().length >= minChars;
	const dismiss = useCallback(() => setFocused(false), []);
	useDismiss(open, box, input, dismiss);

	const close = () => {
		setFocused(false);
		onChange("");
	};

	return (
		<div ref={box} className="relative w-full min-w-0 max-w-md">
			<Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-(--sk-ink-3)" strokeWidth={1.75} aria-hidden="true" />
			<input
				ref={input}
				type="search"
				role="combobox"
				aria-label={label}
				aria-expanded={open}
				aria-controls={panelId}
				aria-autocomplete="list"
				placeholder={placeholder}
				value={value}
				onChange={(e) => {
					onChange(e.target.value);
					setFocused(true);
				}}
				onFocus={() => setFocused(true)}
				className="sk-topsearch"
			/>
			{open && (
				<div id={panelId} className="menu-panel absolute left-0 top-full z-50 mt-2 w-[26rem] max-w-[calc(100vw-2rem)]">
					{hasResults ? (
						<div className="max-h-[24rem] overflow-y-auto overscroll-contain">{children(close)}</div>
					) : (
						<div className="px-3 py-4">
							<p className="text-[0.9375rem] font-medium text-(--sk-ink)">{emptyTitle}</p>
							{emptyText && <p className="sk-small mt-1 max-w-[46ch]">{emptyText}</p>}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

/** Un grupo de resultados con su rótulo pequeño. */
export function SearchGroup({ label, children }: { label: string; children: ReactNode }) {
	return (
		<section className="[&+&]:mt-1 [&+&]:border-t [&+&]:border-(--sk-hair) [&+&]:pt-1">
			<p className="sk-small px-3 pb-1 pt-2 font-medium">{label}</p>
			<ul className="flex flex-col">{children}</ul>
		</section>
	);
}

/** Un resultado: un icono en su cuadro (o una cara), el título y su dato. */
export function SearchResult({
	icon: Icon,
	lead,
	title,
	sub,
	onSelect,
}: {
	icon?: ElementType;
	lead?: ReactNode;
	title: ReactNode;
	sub?: ReactNode;
	onSelect: () => void;
}) {
	return (
		<li>
			<button
				type="button"
				onClick={onSelect}
				className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left transition-colors duration-150 hover:bg-[rgba(14,27,46,0.05)] focus-visible:bg-[rgba(14,27,46,0.05)] focus-visible:outline-none">
				{Icon ? (
					<span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-(--sk-ground) text-(--sk-ink-2)" aria-hidden="true">
						<Icon className="size-4" strokeWidth={1.75} />
					</span>
				) : (
					lead
				)}
				<span className="min-w-0 flex-1">
					<span className="block truncate text-[0.875rem] font-medium text-(--sk-ink)">{title}</span>
					{sub && <span className="block truncate text-[0.8125rem] text-(--sk-ink-3)">{sub}</span>}
				</span>
			</button>
		</li>
	);
}

// ─── la ayuda ────────────────────────────────────────────────────────────────

export interface HelpTopic {
	label: string;
	description: string;
	/** Sale de la app (se abre en otra pestaña): lleva la flecha. */
	external?: boolean;
	onSelect: () => void;
}

/**
 * El menú de ayuda: las preguntas con las que la gente llega de verdad, cada una
 * conectada a la pantalla que la responde, y Nova al pie para lo demás. No es un
 * enlace a un sitio de documentación, porque no lo hay. Los temas son de cada
 * app; la forma es ésta.
 */
export function HelpMenu({ intro, topics, onAskNova }: { intro: string; topics: HelpTopic[]; onAskNova: () => void }) {
	const { open, setOpen, close, box, trigger } = usePanel();
	return (
		<div ref={box} className="relative">
			<TopbarButton ref={trigger} aria-haspopup="menu" aria-expanded={open} aria-label="Help" onClick={() => setOpen((v) => !v)}>
				<HelpCircle className="size-[1.125rem]" strokeWidth={1.75} aria-hidden="true" />
			</TopbarButton>
			{open && (
				<div role="menu" aria-label="Help" className="menu-panel absolute right-0 top-full z-50 mt-2 flex w-[24rem] max-w-[calc(100vw-2rem)] flex-col p-0!">
					<div className="px-4 pb-2.5 pt-3.5">
						<p className="text-[0.9375rem] font-medium text-(--sk-ink)">Help</p>
						<p className="sk-small mt-0.5 leading-snug">{intro}</p>
					</div>
					<div className="max-h-[22rem] overflow-y-auto overscroll-contain border-y border-(--sk-hair) px-1.5 py-1.5">
						{topics.map((topic) => (
							<button
								key={topic.label}
								type="button"
								role="menuitem"
								onClick={() => {
									close();
									topic.onSelect();
								}}
								className="flex! w-full items-start! gap-3 text-left">
								<span className="min-w-0 flex-1">
									<span className="block font-medium leading-snug text-(--sk-ink)">{topic.label}</span>
									<span className="sk-small block leading-snug">{topic.description}</span>
								</span>
								{topic.external && <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-(--sk-ink-3)" strokeWidth={1.75} aria-hidden="true" />}
							</button>
						))}
					</div>
					<div className="p-3">
						<button
							type="button"
							className="ticket ticket--sm w-full gap-2"
							onClick={() => {
								close();
								onAskNova();
							}}>
							<Sparkles className="size-4" strokeWidth={1.75} aria-hidden="true" />
							Ask Nova instead
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

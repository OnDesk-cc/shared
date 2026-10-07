/**
 * Las piezas de los paneles, en el mundo «Clear Sky» (2026-10-04).
 *
 * Los paneles de partners y developers, la consola de ondesk y admin comparten
 * este archivo: es la misma copia en los cuatro proyectos (como el bloque de
 * consolas al final de `sky.css`), y un cambio en uno se copia a los otros
 * tres. La API es la de cuando eran pliegos del mapa de red, así que ninguna
 * vista tuvo que cambiar para mudarse: la sección es ahora una tarjeta blanca,
 * el sello una píldora con su palabra, el billete una píldora, el diálogo de
 * papel un panel con sombra sobre un velo azul marino.
 *
 * Reglas que cumplen todas: el mensaje de un campo tiene su sitio antes de
 * aparecer; un estado se dice con una palabra, nunca sólo con un color; la
 * elevación es sombra, nunca borde y sombra a la vez; el color de una app sólo
 * vive en su baldosa.
 */
import {
	Fragment,
	useEffect,
	useId,
	useRef,
	useState,
	type InputHTMLAttributes,
	type ReactNode,
	type SelectHTMLAttributes,
	type TextareaHTMLAttributes,
} from "react";
import { Check as CheckIcon, ChevronDown, Copy, ExternalLink, MoreHorizontal, X, type LucideIcon } from "lucide-react";
import { useCopy } from "../lib/use-copy";
import { useDismiss } from "../hooks/map";
import { Callout } from "./callout";
import { Tag } from "./tag";

const ERROR_TEXT = "text-[#b3261e]";

// ─── la sección ──────────────────────────────────────────────────────────────

/**
 * Una sección del panel: una tarjeta blanca con su título, el dato vivo a la
 * derecha (en voz pequeña) y su única acción. `scroll-mt` deja sitio a la barra
 * superior y a la tira «en esta página» cuando se llega por un ancla.
 *
 * Con `flush` lo de dentro va de canto a canto (una tabla, una lista de filas):
 * la cabecera conserva su relleno y el CSS `.sk-flush` alinea la primera y la
 * última columna con el título. Sin título, ni cabecera.
 */
export function Section({
	id,
	title,
	meta,
	action,
	flush = false,
	children,
}: {
	id: string;
	title?: ReactNode;
	/** El dato vivo de la sección: «12 attributed · 4 earning». */
	meta?: ReactNode;
	/** El único control que cambia lo que enseña la sección («Change», un enlace a la regla). */
	action?: ReactNode;
	flush?: boolean;
	children: ReactNode;
}) {
	const head = title || meta || action;
	if (flush) {
		return (
			<section id={id} className="sk-card sk-flush scroll-mt-36" aria-labelledby={title ? `${id}-title` : undefined}>
				{head && (
					<div className="sk-flush-head flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
						<div className="min-w-0">
							{title && (
								<h2 id={`${id}-title`} className="sk-h3 max-w-3xl text-[1.125rem] sm:text-[1.25rem]">
									{title}
								</h2>
							)}
							{meta && <p className={`sk-small ${title ? "mt-1" : ""}`}>{meta}</p>}
						</div>
						{action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
					</div>
				)}
				{children}
			</section>
		);
	}
	return (
		<section id={id} className="sk-card scroll-mt-36 p-5 sm:p-7" aria-labelledby={title ? `${id}-title` : undefined}>
			{head && (
				<div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
					<div className="min-w-0">
						{title && (
							<h2 id={`${id}-title`} className="sk-h3 max-w-3xl text-[1.125rem] sm:text-[1.25rem]">
								{title}
							</h2>
						)}
						{meta && <p className={`sk-small ${title ? "mt-1" : ""}`}>{meta}</p>}
					</div>
					{action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
				</div>
			)}
			<div className={head ? "mt-5" : undefined}>{children}</div>
		</section>
	);
}

// ─── la tira «en esta página» ────────────────────────────────────────────────

/**
 * Las secciones de una página larga, pegadas bajo la barra superior: un enlace
 * por sección, con un punto que se llena al pasarla y una raya del acento bajo
 * la que se está leyendo. Gana la sección cuyo borde ha pasado ya bajo la tira
 * y, al final de la página, la última aunque sea corta. En un teléfono la tira
 * se desplaza de lado y sigue a la actual.
 */
export function CallingAt({ stops }: { stops: { id: string; label: string }[] }) {
	const [current, setCurrent] = useState(stops[0]?.id);
	const listRef = useRef<HTMLOListElement>(null);
	const key = stops.map((stop) => stop.id).join("|");

	useEffect(() => {
		let frame = 0;
		const measure = () => {
			frame = 0;
			// la barra superior (4rem) más la tira (unos 3rem) más un margen
			const offset = 150;
			let active = stops[0]?.id;
			for (const stop of stops) {
				const el = document.getElementById(stop.id);
				if (el && el.getBoundingClientRect().top <= offset) active = stop.id;
			}
			const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
			if (atBottom && window.scrollY > 0) active = stops[stops.length - 1]?.id;
			setCurrent(active);
		};
		const onScroll = () => {
			if (!frame) frame = requestAnimationFrame(measure);
		};
		measure();
		window.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", onScroll);
		return () => {
			window.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", onScroll);
			if (frame) cancelAnimationFrame(frame);
		};
		// `key` resume las secciones; `stops` cambia de identidad en cada render.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key]);

	// En una tira más ancha que la pantalla, la sección actual siempre a la vista.
	useEffect(() => {
		const list = listRef.current;
		const item = list?.querySelector<HTMLElement>(`[data-stop="${current}"]`);
		if (!list || !item) return;
		const outside = item.offsetLeft < list.scrollLeft || item.offsetLeft + item.offsetWidth > list.scrollLeft + list.clientWidth;
		if (!outside) return;
		const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		list.scrollTo({ left: Math.max(0, item.offsetLeft - 8), behavior: still ? "auto" : "smooth" });
	}, [current]);

	const currentIndex = stops.findIndex((stop) => stop.id === current);

	return (
		<nav className="sk-onpage" aria-label="On this page">
			<ol ref={listRef}>
				{stops.map((stop, i) => (
					<li key={stop.id} data-stop={stop.id} className={i < currentIndex ? "is-done" : undefined}>
						<a href={`#${stop.id}`} aria-current={current === stop.id ? "location" : undefined}>
							<span className="sk-onpage-dot" aria-hidden="true" />
							{stop.label}
						</a>
					</li>
				))}
			</ol>
		</nav>
	);
}

// ─── la cabecera del panel ───────────────────────────────────────────────────

/**
 * El bloque de identidad de un panel: la cara (logo o iniciales), el título,
 * sus estados, una línea de contexto y las acciones. Con `pinActions` las
 * acciones no bajan de fila en un teléfono: se quedan arriba a la derecha (es
 * para un solo botón redondo, el menú ⋯).
 */
export function Masthead({
	mark,
	title,
	stamps,
	sub,
	actions,
	pinActions = false,
	children,
}: {
	mark: ReactNode;
	title: ReactNode;
	stamps?: ReactNode;
	/** Una línea pequeña bajo el título: el slug, el client ID. */
	sub?: ReactNode;
	actions?: ReactNode;
	pinActions?: boolean;
	/** La frase de contexto propia de la página. */
	children?: ReactNode;
}) {
	return (
		<header className="flex flex-col gap-5">
			<div className={`flex items-start justify-between gap-4 ${pinActions ? "relative" : "flex-wrap"}`}>
				<div className={`flex min-w-0 items-center gap-4 ${pinActions ? "flex-1" : ""}`}>
					{mark}
					<div className="min-w-0 flex-1">
						<div className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${pinActions ? "pr-12" : ""}`}>
							{title}
							{stamps}
						</div>
						{/* `overflow-wrap: anywhere` y no `break-all`: parte un client ID que no
						    cabe, pero no parte «registered» por la mitad. */}
						{sub && <p className="sk-small mt-1 [overflow-wrap:anywhere]">{sub}</p>}
					</div>
				</div>
				{actions && <div className={`flex flex-wrap items-center gap-2 ${pinActions ? "absolute right-0 top-0" : ""}`}>{actions}</div>}
			</div>
			{children}
		</header>
	);
}

/** El título de un panel cuando no es un selector. `min-w-0`: se acorta con puntos suspensivos antes que montarse sobre un botón. */
export function PlateTitle({ children }: { children: ReactNode }) {
	return (
		<h1 className="sk-h2 min-w-0 max-w-full text-[1.625rem] md:text-[1.875rem]">
			{/* En un teléfono el nombre parte línea; desde 640px se acorta si hace falta. */}
			<span className="block min-w-0 sm:truncate">{children}</span>
		</h1>
	);
}

/**
 * El nombre del workspace, que es también el selector: el workspace es el tema
 * de todo lo de debajo, no un filtro. Con uno solo es un título quieto. El menú
 * marca el actual, deja a quien llama poner un estado por fila y acaba en la
 * consola de ondesk (`manageHref`) o en la fila propia de quien llama (`manage`).
 */
export function WorkspacePlate<T extends { id: string; name: string }>({
	current,
	all,
	onChoose,
	badge,
	manageHref,
	manage,
}: {
	current: T;
	all: T[];
	onChoose: (id: string) => void;
	badge?: (workspace: T) => ReactNode;
	manageHref?: string;
	/** La última fila del menú, en lugar del enlace a la consola: un `role="menuitem"`. */
	manage?: ReactNode;
}) {
	const [open, setOpen] = useState(false);
	const box = useRef<HTMLDivElement>(null);
	const trigger = useRef<HTMLButtonElement>(null);
	useDismiss(open, box, trigger, () => setOpen(false));

	if (all.length <= 1) return <PlateTitle>{current.name}</PlateTitle>;

	return (
		<div ref={box} className="relative min-w-0 max-w-full">
			<h1 className="sk-h2 text-[1.625rem] md:text-[1.875rem]">
				<button
					ref={trigger}
					type="button"
					className="-ml-2 inline-flex items-center gap-2 rounded-[12px] px-2 py-0.5 text-left transition-colors hover:bg-[rgba(14,27,46,0.05)]"
					aria-haspopup="menu"
					aria-expanded={open}
					aria-label={`Switch workspace, currently ${current.name}`}
					onClick={() => setOpen((v) => !v)}>
					<span className="max-w-[58vw] truncate sm:max-w-[34rem]">{current.name}</span>
					<ChevronDown
						className={`size-5 shrink-0 text-(--sk-ink-3) transition-transform duration-200 ${open ? "rotate-180" : ""}`}
						strokeWidth={1.75}
						aria-hidden="true"
					/>
				</button>
			</h1>
			{open && (
				<div role="menu" aria-label="Workspaces" className="menu-panel left-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)]">
					<p className="sk-small px-3 pb-1 pt-2 font-medium">Workspaces</p>
					{all.map((workspace) => (
						<button
							key={workspace.id}
							type="button"
							role="menuitem"
							aria-current={workspace.id === current.id ? "true" : undefined}
							onClick={() => {
								onChoose(workspace.id);
								setOpen(false);
							}}>
							<Monogram name={workspace.name} size="xs" />
							<span className="min-w-0 flex-1 truncate">{workspace.name}</span>
							{badge?.(workspace)}
							{workspace.id === current.id && <CheckIcon className="size-4 shrink-0 text-(--sk-accent)" strokeWidth={2} aria-hidden="true" />}
						</button>
					))}
					{(manage || manageHref) && <div className="mx-2 my-1 border-t border-(--sk-hair)" />}
					{manage ??
						(manageHref && (
							<a role="menuitem" href={manageHref}>
								Manage in the console
								<ExternalLink className="ml-auto size-3.5 text-(--sk-ink-3)" strokeWidth={1.75} aria-hidden="true" />
							</a>
						))}
				</div>
			)}
		</div>
	);
}

/** La cara de un workspace o de una aplicación: su logo, o sus iniciales en un cuadrado redondeado de niebla. */
export function Monogram({ name, logoUrl, size = "md" }: { name: string; logoUrl?: string | null; size?: "xs" | "sm" | "md" | "lg" }) {
	const box =
		size === "lg"
			? "size-14 rounded-[16px] text-[1rem]"
			: size === "sm"
				? "size-9 rounded-[10px] text-[0.75rem]"
				: size === "xs"
					? "size-6 rounded-[7px] text-[0.625rem]"
					: "size-11 rounded-[12px] text-[0.8125rem]";
	if (logoUrl) {
		return <img src={logoUrl} alt="" className={`${box} shrink-0 object-cover shadow-(--sk-shadow-1)`} />;
	}
	return (
		<span aria-hidden="true" className={`${box} inline-flex shrink-0 items-center justify-center bg-(--sk-haze) font-semibold text-(--sk-ink-2)`}>
			{markOf(name)}
		</span>
	);
}

/**
 * Dos caracteres por nombre: las iniciales si tiene dos palabras; si no, su
 * inicio. Sólo cuentan las palabras con letras o cifras — «Harbour & Pine» es
 * «HP», no «H&».
 */
function markOf(name: string): string {
	const words = name
		.trim()
		.split(/\s+/)
		.filter((word) => /[\p{L}\p{N}]/u.test(word));
	if (words.length === 0) return "··";
	if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
	return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Un valor largo (una URL, un URI de vuelta) que sólo se parte por donde se
 * lee: después de una `/` que no va seguida de otra, y después de `?`, `&` y
 * `=`. El valor copiado sigue siendo el texto entero, sin los `<wbr>`.
 */
export function Breakable({ text }: { text: string }) {
	const parts = text.split(/(?<=\/)(?!\/)|(?<=[?&=])/);
	return (
		<>
			{parts.map((part, i) => (
				<Fragment key={i}>
					{i > 0 && <wbr />}
					{part}
				</Fragment>
			))}
		</>
	);
}

/**
 * Un estado con su palabra: tinta para lo que está en marcha, niebla para lo
 * demás, rojo apagado para lo que se paró. Desde el 2026-10-06 es un `Tag`.
 */
export function Stamp({ tone = "outline", children }: { tone?: "solid" | "outline" | "alert"; children: ReactNode }) {
	return <Tag tone={tone === "solid" ? "ink" : tone === "alert" ? "danger" : "neutral"}>{children}</Tag>;
}

// ─── campos ──────────────────────────────────────────────────────────────────

/** Rótulo, control y la línea reservada debajo: el error, o la ayuda, o nada. */
export function FieldShell({
	id,
	label,
	hint,
	error,
	counter,
	reserve = true,
	children,
}: {
	id: string;
	label: ReactNode;
	hint?: ReactNode;
	error?: string | null;
	counter?: ReactNode;
	/** La línea de aviso guarda su sitio aunque esté vacía; `false` sólo para un campo que nunca da aviso. */
	reserve?: boolean;
	children: ReactNode;
}) {
	const message = error ?? hint ?? "";
	return (
		<div className="min-w-0">
			<div className="mb-1.5 flex items-baseline justify-between gap-3">
				<label htmlFor={id} className="sk-label mb-0!">
					{label}
				</label>
				{counter}
			</div>
			{children}
			{(reserve || message) && (
				<p id={`${id}-msg`} aria-live="polite" className={`sk-help mb-2 min-h-5 leading-snug ${error ? `${ERROR_TEXT}! font-medium` : ""}`}>
					{message}
				</p>
			)}
		</div>
	);
}

/**
 * Un contador que sólo aparece cuando merece saberse: a los tres cuartos del
 * techo, y en rojo en el techo. En 0/80 desde el principio se lee como algo que
 * hay que llenar.
 */
export function CharCount({ value, max }: { value: string; max: number }) {
	if (value.length < max * 0.75) return null;
	return <span className={`sk-num text-[0.8125rem] ${value.length >= max ? `font-medium ${ERROR_TEXT}` : "text-(--sk-ink-3)"}`}>{value.length}/{max}</span>;
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "value" | "onChange">;

/** Un campo de una línea. `cond` lo pone en cifras tabulares, para identificadores. */
export function TextField({
	id,
	label,
	value,
	onChange,
	max,
	hint,
	error,
	cond = false,
	className = "",
	...input
}: InputProps & {
	id: string;
	label: ReactNode;
	value: string;
	onChange: (value: string) => void;
	max?: number;
	hint?: ReactNode;
	error?: string | null;
	cond?: boolean;
}) {
	return (
		// Sin contador en un campo de dos letras: «2/2» en rojo en un código de
		// país lleno es una alarma por hacer bien el campo.
		<FieldShell id={id} label={label} hint={hint} error={error} counter={max && max >= 20 ? <CharCount value={value} max={max} /> : undefined}>
			<input
				id={id}
				value={value}
				maxLength={max}
				aria-invalid={error ? true : undefined}
				aria-describedby={`${id}-msg`}
				onChange={(e) => onChange(e.target.value)}
				className={`field ${cond ? "sk-num" : ""} ${className}`}
				{...input}
			/>
		</FieldShell>
	);
}

/**
 * La variante de varias líneas. Sin `hint` no reserva línea de aviso: un texto
 * libre con techo de caracteres no tiene error que dar (el contador ya lo dice).
 */
export function TextArea({
	id,
	label,
	value,
	onChange,
	max,
	hint,
	rows = 4,
	...rest
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "value" | "onChange"> & {
	id: string;
	label: ReactNode;
	value: string;
	onChange: (value: string) => void;
	max: number;
	hint?: ReactNode;
}) {
	return (
		<FieldShell id={id} label={label} hint={hint} reserve={hint !== undefined} counter={<CharCount value={value} max={max} />}>
			<textarea
				id={id}
				value={value}
				rows={rows}
				maxLength={max}
				aria-describedby={hint !== undefined ? `${id}-msg` : undefined}
				onChange={(e) => onChange(e.target.value)}
				className="field"
				{...rest}
			/>
		</FieldShell>
	);
}

/** Un desplegable nativo: el control que el sistema ya sabe manejar, con la flecha del mundo. */
export function SelectField({
	id,
	label,
	hint,
	value,
	onChange,
	options,
	...rest
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "value" | "onChange"> & {
	id: string;
	label: ReactNode;
	hint?: ReactNode;
	value: string;
	onChange: (value: string) => void;
	options: { id: string; label: string }[];
}) {
	return (
		<FieldShell id={id} label={label} hint={hint}>
			<select id={id} value={value} aria-describedby={`${id}-msg`} onChange={(e) => onChange(e.target.value)} className="field sk-select" {...rest}>
				{options.map((option) => (
					<option key={option.id} value={option.id}>
						{option.label}
					</option>
				))}
			</select>
		</FieldShell>
	);
}

/** La casilla: un checkbox nativo escondido bajo un cuadrado redondeado que se llena del acento. */
export function Check({
	id,
	checked,
	onChange,
	disabled = false,
	children,
}: {
	id?: string;
	checked: boolean;
	onChange: (next: boolean) => void;
	/** Atenuada y sin cursor de mano: el motivo lo dice el texto de al lado. */
	disabled?: boolean;
	children: ReactNode;
}) {
	const fallback = useId();
	const inputId = id ?? fallback;
	return (
		<label htmlFor={inputId} className={`inline-flex select-none items-start gap-3 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
			<span className="relative mt-px shrink-0">
				<input
					id={inputId}
					type="checkbox"
					checked={checked}
					disabled={disabled}
					onChange={(e) => onChange(e.target.checked)}
					className="peer sr-only"
				/>
				<span
					aria-hidden="true"
					className="flex size-5 items-center justify-center rounded-[6px] bg-(--sk-surface) shadow-[inset_0_0_0_1px_var(--sk-hair-2)] transition-[background-color,box-shadow] duration-150 peer-checked:bg-(--sk-accent) peer-checked:shadow-none peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--sk-accent)">
					{checked && <CheckIcon className="size-3.5 text-white" strokeWidth={3} />}
				</span>
			</span>
			<span className="min-w-0 text-[0.9375rem] leading-snug text-(--sk-ink-2)">{children}</span>
		</label>
	);
}

// ─── avisos ──────────────────────────────────────────────────────────────────

/** El error con el que volvió el servidor, con sus propias palabras: un `Callout` en rojo. */
export function Alert({ error, children }: { error?: Error | null; children?: ReactNode }) {
	const text = children ?? error?.message;
	if (!text) return null;
	return (
		<Callout tone="danger" role="alert">
			{text}
		</Callout>
	);
}

/** Una nota: la letra pequeña que acompaña a una sección, un `Callout` sin glifo. */
export function Note({ title, children }: { title?: string; children: ReactNode }) {
	return (
		<Callout tone="info" icon={false} title={title}>
			{children}
		</Callout>
	);
}

/**
 * Una caja de estado: un aviso que tiene que leerse antes de lo demás (la
 * solicitud en revisión, la suspensión, la cuenta de Stripe). El estado va en
 * su píldora con una palabra; el fondo rojo apagado sólo para lo que se paró.
 */
export function StatusBox({
	tone = "ink",
	stamp,
	title,
	children,
	footer,
}: {
	tone?: "ink" | "alert";
	stamp?: ReactNode;
	title: ReactNode;
	children?: ReactNode;
	footer?: ReactNode;
}) {
	return (
		<div className={`rounded-[16px] p-4 md:p-5 ${tone === "alert" ? "bg-[#fbeceb]" : "bg-(--sk-ground)"}`}>
			<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
				{stamp}
				<p className={`font-medium leading-snug ${tone === "alert" ? "text-[#8f2219]" : "text-(--sk-ink)"}`}>{title}</p>
			</div>
			{children && <div className="mt-2 flex max-w-[72ch] flex-col gap-2 text-[0.9375rem] leading-relaxed text-(--sk-ink-2)">{children}</div>}
			{footer && <div className="mt-4 flex flex-wrap items-center gap-3">{footer}</div>}
		</div>
	);
}

// ─── acciones ────────────────────────────────────────────────────────────────

/**
 * El pie de cada formulario: el aviso a la izquierda (con su sitio reservado y
 * siempre una palabra: «No changes.», «Unsaved changes.», «Saved.») y el botón
 * de guardar, apagado hasta que hay algo que guardar.
 */
export function SaveRow({
	dirty,
	pending,
	saved,
	blocked = false,
	label = "Save",
	extra,
}: {
	dirty: boolean;
	pending: boolean;
	saved?: boolean;
	/** Hay cambios pero un campo no pasaría: el botón sigue cerrado y el aviso lo dice. */
	blocked?: boolean;
	label?: string;
	/** Otro botón a la izquierda del de guardar: «Cancel», «Revert». */
	extra?: ReactNode;
}) {
	const status = pending
		? "Saving…"
		: saved && !dirty
			? "Saved."
			: dirty && blocked
				? "Fix the field above to save."
				: dirty
					? "Unsaved changes."
					: "No changes.";
	const ready = dirty && !blocked;
	return (
		<div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t border-(--sk-hair) pt-4">
			<p className="sk-small mr-auto min-h-5" aria-live="polite">
				{status}
			</p>
			{extra}
			<button type="submit" className={`ticket ticket--sm ${ready ? "ticket--solid" : ""}`} disabled={!ready || pending} aria-busy={pending || undefined}>
				{pending ? "Saving…" : label}
			</button>
		</div>
	);
}

/**
 * Copiar un valor. Con `text` es una píldora con palabra; sin él, un botón
 * redondo con el glifo junto a un valor que ya tiene rótulo. Un portapapeles
 * rechazado cuesta la comodidad, no el valor: sigue impreso y seleccionable.
 */
export function CopyTicket({ value, label, text }: { value: string; label: string; text?: string }) {
	const [copied, copy] = useCopy();
	return (
		<>
			<button
				type="button"
				onClick={() => copy(value)}
				aria-label={text ? undefined : label}
				title={text ? undefined : label}
				className={text ? "ticket ticket--sm shrink-0" : "ticket ticket--glyph shrink-0"}>
				{copied ? <CheckIcon className="size-4" strokeWidth={2} aria-hidden="true" /> : <Copy className="size-4" strokeWidth={1.75} aria-hidden="true" />}
				{text && (copied ? "Copied" : text)}
			</button>
			<span className="sr-only" aria-live="polite">
				{copied ? "Copied" : ""}
			</span>
		</>
	);
}

export interface MenuItem {
	label: string;
	icon?: LucideIcon;
	onSelect: () => void;
	disabled?: boolean;
	/** Un acto irreversible: va en el rojo de error. */
	danger?: boolean;
}

/** El menú de acciones: un botón redondo que abre un menú de vidrio con grupos. */
export function ActionMenu({
	label,
	groups,
	align = "end",
}: {
	label: string;
	groups: { title?: string; items: MenuItem[] }[];
	align?: "start" | "end";
}) {
	const [open, setOpen] = useState(false);
	const box = useRef<HTMLDivElement>(null);
	const trigger = useRef<HTMLButtonElement>(null);
	useDismiss(open, box, trigger, () => setOpen(false));

	return (
		<div ref={box} className="relative">
			<button
				ref={trigger}
				type="button"
				className="ticket ticket--glyph"
				aria-label={label}
				aria-haspopup="menu"
				aria-expanded={open}
				onClick={() => setOpen((v) => !v)}>
				<MoreHorizontal className="size-4" strokeWidth={1.75} aria-hidden="true" />
			</button>
			{open && (
				<div role="menu" aria-label={label} className={`menu-panel top-full mt-2 ${align === "end" ? "right-0" : "left-0"}`}>
					{groups.map((group, i) => (
						<div key={group.title ?? i} className={i > 0 ? "mt-1 border-t border-(--sk-hair) pt-1" : undefined}>
							{group.title && <p className="sk-small px-3 pb-1 pt-2 font-medium">{group.title}</p>}
							{group.items.map((item) => (
								<button
									key={item.label}
									type="button"
									role="menuitem"
									aria-disabled={item.disabled || undefined}
									className={item.danger ? "is-danger" : undefined}
									onClick={() => {
										if (item.disabled) return;
										setOpen(false);
										item.onSelect();
									}}>
									{item.icon && <item.icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />}
									{item.label}
								</button>
							))}
						</div>
					))}
				</div>
			)}
		</div>
	);
}

/**
 * El diálogo, sobre el `<dialog>` nativo: el sistema ya atrapa el foco, lo
 * devuelve al cerrar y sabe de Escape. Se reserva para los actos que no se
 * deshacen (rotar un secreto, borrar) y para el secreto que se enseña una sola
 * vez, que se abre con `dismissable={false}`: ni Escape ni un clic fuera lo
 * cierran, sólo la confirmación de dentro.
 */
export function SheetDialog({
	open,
	onClose,
	title,
	description,
	dismissable = true,
	children,
	footer,
}: {
	open: boolean;
	onClose: () => void;
	title: ReactNode;
	description?: ReactNode;
	dismissable?: boolean;
	children?: ReactNode;
	footer?: ReactNode;
}) {
	const ref = useRef<HTMLDialogElement>(null);
	const titleId = useId();
	const descId = useId();

	useEffect(() => {
		const dialog = ref.current;
		if (!dialog) return;
		if (open && !dialog.open) {
			dialog.showModal();
			// `showModal` enfoca lo primero enfocable, que es el aspa de cerrar; un
			// diálogo que confirma un acto lleva el foco a «Cancel» en su lugar.
			dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
		}
		if (!open && dialog.open) dialog.close();
	}, [open]);

	return (
		<dialog
			ref={ref}
			className="sheet-dialog"
			aria-labelledby={titleId}
			aria-describedby={description ? descId : undefined}
			onCancel={(e) => {
				e.preventDefault();
				if (dismissable) onClose();
			}}
			onClick={(e) => {
				if (dismissable && e.target === e.currentTarget) onClose();
			}}>
			<div className="flex shrink-0 items-start justify-between gap-4 px-6 pb-2 pt-6">
				<div className="min-w-0">
					<h2 id={titleId} className="sk-h3 text-[1.25rem]">
						{title}
					</h2>
					{description && (
						<p id={descId} className="sk-body mt-1.5 text-[0.9375rem] leading-snug">
							{description}
						</p>
					)}
				</div>
				{dismissable && (
					<button type="button" className="ticket ticket--glyph shrink-0" aria-label="Close" onClick={onClose}>
						<X className="size-4" strokeWidth={1.75} aria-hidden="true" />
					</button>
				)}
			</div>
			{children && <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{open && children}</div>}
			{footer && open && <div className="shrink-0 border-t border-(--sk-hair) px-6 py-4">{footer}</div>}
		</dialog>
	);
}

/**
 * El pie de una confirmación: el error del servidor si lo hubo, «Cancel»
 * primero y el acto después. El foco empieza en «Cancel», el lado que no hace
 * nada, así que un Intro de más no borra ni rota nada. `danger` pinta el acto
 * en el rojo de error.
 */
export function ConfirmRow({
	danger = false,
	error,
	pending,
	label,
	pendingLabel,
	onCancel,
	onConfirm,
	canConfirm = true,
}: {
	danger?: boolean;
	error: Error | null;
	pending: boolean;
	label: string;
	pendingLabel: string;
	onCancel: () => void;
	onConfirm: () => void;
	/** Falso mientras falte algo para poder confirmar (el slug tecleado, una casilla). */
	canConfirm?: boolean;
}) {
	return (
		<div className="flex flex-col gap-3">
			{error && <Alert error={error} />}
			<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
				<button type="button" className="ticket ticket--sm" data-autofocus disabled={pending} onClick={onCancel}>
					Cancel
				</button>
				<button
					type="button"
					className={`ticket ticket--sm ${danger ? "ticket--danger" : "ticket--solid"}`}
					disabled={pending || !canConfirm}
					aria-busy={pending || undefined}
					onClick={onConfirm}>
					{pending ? pendingLabel : label}
				</button>
			</div>
		</div>
	);
}

// ─── listas y huecos ─────────────────────────────────────────────────────────

/**
 * Pasos en orden sobre un riel vertical: un filete fino con un punto por paso.
 * Para lo que se hace en una secuencia (qué hacer si se filtra un secreto, qué
 * pasa después de compartir el enlace), donde el orden es el dato.
 */
export function Spine({ steps }: { steps: { title: string; text: ReactNode }[] }) {
	return (
		<ol className="relative max-w-2xl space-y-4">
			<span aria-hidden="true" className="absolute bottom-3 left-[9.5px] top-3 w-px bg-(--sk-hair-2)" />
			{steps.map((step) => (
				<li key={step.title} className="relative flex gap-3.5">
					<span aria-hidden="true" className="relative mt-0.5 size-5 shrink-0 rounded-full bg-(--sk-surface) ring-1 ring-(--sk-hair-2)" />
					<div className="min-w-0">
						<p className="font-medium leading-tight text-(--sk-ink)">{step.title}</p>
						<p className="mt-1 text-[0.9375rem] leading-snug text-(--sk-ink-2)">{step.text}</p>
					</div>
				</li>
			))}
		</ol>
	);
}

/** La forma de lo que viene mientras llega: bloques de niebla que respiran despacio, sin girar nada. */
export function Skeleton({ rows = 4 }: { rows?: number }) {
	return (
		<div aria-busy="true" aria-label="Loading" className="flex flex-col gap-3">
			<div className="skeleton h-9 w-1/2" />
			{Array.from({ length: rows }, (_, i) => (
				<div key={i} className="skeleton h-6" style={{ width: `${92 - i * 9}%` }} />
			))}
		</div>
	);
}

/**
 * Las piezas de los paneles, en el vocabulario del mapa.
 *
 * Los paneles de partners y developers, la consola de ondesk y admin son
 * pliegos: una sola hoja que se lee de arriba abajo, cada recado una parada en
 * el eje de la página, cada valor editable donde está impreso. Este archivo es
 * la misma copia en los cuatro proyectos (como el bloque de consola de
 * `site.css`): un cambio en uno se copia a los otros tres. El sello de estado,
 * la tira «calling at», la parada de consola, los campos con el trazo del
 * mundo, la fila de guardar con su aviso reservado, el billete de copiar, el
 * diálogo de papel, el menú de acciones y el selector de workspace.
 *
 * Reglas que cumplen todas: el mensaje de un campo tiene su sitio antes de
 * aparecer; un estado se imprime con una palabra, nunca sólo con un color;
 * nada tiene radio ni sombra; lo único que se mueve solo es la tira.
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

// ─── la parada de consola ────────────────────────────────────────────────────

/**
 * Una parada del pliego: el filete grueso con la marca que cruza el eje, la
 * información de estación a la derecha (el dato vivo de la sección) y el
 * título con su única acción. Más baja que la `Stop` de las páginas públicas:
 * en un panel se trabaja, y un titular de 3rem en cada sección es ruido.
 */
export function Section({
	id,
	title,
	meta,
	action,
	children,
}: {
	id: string;
	title: ReactNode;
	/** El dato vivo de la sección, en la meta de estación: «12 attributed · 4 earning». */
	meta?: ReactNode;
	/** El único control que cambia lo que enseña la sección («Change», un enlace a la regla). */
	action?: ReactNode;
	children: ReactNode;
}) {
	return (
		<section id={id} className="rule scroll-mt-40 pt-4" aria-labelledby={`${id}-title`}>
			<div className="flex min-h-7 items-center justify-between gap-6">
				<span className="stop-mark" aria-hidden="true" />
				{meta && <span className="t-tab text-right text-(--ink-2)">{meta}</span>}
			</div>
			<div className="mt-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
				<h2 id={`${id}-title`} className="t-h2 max-w-3xl text-[1.5rem] md:text-[1.625rem]">
					{title}
				</h2>
				{action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
			</div>
			<div className="mt-6">{children}</div>
		</section>
	);
}

// ─── la tira «calling at» ────────────────────────────────────────────────────

/**
 * La línea de paradas del pliego, pegada bajo la cabecera: un anillo y un
 * rótulo por parada. Los anillos se van llenando a medida que se baja por la
 * hoja, como las paradas ya servidas de una línea, y la parada que se está
 * leyendo lleva además la barra de tinta de la franja de rutas debajo.
 * Gana la parada cuyo filete ha pasado ya bajo la tira — la misma regla que
 * el riel de la documentación — y al final de la página, la última aunque sea
 * corta. En un teléfono la tira se desplaza de lado y sigue a la parada actual.
 */
export function CallingAt({ stops }: { stops: { id: string; label: string }[] }) {
	const [current, setCurrent] = useState(stops[0]?.id);
	const listRef = useRef<HTMLOListElement>(null);
	const key = stops.map((stop) => stop.id).join("|");

	useEffect(() => {
		let frame = 0;
		const measure = () => {
			frame = 0;
			// la cabecera (5.5rem) más la tira (unos 3rem) más un margen
			const offset = 170;
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
		// `key` resume las paradas; `stops` cambia de identidad en cada render.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key]);

	// En una tira más ancha que la pantalla, la parada actual siempre a la vista.
	useEffect(() => {
		const list = listRef.current;
		const item = list?.querySelector<HTMLElement>(`[data-stop="${current}"]`);
		if (!list || !item) return;
		const outside = item.offsetLeft < list.scrollLeft || item.offsetLeft + item.offsetWidth > list.scrollLeft + list.clientWidth;
		if (!outside) return;
		const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		// el margen interior de la tira es el del canal de la página
		const gutter = parseFloat(getComputedStyle(list).paddingLeft) || 0;
		list.scrollTo({ left: Math.max(0, item.offsetLeft - gutter), behavior: still ? "auto" : "smooth" });
	}, [current]);

	const currentIndex = stops.findIndex((stop) => stop.id === current);

	return (
		<nav className="calling-at" aria-label="On this page">
			<ol ref={listRef} className="line-stops relative">
				<li className="t-tab hidden shrink-0 pr-4 text-(--ink-2) sm:block" aria-hidden="true">
					Calling at
				</li>
				{stops.map((stop, i) => (
					<li
						key={stop.id}
						data-stop={stop.id}
						className={`flex shrink-0 items-center ${i < currentIndex ? "is-done" : ""}`}>
						{i > 0 && <span className="seg" aria-hidden="true" />}
						<a href={`#${stop.id}`} aria-current={current === stop.id ? "location" : undefined}>
							<span className="ring" aria-hidden="true" />
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
 * El bloque de identidad de un panel: marca, título en placa, sellos, línea de
 * contexto. Con `pinActions` las acciones no bajan de fila en un teléfono: se
 * quedan arriba a la derecha y el bloque de identidad cede el ancho. Es para
 * un solo billete cuadrado (el menú ⋯); dos billetes con palabra sí bajan.
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
	/** Una línea condensada bajo el título: el slug, el client ID. */
	sub?: ReactNode;
	actions?: ReactNode;
	pinActions?: boolean;
	/** La frase de contexto propia de la página. */
	children?: ReactNode;
}) {
	return (
		<header className="flex flex-col gap-4">
			{/* Con `pinActions` el billete va fijo arriba a la derecha y sólo la fila
			    de la placa le deja sitio (el `pr-12`): la línea del client ID, debajo,
			    corre a todo lo ancho y no se parte por el billete. */}
			<div className={`flex items-start justify-between gap-4 ${pinActions ? "relative" : "flex-wrap"}`}>
				<div className={`flex min-w-0 items-start gap-4 ${pinActions ? "flex-1" : ""}`}>
					{mark}
					<div className="min-w-0 flex-1">
						<div className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${pinActions ? "pr-12" : ""}`}>
							{title}
							{stamps}
						</div>
						{/* `overflow-wrap: anywhere` y no `break-all`: parte un client ID que no
						    cabe, pero no parte «registered» por la mitad. */}
						{sub && <p className="t-cond mt-2 text-[0.95rem] [overflow-wrap:anywhere] text-(--ink-2)">{sub}</p>}
					</div>
				</div>
				{actions && (
					<div className={`flex flex-wrap items-center gap-2 ${pinActions ? "absolute top-0 right-0" : ""}`}>{actions}</div>
				)}
			</div>
			{children}
		</header>
	);
}

/**
 * El título de un panel en su placa, cuando no es un selector. `min-w-0`: en
 * una fila que deja sitio a un billete, la placa se acorta con puntos
 * suspensivos en vez de montarse sobre él.
 */
export function PlateTitle({ children }: { children: ReactNode }) {
	return (
		<h1 className="t-display min-w-0 max-w-full text-[1.75rem] leading-none md:text-[2rem]">
			<span className="plate-block">
				{/* En un teléfono el nombre parte línea dentro de la placa; desde 640px,
				    donde cabe, se acorta con puntos suspensivos si hace falta. */}
				<span className="min-w-0 sm:truncate">{children}</span>
			</span>
		</h1>
	);
}

/**
 * El nombre del workspace en su placa, que es también el selector: el
 * workspace es el tema de todo lo que hay debajo, no un filtro sobre ello. Con
 * un solo workspace es una placa quieta. El panel que abre marca el actual con
 * el anillo relleno, deja a quien llama poner un sello por fila (PARTNER) y
 * acaba en la consola de ondesk, donde se administran (`manageHref`); la propia
 * consola de ondesk pone ahí su fila («New workspace») con `manage`.
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
	/** La última fila del panel, en lugar del enlace a la consola: un `role="menuitem"`. */
	manage?: ReactNode;
}) {
	const [open, setOpen] = useState(false);
	const box = useRef<HTMLDivElement>(null);
	const trigger = useRef<HTMLButtonElement>(null);
	useDismiss(open, box, trigger, () => setOpen(false));

	if (all.length <= 1) return <PlateTitle>{current.name}</PlateTitle>;

	return (
		<div ref={box} className="relative min-w-0">
			<h1 className="t-display text-[1.75rem] leading-none md:text-[2rem]">
				<button
					ref={trigger}
					type="button"
					className="plate-block"
					aria-haspopup="menu"
					aria-expanded={open}
					aria-label={`Switch workspace, currently ${current.name}`}
					onClick={() => setOpen((v) => !v)}>
					<span className="truncate">{current.name}</span>
					<ChevronDown
						className={`size-5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
						aria-hidden="true"
					/>
				</button>
			</h1>
			{open && (
				<div role="menu" aria-label="Workspaces" className="menu-panel top-full left-0 mt-2 w-80 max-w-[calc(100vw-2rem)]">
					<p className="t-tab px-4 pt-3 pb-1.5 text-(--ink-2)">Workspaces</p>
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
							<span className={`ring ${workspace.id === current.id ? "ring--filled" : ""}`} aria-hidden="true" />
							<span className="min-w-0 flex-1 truncate">{workspace.name}</span>
							{badge?.(workspace)}
						</button>
					))}
					{(manage || manageHref) && <div className="rule-thin" />}
					{manage ??
						(manageHref && (
							<a role="menuitem" href={manageHref}>
								Manage in the console
								<ExternalLink className="ml-auto size-3.5 text-(--ink-2)" aria-hidden="true" />
							</a>
						))}
				</div>
			)}
		</div>
	);
}

/** La cara de un workspace o de una aplicación: su logo, o sus iniciales en un cuadrado con el trazo del mundo. */
export function Monogram({ name, logoUrl, size = "md" }: { name: string; logoUrl?: string | null; size?: "sm" | "md" | "lg" }) {
	const box = size === "lg" ? "size-14 text-[1.05rem]" : size === "sm" ? "size-9 text-[0.8rem]" : "size-11 text-[0.9rem]";
	if (logoUrl) {
		return <img src={logoUrl} alt="" className={`${box} shrink-0 border-[length:var(--stroke)] border-(--ink) object-cover`} />;
	}
	return (
		<span
			aria-hidden="true"
			className={`${box} t-cond inline-flex shrink-0 items-center justify-center border-[length:var(--stroke)] border-(--ink) bg-(--paper) font-bold`}>
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
 * `=`. El `overflow-wrap: anywhere` de la celda queda para un tramo que ni así
 * cabe; el valor copiado sigue siendo el texto entero, sin los `<wbr>`.
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

/** Un estado impreso: sólido para lo que está en marcha, en contorno para lo demás, en rojo para lo que se paró. */
export function Stamp({ tone = "outline", children }: { tone?: "solid" | "outline" | "alert"; children: ReactNode }) {
	const cls = tone === "solid" ? "stamp stamp--solid" : tone === "alert" ? "stamp stamp--alert" : "stamp";
	return <span className={cls}>{children}</span>;
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
				<label htmlFor={id} className="t-tab">
					{label}
				</label>
				{counter}
			</div>
			{children}
			{(reserve || message) && (
				<p
					id={`${id}-msg`}
					aria-live="polite"
					className={`mt-1 mb-2 min-h-[1.4rem] text-[0.9rem] leading-snug ${error ? "font-bold text-(--destructive)" : "text-(--ink-2)"}`}>
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
	return (
		<span className={`t-cond t-num text-[0.85rem] ${value.length >= max ? "font-bold text-(--destructive)" : "text-(--ink-2)"}`}>
			{value.length}/{max}
		</span>
	);
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "value" | "onChange">;

/** Un campo de una línea. `cond` lo pone en el corte condensado, para identificadores. */
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
				className={`field ${cond ? "field--cond" : ""} ${className}`}
				{...input}
			/>
		</FieldShell>
	);
}

/**
 * La variante de varias líneas. Sin `hint` no reserva línea de aviso: un
 * texto libre con techo de caracteres no tiene error que dar (el contador ya
 * lo dice), y una línea vacía fija debajo sería un hueco sin motivo.
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

/** Un desplegable nativo con el trazo del mundo: el control que el sistema ya sabe manejar. */
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
			<select id={id} value={value} aria-describedby={`${id}-msg`} onChange={(e) => onChange(e.target.value)} className="field" {...rest}>
				{options.map((option) => (
					<option key={option.id} value={option.id}>
						{option.label}
					</option>
				))}
			</select>
		</FieldShell>
	);
}

/** La casilla cuadrada: un checkbox nativo escondido bajo un cuadrado con el trazo del mundo. */
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
	/** Impreso al 45% y sin cursor de mano: el motivo lo dice el texto de al lado. */
	disabled?: boolean;
	children: ReactNode;
}) {
	const fallback = useId();
	const inputId = id ?? fallback;
	return (
		<label
			htmlFor={inputId}
			className={`inline-flex items-start gap-3 select-none ${disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer"}`}>
			<span className="relative mt-0.5 shrink-0">
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
					className="flex size-5 items-center justify-center border-[length:var(--stroke)] border-(--ink) bg-(--paper) outline-none peer-checked:bg-(--ink) peer-focus-visible:outline-[length:var(--stroke)] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--ink)">
					{checked && <CheckIcon className="size-3.5 text-(--paper)" strokeWidth={3.5} />}
				</span>
			</span>
			<span className="min-w-0 text-[0.95rem] leading-snug">{children}</span>
		</label>
	);
}

// ─── avisos ──────────────────────────────────────────────────────────────────

/** El error con el que volvió el servidor, con sus propias palabras. */
export function Alert({ error, children }: { error?: Error | null; children?: ReactNode }) {
	const text = children ?? error?.message;
	if (!text) return null;
	return (
		<p role="alert" className="border-[length:var(--stroke)] border-(--destructive) px-3 py-2 text-[0.95rem] leading-snug font-bold text-(--destructive)">
			{text}
		</p>
	);
}

/** Una nota con filete: la letra pequeña que acompaña a una parada. */
export function Note({ title, children }: { title?: string; children: ReactNode }) {
	return (
		<div className="rule-thin pt-3">
			{title && <p className="t-tab mb-1 text-(--ink-2)">{title}</p>}
			<p className="max-w-[68ch] text-[0.95rem] leading-snug text-(--ink-2)">{children}</p>
		</div>
	);
}

/**
 * Una caja de estado: un aviso que tiene que leerse antes de lo demás (la
 * solicitud en revisión, la suspensión, la cuenta de Stripe). El sello dice el
 * estado con una palabra; el borde rojo sólo para lo que se paró.
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
		<div className={`border-[length:var(--stroke)] p-4 md:p-5 ${tone === "alert" ? "border-(--destructive)" : "border-(--ink)"}`}>
			<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
				{stamp}
				<p className="font-bold leading-snug">{title}</p>
			</div>
			{children && <div className="mt-2 flex max-w-[72ch] flex-col gap-2 text-[0.95rem] leading-relaxed text-(--ink-2)">{children}</div>}
			{footer && <div className="mt-4 flex flex-wrap items-center gap-3">{footer}</div>}
		</div>
	);
}

// ─── acciones ────────────────────────────────────────────────────────────────

/**
 * El pie de cada formulario del pliego: el aviso a la izquierda (con su sitio
 * reservado y siempre una palabra: «No changes.», «Unsaved changes.»,
 * «Saved.») y el billete de guardar, en contorno y apagado hasta que hay algo
 * que guardar, sólido cuando lo hay.
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
	/** Hay cambios pero un campo no pasaría: el billete sigue cerrado y el aviso lo dice. */
	blocked?: boolean;
	label?: string;
	/** Otro billete a la izquierda del de guardar: «Cancel», «Revert». */
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
	// Sólido sólo cuando hay algo que guardar: en reposo el billete es un
	// contorno apagado, no una losa gris en cada parada.
	const ready = dirty && !blocked;
	return (
		<div className="rule-thin flex flex-wrap items-center justify-end gap-x-3 gap-y-2 pt-4">
			<p className="mr-auto min-h-[1.4rem] text-[0.95rem] text-(--ink-2)" aria-live="polite">
				{status}
			</p>
			{extra}
			<button
				type="submit"
				className={`ticket ticket--sm ${ready ? "ticket--solid" : ""}`}
				disabled={!ready || pending}
				aria-busy={pending || undefined}>
				{pending ? "Saving…" : label}
			</button>
		</div>
	);
}

/**
 * Copiar un valor. Con `text` es un billete con palabra; sin él, un billete
 * cuadrado con el glifo junto a un valor que ya tiene rótulo. Un portapapeles
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
				{copied ? <CheckIcon className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
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
	/** Un acto irreversible: se imprime en rojo de error. */
	danger?: boolean;
}

/** El menú de acciones: un billete cuadrado que abre un panel de papel con grupos. */
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
				<MoreHorizontal className="size-4" aria-hidden="true" />
			</button>
			{open && (
				<div role="menu" aria-label={label} className={`menu-panel top-full mt-2 ${align === "end" ? "right-0" : "left-0"}`}>
					{groups.map((group, i) => (
						<div key={group.title ?? i} className={i > 0 ? "rule-thin" : undefined}>
							{group.title && <p className="t-tab px-4 pt-3 pb-1 text-(--ink-2)">{group.title}</p>}
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
									{item.icon && <item.icon className="size-4 shrink-0" aria-hidden="true" />}
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
 * El diálogo de papel, sobre el `<dialog>` nativo: el sistema ya atrapa el
 * foco, lo devuelve al cerrar y sabe de Escape. Se reserva para los actos que
 * no se deshacen (rotar un secreto, borrar) y para el secreto que se enseña
 * una sola vez, que se abre con `dismissable={false}`: ni Escape ni un clic
 * fuera lo cierran, sólo la confirmación de dentro.
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
			<div className="flex shrink-0 items-start justify-between gap-4 border-b-[length:var(--stroke)] border-(--ink) px-5 py-4">
				<div className="min-w-0">
					<h2 id={titleId} className="t-h3 text-[1.25rem]">
						{title}
					</h2>
					{description && (
						<p id={descId} className="mt-1 text-[0.95rem] leading-snug text-(--ink-2)">
							{description}
						</p>
					)}
				</div>
				{dismissable && (
					<button type="button" className="ticket ticket--glyph shrink-0" aria-label="Close" onClick={onClose}>
						<X className="size-4" aria-hidden="true" />
					</button>
				)}
			</div>
			{children && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{open && children}</div>}
			{footer && open && <div className="shrink-0 border-t border-(--rule) px-5 py-4">{footer}</div>}
		</dialog>
	);
}

/**
 * El pie de una confirmación en un diálogo de papel: el error del servidor si
 * lo hubo, «Cancel» primero y el acto después. El foco empieza en «Cancel», el
 * lado que no hace nada, así que un Intro de más no borra ni rota nada.
 * `danger` imprime el acto en el rojo de error.
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
			{error && (
				<p role="alert" className="text-[0.95rem] font-bold text-(--destructive)">
					{error.message}
				</p>
			)}
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
 * Pasos en orden sobre una espina vertical: la línea de 10px con su marca por
 * paso. Para lo que se hace en una secuencia (qué hacer si se filtra un
 * secreto, qué pasa después de compartir el enlace), donde el orden es el dato.
 */
export function Spine({ steps }: { steps: { title: string; text: ReactNode }[] }) {
	return (
		<ol className="relative max-w-2xl pl-10">
			<span aria-hidden="true" className="absolute top-1 bottom-1 left-3 bg-(--ink)" style={{ width: "var(--line)" }} />
			{steps.map((step) => (
				<li key={step.title} className="relative py-2.5">
					<span aria-hidden="true" className="absolute top-[1.1rem] -left-7 h-[3px] w-6 bg-(--ink)" />
					<p className="leading-tight font-bold">{step.title}</p>
					<p className="mt-1 text-[0.95rem] leading-snug text-(--ink-2)">{step.text}</p>
				</li>
			))}
		</ol>
	);
}

/** La forma de lo que viene mientras llega: bloques en la única tinta clara, sin girar nada. */
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

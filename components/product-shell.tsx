/**
 * El marco de un producto en el mundo del mapa de red: las piezas de la franja
 * de ruta que son iguales en las seis apps y no saben nada del router ni de los
 * contextos de cada una. Cada app las cablea en su `shell/workspace-shell.tsx`
 * con sus propios `Link`, sus hooks y sus destinos.
 *
 * Dentro de una app se viaja en UNA línea. La franja lleva la placa de OnDesk,
 * el tramo de la línea de la app con su nombre y la placa del workspace; la
 * banda de seis líneas debajo enciende la de la app y apaga las otras cinco; el
 * riel de páginas es el segundo nivel de la franja, con la barra de la parada
 * actual en el color de la línea. Cambiar de app es cambiar de línea: al pasar
 * el ratón por otra app en el menú, su línea se enciende en la banda antes de
 * saltar.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowUpRight, ChevronDown, LayoutGrid, Menu, X } from "lucide-react";
import { APP_NAME, APP_TAGLINE, PRODUCT_IDS, lineColor, type ProductId } from "../lib/lines";
import { useDismiss } from "../hooks/map";
import {
	CHOOSABLE_STATUSES,
	STATUS_META,
	lastSeenSentence,
	presenceLabel,
	type OwnPresence,
	type PresenceStatus,
} from "../presence/status";
import { PresenceRing } from "../presence/presence-dot";
import { LineBand } from "./map";
import { Monogram } from "./console-kit";

// ─── la franja ───────────────────────────────────────────────────────────────

/**
 * La cabecera entera, pegada arriba: la fila de la franja, la banda con la línea
 * de la app encendida y el riel de páginas. `focus` es la línea encendida —
 * la de la app, salvo mientras el menú de apps previsualiza otra — y
 * `stopColor` pinta las marcas de parada de toda la página en ese color.
 */
export function ProductStrip({
	app,
	focus,
	brand,
	nav,
	actions,
	rail,
	railAction,
	menuOpen,
	onMenuToggle,
	mobile,
}: {
	app: ProductId;
	focus?: ProductId | null;
	/** La placa de OnDesk, el tramo de la app y la placa del workspace. */
	brand: ReactNode;
	/** Enlaces de la franja a la derecha de la marca (opcional). */
	nav?: ReactNode;
	/** Los billetes de la derecha: buscar, apps, Nova, ayuda, avisos, cuenta. */
	actions: ReactNode;
	/** Los destinos del riel (`<a>` o `Link` con `aria-current`). */
	rail: ReactNode;
	/** La acción que crea algo en esta app, al final del riel. */
	railAction?: ReactNode;
	menuOpen: boolean;
	onMenuToggle: () => void;
	/** El panel del teléfono, ya compuesto por la app. */
	mobile: ReactNode;
}) {
	return (
		<header className="strip" style={{ "--stop-color": lineColor(app) } as CSSProperties}>
			<div className="wrap flex h-16 items-center justify-between gap-4">
				<div className="flex h-full min-w-0 flex-1 items-center gap-4 md:flex-none md:gap-5">{brand}</div>
				{/* El buscador sólo desde 768px: en un teléfono la placa del workspace se
				    queda con el ancho y envuelve su nombre en vez de cortarlo. */}
				{nav && <div className="hidden min-w-0 flex-1 items-center justify-center md:flex">{nav}</div>}
				<div className="hidden items-center gap-2 md:flex">{actions}</div>
				<button
					type="button"
					className="-mr-2 border-[length:var(--stroke)] border-transparent p-2 transition-colors hover:border-(--ink) md:hidden"
					onClick={onMenuToggle}
					aria-expanded={menuOpen}
					aria-label={menuOpen ? "Close the menu" : "Open the menu"}>
					{menuOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
				</button>
			</div>
			<LineBand focus={focus === undefined ? app : focus} />
			<div className="rail-row border-b border-(--rule)">
				<div className="wrap flex items-center gap-4">
					<nav className="page-rail min-w-0 flex-1" aria-label="Pages" style={{ borderBottom: 0 }}>
						{rail}
					</nav>
					{railAction && <div className="hidden shrink-0 items-center gap-2 py-1 sm:flex">{railAction}</div>}
				</div>
			</div>
			{menuOpen && (
				<div className="arrive fixed inset-x-0 top-[calc(4rem+1.5rem)] bottom-0 z-50 overflow-y-auto bg-(--paper) md:hidden">
					<div className="wrap py-4">{mobile}</div>
				</div>
			)}
		</header>
	);
}

/** La marca de la franja: la placa de OnDesk y, tras ella, el tramo de la línea de la app con su nombre. */
export function StripBrand({ app, homeHref, children }: { app: ProductId; homeHref: string; children?: ReactNode }) {
	return (
		<>
			<a href={homeHref} className="plate shrink-0 px-2.5 py-1.5 text-[1.15rem] leading-none font-extrabold tracking-[-0.02em]">
				OnDesk
			</a>
			{/* El tramo de la línea siempre; el nombre desde 640px, donde cabe junto a la placa del workspace. */}
			<span className="inline-flex shrink-0 items-center gap-2.5" aria-label={APP_NAME[app]}>
				<span className="swatch" style={{ "--swatch": lineColor(app), width: "1.6rem" } as CSSProperties} aria-hidden="true" />
				<span className="hidden text-[1.05rem] leading-none font-extrabold tracking-[-0.02em] sm:inline">{APP_NAME[app]}</span>
			</span>
			{children}
		</>
	);
}

/** Un enlace de la franja: negrita, tinta secundaria, tinta y barra de 3px cuando es el actual. */
export function StripLink({ active, children, ...rest }: { active?: boolean; children: ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
	return (
		<a
			{...rest}
			aria-current={active ? "page" : undefined}
			className={`relative inline-flex h-full items-center px-3 text-[0.95rem] font-bold transition-colors ${
				active ? "text-(--ink)" : "text-(--ink-2) hover:text-(--ink)"
			}`}>
			{children}
			{active && <span className="absolute inset-x-3 bottom-0 h-[3px] bg-(--ink)" aria-hidden="true" />}
		</a>
	);
}

// ─── el menú de apps ─────────────────────────────────────────────────────────

/**
 * Cambiar de línea: las otras cinco apps como filas de una clave de mapa (el
 * tramo de su línea, el nombre, la frase) y, al final, la consola de OnDesk. Al
 * pasar el ratón por una fila avisa a la franja para que encienda esa línea en
 * la banda; al salir, la banda vuelve a la línea de la app.
 */
export function AppsMenu({
	current,
	hrefFor,
	consoleHref,
	onPreview,
}: {
	current: ProductId;
	/** La URL de una app para el workspace actual: `${origin}/w/${slug}`. */
	hrefFor: (id: ProductId) => string;
	consoleHref: string;
	onPreview?: (id: ProductId | null) => void;
}) {
	const [open, setOpen] = useState(false);
	const box = useRef<HTMLDivElement>(null);
	const trigger = useRef<HTMLButtonElement>(null);
	useDismiss(open, box, trigger, () => setOpen(false));
	useEffect(() => {
		if (!open) onPreview?.(null);
	}, [open, onPreview]);

	return (
		<div ref={box} className="relative">
			<button
				ref={trigger}
				type="button"
				className="ticket ticket--sm gap-2"
				aria-label="Switch app"
				aria-haspopup="menu"
				aria-expanded={open}
				onClick={() => setOpen((v) => !v)}>
				<LayoutGrid className="size-4" aria-hidden="true" />
				<span className="hidden lg:inline">Apps</span>
			</button>
			{open && (
				<div role="menu" aria-label="Switch app" className="menu-panel top-full right-0 mt-2 w-80" onMouseLeave={() => onPreview?.(null)}>
					<p className="t-tab px-4 pt-3 pb-1.5 text-(--ink-2)">Change line</p>
					{PRODUCT_IDS.filter((id) => id !== current).map((id) => (
						<a
							key={id}
							role="menuitem"
							href={hrefFor(id)}
							onMouseEnter={() => onPreview?.(id)}
							onFocus={() => onPreview?.(id)}
							className="!items-start">
							<span className="swatch mt-[0.45rem]" style={{ "--swatch": lineColor(id), width: "1.25rem" } as CSSProperties} aria-hidden="true" />
							<span className="min-w-0 flex-1">
								<span className="block">{APP_NAME[id]}</span>
								<span className="block text-[0.85rem] leading-snug font-normal text-(--ink-2)">{APP_TAGLINE[id]}</span>
							</span>
						</a>
					))}
					<div className="rule-thin" />
					<a role="menuitem" href={consoleHref}>
						OnDesk console
						<ArrowUpRight className="ml-auto size-4 text-(--ink-2)" aria-hidden="true" />
					</a>
				</div>
			)}
		</div>
	);
}

// ─── la cuenta ───────────────────────────────────────────────────────────────

/**
 * El billete de cuenta: la cara y el nombre de quien ha entrado, con su estado
 * en un anillo, que abre un panel de papel con el selector de estado, los
 * destinos que la app quiera (Profile, Security en OnDesk…) y la salida. El
 * anillo muestra la ELECCIÓN, no el resultado: una persona invisible tiene
 * derecho a ver que es invisible, que es justo lo que nadie más ve.
 */
export function AccountMenu({
	name,
	email,
	logoUrl,
	presence,
	onChooseStatus,
	choosing = false,
	links,
	onSignOut,
	signingOut = false,
}: {
	name: string;
	email: string;
	logoUrl: string | null | undefined;
	presence: OwnPresence | undefined;
	onChooseStatus: (status: PresenceStatus) => void;
	choosing?: boolean;
	/** Filas `role="menuitem"` (enlaces o botones) entre el estado y la salida. */
	links?: ReactNode;
	onSignOut: () => void;
	signingOut?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const box = useRef<HTMLDivElement>(null);
	const trigger = useRef<HTMLButtonElement>(null);
	useDismiss(open, box, trigger, () => setOpen(false));
	const chosen = presence?.status ?? "online";

	return (
		<div ref={box} className="relative">
			<button
				ref={trigger}
				type="button"
				className="ticket ticket--sm max-w-[16rem] gap-2.5"
				onClick={() => setOpen((v) => !v)}
				aria-expanded={open}
				aria-haspopup="menu">
				<PresenceRing status={chosen} />
				<span className="hidden truncate lg:inline">{name}</span>
				<ChevronDown className={`size-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
			</button>
			{open && (
				<div role="menu" aria-label="Your account" className="menu-panel top-full right-0 mt-2 w-80">
					<div className="flex items-center gap-3 border-b border-(--rule) px-4 py-3">
						<Monogram name={name} logoUrl={logoUrl} size="sm" />
						<div className="min-w-0">
							<p className="truncate font-bold">{name}</p>
							<p className="t-cond truncate text-[0.9rem] text-(--ink-2)">{email}</p>
						</div>
					</div>
					<div className="px-4 pt-3 pb-2">
						<PresenceChoices presence={presence} onChoose={onChooseStatus} disabled={choosing} />
					</div>
					{links && (
						<>
							<div className="rule-thin" />
							<div onClick={() => setOpen(false)}>{links}</div>
						</>
					)}
					<div className="rule-thin" />
					<button type="button" role="menuitem" disabled={signingOut} onClick={onSignOut}>
						{signingOut ? "Signing out…" : "Sign out"}
					</button>
				</div>
			)}
		</div>
	);
}

/**
 * El selector de estado: los cuatro que se eligen, cada uno un anillo y su
 * palabra, y debajo la CONSECUENCIA («Everyone sees you as offline»), porque
 * que la elección y lo que ven los demás no coincidan sin explicación es como
 * alguien acaba preguntándose por qué nadie le ha escrito en toda la tarde.
 */
export function PresenceChoices({
	presence,
	onChoose,
	disabled = false,
}: {
	presence: OwnPresence | undefined;
	onChoose: (status: PresenceStatus) => void;
	disabled?: boolean;
}) {
	const chosen: PresenceStatus = presence?.status ?? "online";
	const meta = STATUS_META[chosen];

	return (
		<div role="radiogroup" aria-label="Your status">
			<p className="t-tab mb-1.5 text-(--ink-2)">Your status</p>
			<ul className="flex flex-col">
				{CHOOSABLE_STATUSES.map((status) => {
					const option = STATUS_META[status];
					const on = status === chosen;
					return (
						<li key={status}>
							<button
								type="button"
								role="radio"
								aria-checked={on}
								disabled={disabled}
								onClick={() => onChoose(status)}
								className={`-mx-2 flex w-[calc(100%+1rem)] items-start gap-3 px-2 py-1.5 text-left transition-colors hover:bg-(--paper-2) disabled:opacity-45 ${
									on ? "bg-(--paper-2)" : ""
								}`}>
								<span className="mt-1">
									<PresenceRing status={status} />
								</span>
								<span className="min-w-0 flex-1">
									<span className="block font-bold">{option.label}</span>
									<span className="block text-[0.85rem] leading-snug text-(--ink-2)">{option.description}</span>
								</span>
							</button>
						</li>
					);
				})}
			</ul>
			<p className="mt-2 text-[0.85rem] leading-snug text-(--ink-2)" aria-live="polite">
				{chosen === "invisible"
					? "Everyone sees you as offline, in every OnDesk product."
					: presence?.activity
						? `You're in a meeting — everyone sees you as ${presenceLabel({ status: "busy", activity: presence.activity })} until you leave, then ${meta.label} again.`
						: presence?.effective === "offline"
							? (lastSeenSentence(presence.last_seen_at) ?? "Nobody has seen you online yet.")
							: "Visible in every OnDesk product."}
			</p>
		</div>
	);
}

// ─── el panel del teléfono ───────────────────────────────────────────────────

/** La cabecera del panel del teléfono: la cara, el nombre y el correo de quien ha entrado. */
export function MobileIdentity({ name, email, logoUrl }: { name: string; email: string; logoUrl?: string | null }) {
	return (
		<div className="flex items-center gap-3 border-b border-(--rule) pb-4">
			<Monogram name={name} logoUrl={logoUrl} size="sm" />
			<div className="min-w-0">
				<p className="truncate font-bold">{name}</p>
				<p className="t-cond truncate text-[0.9rem] text-(--ink-2)">{email}</p>
			</div>
		</div>
	);
}

/** Una fila del panel del teléfono, con la flecha del mapa. */
export function MobileRow({ active, children, ...rest }: { active?: boolean; children: ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
	return (
		<a
			{...rest}
			className={`flex items-center justify-between border-b border-(--rule-2) py-3 font-bold ${active ? "text-(--ink)" : "text-(--ink-2)"}`}>
			{children}
			<ArrowUpRight className="size-4" aria-hidden="true" />
		</a>
	);
}

/** Las otras apps en el panel del teléfono: la clave del mapa, una fila por línea. */
export function MobileApps({ current, hrefFor }: { current: ProductId; hrefFor: (id: ProductId) => string }) {
	return (
		<ul>
			{PRODUCT_IDS.filter((id) => id !== current).map((id) => (
				<li key={id}>
					<a href={hrefFor(id)} className="flex items-center gap-3 border-b border-(--rule-2) py-3 font-bold text-(--ink-2)">
						<span className="swatch" style={{ "--swatch": lineColor(id) } as CSSProperties} aria-hidden="true" />
						{APP_NAME[id]}
						<span className="ml-auto text-[0.85rem] font-normal">{APP_TAGLINE[id]}</span>
					</a>
				</li>
			))}
		</ul>
	);
}

// ─── el tablero ──────────────────────────────────────────────────────────────

/** El tablero de información que cierra cada página: la placa, una frase, los destinos y la línea de derechos. */
export function Board({
	app,
	homeHref,
	links,
	tagline = "One account, one team list, and one invoice per app.",
}: {
	app: ProductId;
	homeHref: string;
	/** `<a>` o `Link` de 0.95rem; el tablero les pone el color. */
	links: ReactNode;
	tagline?: string;
}) {
	return (
		<footer className="board">
			<div className="wrap flex flex-col gap-6 py-10 md:flex-row md:items-center md:justify-between">
				<div className="flex flex-wrap items-center gap-4">
					<a
						href={homeHref}
						className="inline-block bg-(--paper) px-2.5 py-1.5 text-[1.15rem] leading-none font-extrabold tracking-[-0.02em] text-(--ink)">
						OnDesk
					</a>
					<span className="inline-flex items-center gap-2.5 text-[1.05rem] font-extrabold tracking-[-0.02em]">
						<span className="swatch" style={{ "--swatch": lineColor(app), width: "1.6rem" } as CSSProperties} aria-hidden="true" />
						{APP_NAME[app]}
					</span>
					<p className="t-body max-w-md text-[0.95rem]">{tagline}</p>
				</div>
				<ul className="board-links flex flex-wrap gap-x-6 gap-y-2 text-[0.95rem]">{links}</ul>
			</div>
			<div className="border-t-[length:var(--stroke)] border-white">
				<div className="wrap flex flex-col items-center justify-between gap-2 py-4 text-[0.9rem] text-white/70 sm:flex-row">
					<span>© {new Date().getFullYear()} OnDesk</span>
					<span className="t-cond">Northstar Platforms LLC</span>
				</div>
			</div>
		</footer>
	);
}

/** Las clases de una fila del panel del teléfono, para los `Link` del router de cada app. */
export function mobileRowClass(active: boolean): string {
	return `flex items-center justify-between border-b border-(--rule-2) py-3 font-bold ${active ? "text-(--ink)" : "text-(--ink-2)"}`;
}

/** Las clases de un destino del riel, para los `Link` del router de cada app (el riel las viste por `a`). */
export const RAIL_LINK_CLASS = "";

// ─── el workspace en la franja ───────────────────────────────────────────────

/**
 * La placa del workspace en la franja, que es también el selector: el workspace
 * es el tema de todo lo que hay debajo, no un filtro sobre ello. Con un solo
 * workspace es una placa quieta; con varios, un botón que abre un panel de
 * papel con un anillo relleno en el actual y, al final, la consola de OnDesk,
 * donde se crean y se administran.
 */
export function WorkspaceSwitch<T extends { id: string; name: string; slug: string }>({
	current,
	all,
	onChoose,
	consoleHref,
}: {
	current: T;
	all: T[];
	onChoose: (workspace: T) => void;
	consoleHref: string;
}) {
	const [open, setOpen] = useState(false);
	const box = useRef<HTMLDivElement>(null);
	const trigger = useRef<HTMLButtonElement>(null);
	useDismiss(open, box, trigger, () => setOpen(false));
	const single = all.length <= 1;

	return (
		<div ref={box} className="relative min-w-0">
			{single ? (
				<span className="plate-block min-w-0 max-w-full px-2.5 py-1.5 text-[0.95rem] leading-[1.15] font-extrabold tracking-[-0.01em] sm:max-w-[14rem] sm:leading-none lg:max-w-[20rem]">
					<span className="min-w-0 [overflow-wrap:anywhere] sm:truncate">{current.name}</span>
				</span>
			) : (
				<button
					ref={trigger}
					type="button"
					className="plate-block min-w-0 max-w-full px-2.5 py-1.5 text-left text-[0.95rem] leading-[1.15] font-extrabold tracking-[-0.01em] sm:max-w-[14rem] sm:leading-none lg:max-w-[20rem]"
					aria-haspopup="menu"
					aria-expanded={open}
					aria-label={`Switch workspace, currently ${current.name}`}
					onClick={() => setOpen((v) => !v)}>
					<span className="min-w-0 [overflow-wrap:anywhere] sm:truncate">{current.name}</span>
					<ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
				</button>
			)}
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
								setOpen(false);
								if (workspace.id !== current.id) onChoose(workspace);
							}}>
							<span className={`ring ${workspace.id === current.id ? "ring--filled" : ""}`} aria-hidden="true" />
							<span className="min-w-0 flex-1 truncate">{workspace.name}</span>
							<span className="t-cond text-[0.85rem] font-normal text-(--ink-2)">/{workspace.slug}</span>
						</button>
					))}
					<div className="rule-thin" />
					<a role="menuitem" href={consoleHref}>
						Manage in the console
						<ArrowUpRight className="ml-auto size-4 text-(--ink-2)" aria-hidden="true" />
					</a>
				</div>
			)}
		</div>
	);
}

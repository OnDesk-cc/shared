/**
 * El marco de un producto en el mundo «Clear Sky» (2026-10-04): la forma de la
 * consola de ondesk, para que pasar de la consola a una app, o de una app a
 * otra, se sienta como quedarse en el mismo sitio.
 *
 * - A la izquierda, la barra lateral: la baldosa y el nombre de la app, el
 *   selector de workspace, la acción que crea algo en esta app, sus destinos y,
 *   debajo, las otras cinco apps con su baldosa y la consola de OnDesk. Fija
 *   mientras la página se mueve; en un teléfono es un cajón.
 * - Arriba, la barra: el buscador y las acciones (Nova, ayuda, avisos, la
 *   cuenta). Se vuelve vidrio cuando la página se desplaza.
 * - En el centro, la página sobre el suelo del cielo.
 *
 * Estas piezas no saben nada del router ni de los contextos de cada app: cada
 * una las cablea en su `shell/workspace-shell.tsx` con sus `Link`, sus hooks y
 * sus destinos. `<html>` ya lleva `site sk` (index.html de cada app).
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, Check, ChevronDown, ChevronRight, Clock, LogOut, Menu, ShieldCheck, UserRound, X, type LucideIcon } from "lucide-react";
import { APP_NAME, PRODUCT_IDS, type ProductId } from "../lib/lines";
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
import { Monogram } from "./console-kit";
import { AppTile, Mark } from "./sky";

// ─── el marco ────────────────────────────────────────────────────────────────

export function ProductFrame({
	app,
	pathname,
	home,
	workspace,
	create,
	nav,
	hrefFor,
	consoleHref,
	sidebarFooter,
	search,
	actions,
	drawerExtra,
	ondeskHref,
	bounded = false,
	children,
}: {
	app: ProductId;
	/** La ruta actual: el cajón del teléfono se cierra solo al navegar. */
	pathname: string;
	/** El enlace a la portada de la app, con el `Link` del router de cada una. */
	home: (content: ReactNode, className: string) => ReactNode;
	/** El selector de workspace (`WorkspaceSwitch`). */
	workspace: ReactNode;
	/** La acción que crea algo en esta app («New channel»), bajo el selector. */
	create?: ReactNode;
	/** Los destinos, con `sideLinkClass` y `SideLinkBody`. */
	nav: ReactNode;
	/** La URL de una app para el workspace actual: `${origin}/w/${slug}`. */
	hrefFor: (id: ProductId) => string;
	consoleHref: string;
	/** Lo que va al pie de la barra lateral (el perfil). */
	sidebarFooter?: ReactNode;
	/** El buscador de la barra superior (desde 768px). */
	search?: ReactNode;
	/** Las acciones de la derecha de la barra superior. */
	actions: ReactNode;
	/** Lo que el cajón del teléfono añade bajo la barra lateral (el estado). */
	drawerExtra?: ReactNode;
	/** El origen de ondesk.cc, para Status y Legal. */
	ondeskHref: string;
	/** La página acota su columna al viewport y gestiona su propio scroll (una conversación). */
	bounded?: boolean;
	children: ReactNode;
}) {
	const [scrolled, setScrolled] = useState(false);
	const sentinel = useRef<HTMLDivElement>(null);
	// El cajón recuerda en qué página se abrió: al navegar queda cerrado solo.
	const [drawerAt, setDrawerAt] = useState<string | null>(null);
	const drawerOpen = drawerAt === pathname;

	useEffect(() => {
		const el = sentinel.current;
		if (!el) return;
		const io = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting));
		io.observe(el);
		return () => io.disconnect();
	}, []);

	useEffect(() => {
		if (!drawerOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setDrawerAt(null);
		};
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		document.addEventListener("keydown", onKey);
		return () => {
			document.body.style.overflow = previous;
			document.removeEventListener("keydown", onKey);
		};
	}, [drawerOpen]);

	const brand = (size: "sm" | "md") =>
		home(
			<>
				<AppTile id={app} size={size === "md" ? "sm" : "xs"} />
				{APP_NAME[app]}
			</>,
			`inline-flex items-center gap-2.5 font-semibold tracking-[-0.03em] text-(--sk-ink) no-underline ${size === "md" ? "text-[1.0625rem]" : "text-[1rem]"}`,
		);

	const sidebar = (
		<>
			<div className="mb-4 px-2">{brand("md")}</div>
			{workspace}
			{create && <div className="mt-3 [&>*]:w-full">{create}</div>}
			<nav aria-label={APP_NAME[app]} className="mt-4 flex flex-col gap-0.5">
				{nav}
			</nav>
			<SidebarApps current={app} hrefFor={hrefFor} consoleHref={consoleHref} />
			{sidebarFooter && <div className="mt-auto flex flex-col gap-0.5 pt-6">{sidebarFooter}</div>}
		</>
	);

	return (
		<div className={`relative min-h-dvh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] ${bounded ? "h-dvh overflow-hidden" : ""}`}>
			<div ref={sentinel} className="pointer-events-none absolute inset-x-0 top-0 h-2" aria-hidden="true" />

			{/* ── la barra lateral ── */}
			<aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto bg-[#eef3f9] px-3 pb-4 pt-4 lg:flex">{sidebar}</aside>

			<div className={`flex min-w-0 flex-col ${bounded ? "h-dvh min-h-0" : "min-h-dvh"}`}>
				{/* ── la barra superior ── */}
				<header className="sk-header sticky top-0 z-40 shrink-0" data-scrolled={scrolled || drawerOpen || bounded}>
					<div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
						<span className="-ml-2 lg:hidden">
							<button
								type="button"
								className="sk-navlink size-10! justify-center p-0!"
								onClick={() => setDrawerAt(drawerOpen ? null : pathname)}
								aria-expanded={drawerOpen}
								aria-label={drawerOpen ? "Close the menu" : "Open the menu"}>
								{drawerOpen ? <X className="size-5" strokeWidth={1.75} /> : <Menu className="size-5" strokeWidth={1.75} />}
							</button>
						</span>
						<span className="lg:hidden">{brand("sm")}</span>

						{/* El buscador sólo desde 768px: en un teléfono la marca se queda con el ancho. */}
						{search && (
							<span className="hidden min-w-0 max-w-md flex-1 md:block">
								<span className="block">{search}</span>
							</span>
						)}

						<div className="ml-auto flex items-center gap-1.5">{actions}</div>
					</div>
				</header>

				{/* ── la página ── */}
				{bounded ? (
					<main className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 pt-2 sm:px-6 lg:px-8">{children}</main>
				) : (
					<>
						<main className="relative flex-1 px-4 pb-20 pt-4 sm:px-6 lg:px-8 lg:pt-6">
							<div className="mx-auto w-full max-w-[80rem]">{children}</div>
						</main>
						<footer className="px-4 pb-6 sm:px-6 lg:px-8">
							<div className="mx-auto flex w-full max-w-[80rem] flex-wrap items-center justify-between gap-3 border-t border-(--sk-hair) pt-5">
								<span className="sk-small">
									© {new Date().getFullYear()} OnDesk {APP_NAME[app]}. Northstar Platforms LLC
								</span>
								<span className="flex gap-4">
									<a href={`${ondeskHref}/status`} className="sk-small no-underline hover:text-(--sk-ink)">
										Status
									</a>
									<a href={`${ondeskHref}/help`} className="sk-small no-underline hover:text-(--sk-ink)">
										Help
									</a>
									<a href={`${ondeskHref}/legal`} className="sk-small no-underline hover:text-(--sk-ink)">
										Legal
									</a>
								</span>
							</div>
						</footer>
					</>
				)}
			</div>

			{/* ── el cajón del teléfono: la misma barra lateral ── */}
			{drawerOpen && (
				<div className="fixed inset-0 z-50 lg:hidden">
					<button
						type="button"
						aria-label="Close the menu"
						className="absolute inset-0 bg-[rgba(14,27,46,0.35)] backdrop-blur-[2px]"
						onClick={() => setDrawerAt(null)}
					/>
					<aside className="sk-sheet absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] flex-col overflow-y-auto bg-[#eef3f9] px-3 pb-4 pt-4 shadow-(--sk-shadow-3)">
						{sidebar}
						{drawerExtra && <div className="mt-4 border-t border-(--sk-hair) px-2 pt-4">{drawerExtra}</div>}
					</aside>
				</div>
			)}
		</div>
	);
}

/**
 * El marco de las pantallas de una app que aún no están en un workspace (el
 * selector, el 404 de fuera): la barra superior con la baldosa de la app y lo
 * que haga falta a la derecha, sin barra lateral, como el selector de la
 * consola de ondesk. Una barra de un workspace que todavía no se ha elegido
 * sería una promesa vacía.
 */
export function BareFrame({
	app,
	homeHref,
	right,
	ondeskHref,
	children,
}: {
	app: ProductId;
	homeHref: string;
	right?: ReactNode;
	ondeskHref: string;
	children: ReactNode;
}) {
	return (
		<div className="flex min-h-dvh flex-col">
			<header className="sk-header sticky top-0 z-40">
				<div className="mx-auto flex h-16 w-full max-w-[72rem] items-center gap-3 px-4 sm:px-6">
					<a href={homeHref} className="inline-flex items-center gap-2.5 text-[1.0625rem] font-semibold tracking-[-0.03em] text-(--sk-ink) no-underline">
						<AppTile id={app} size="sm" />
						{APP_NAME[app]}
					</a>
					<div className="ml-auto flex items-center gap-2">{right}</div>
				</div>
			</header>
			<main className="flex-1 px-4 pb-20 pt-8 sm:px-6 md:pt-14">
				<div className="mx-auto w-full max-w-[72rem]">{children}</div>
			</main>
			<footer className="px-4 pb-6 sm:px-6">
				<div className="mx-auto flex w-full max-w-[72rem] flex-wrap items-center justify-between gap-3 border-t border-(--sk-hair) pt-5">
					<span className="sk-small">
						© {new Date().getFullYear()} OnDesk {APP_NAME[app]}. Northstar Platforms LLC
					</span>
					<span className="flex gap-4">
						<a href={`${ondeskHref}/status`} className="sk-small no-underline hover:text-(--sk-ink)">
							Status
						</a>
						<a href={`${ondeskHref}/legal`} className="sk-small no-underline hover:text-(--sk-ink)">
							Legal
						</a>
					</span>
				</div>
			</footer>
		</div>
	);
}

// ─── los destinos ────────────────────────────────────────────────────────────

/** Las clases de un destino de la barra lateral, para el `Link` del router de cada app. */
export function sideLinkClass(active: boolean): string {
	return `flex h-9 items-center gap-3 rounded-[10px] px-3 text-[0.875rem] no-underline transition-colors duration-150 ${
		active ? "bg-white font-medium text-(--sk-ink) shadow-(--sk-shadow-1)" : "text-(--sk-ink-2) hover:bg-white/60 hover:text-(--sk-ink)"
	}`;
}

/** Lo de dentro de un destino: el icono y la palabra, y un estado si lo hay («3 unread»). */
export function SideLinkBody({ icon: Icon, active, badge, children }: { icon: LucideIcon; active: boolean; badge?: ReactNode; children: ReactNode }) {
	return (
		<>
			<Icon className={`size-4 shrink-0 ${active ? "text-(--sk-ink)" : "text-(--sk-ink-3)"}`} strokeWidth={1.75} aria-hidden="true" />
			<span className="min-w-0 flex-1 truncate">{children}</span>
			{badge}
		</>
	);
}

/** Las otras cinco apps, con su baldosa, y la consola de OnDesk al final. */
function SidebarApps({ current, hrefFor, consoleHref }: { current: ProductId; hrefFor: (id: ProductId) => string; consoleHref: string }) {
	const row =
		"flex h-9 items-center gap-3 rounded-[10px] px-3 text-[0.875rem] text-(--sk-ink-2) no-underline transition-colors duration-150 hover:bg-white/60 hover:text-(--sk-ink)";
	return (
		<div className="mt-6">
			<p className="sk-small px-3 pb-1.5 font-medium">Apps</p>
			<ul className="flex flex-col gap-0.5">
				{PRODUCT_IDS.filter((id) => id !== current).map((id) => (
					<li key={id}>
						<a href={hrefFor(id)} className={row}>
							<AppTile id={id} size="xs" />
							{APP_NAME[id]}
						</a>
					</li>
				))}
				<li>
					<a href={consoleHref} className={row}>
						<Mark className="size-5" />
						<span className="min-w-0 flex-1 truncate">OnDesk console</span>
						<ArrowUpRight className="size-3.5 text-(--sk-ink-3)" strokeWidth={1.75} aria-hidden="true" />
					</a>
				</li>
			</ul>
		</div>
	);
}

// ─── el workspace ────────────────────────────────────────────────────────────

/**
 * El selector de workspace de la barra lateral: una tarjeta con la cara y el
 * nombre del actual. Con un solo workspace es una tarjeta quieta; con varios,
 * abre un menú que marca el actual y acaba en la consola de OnDesk, donde se
 * crean y se administran.
 */
export function WorkspaceSwitch<T extends { id: string; name: string; slug: string; logo_url?: string | null }>({
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
	const card = "flex w-full items-center gap-2.5 rounded-[12px] bg-white px-2.5 py-2 text-left shadow-(--sk-shadow-1)";
	const face = <Monogram name={current.name} logoUrl={current.logo_url} size="xs" />;

	if (single) {
		return (
			<div className={card}>
				{face}
				<span className="min-w-0 flex-1 truncate text-[0.875rem] font-medium text-(--sk-ink)">{current.name}</span>
			</div>
		);
	}

	return (
		<div ref={box} className="relative">
			<button
				ref={trigger}
				type="button"
				className={`${card} transition-shadow hover:shadow-(--sk-shadow-2)`}
				aria-haspopup="menu"
				aria-expanded={open}
				aria-label={`Switch workspace, currently ${current.name}`}
				onClick={() => setOpen((v) => !v)}>
				{face}
				<span className="min-w-0 flex-1 truncate text-[0.875rem] font-medium text-(--sk-ink)">{current.name}</span>
				<ChevronDown className={`size-4 shrink-0 text-(--sk-ink-3) transition-transform duration-200 ${open ? "rotate-180" : ""}`} strokeWidth={1.75} aria-hidden="true" />
			</button>
			{open && (
				<div role="menu" aria-label="Workspaces" className="menu-panel left-0 right-0 top-full z-50 mt-2">
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
							<Monogram name={workspace.name} logoUrl={workspace.logo_url} size="xs" />
							<span className="min-w-0 flex-1 truncate">{workspace.name}</span>
							{workspace.id === current.id && <Check className="size-4 shrink-0 text-(--sk-accent)" strokeWidth={2} aria-hidden="true" />}
						</button>
					))}
					<div className="mx-2 my-1 border-t border-(--sk-hair)" />
					<a role="menuitem" href={consoleHref}>
						Manage in the console
						<ArrowUpRight className="ml-auto size-3.5 text-(--sk-ink-3)" strokeWidth={1.75} aria-hidden="true" />
					</a>
				</div>
			)}
		</div>
	);
}

// ─── la cuenta ───────────────────────────────────────────────────────────────

/** El icono de una entrada de un menú de vidrio: el mismo trazo y tinta que en la barra lateral. */
export function MenuIcon({ icon: Icon }: { icon: LucideIcon }) {
	return <Icon className="size-4 shrink-0 text-(--sk-ink-3)" strokeWidth={1.75} aria-hidden="true" />;
}

/**
 * El menú de cuenta, el mismo que el de la consola de ondesk: la cara de quien
 * ha entrado con su estado, que abre un menú de vidrio con el selector de
 * estado, los destinos propios de la app (`links`, cada uno con su `MenuIcon`),
 * el grupo «Account» con las páginas de la cuenta en OnDesk (Profile, Security,
 * Working hours) y la salida. El punto muestra la ELECCIÓN, no el resultado: una
 * persona invisible tiene derecho a ver que es invisible, que es justo lo que
 * nadie más ve.
 */
export function AccountMenu({
	name,
	email,
	logoUrl,
	presence,
	onChooseStatus,
	choosing = false,
	links,
	ondeskHref,
	onSignOut,
	signingOut = false,
}: {
	name: string;
	email: string;
	logoUrl: string | null | undefined;
	presence: OwnPresence | undefined;
	onChooseStatus: (status: PresenceStatus) => void;
	choosing?: boolean;
	/** Filas `role="menuitem"` de la app (enlaces o botones, con su `MenuIcon`) entre el estado y la cuenta. */
	links?: ReactNode;
	/** El origen de ondesk.cc: el grupo «Account» lleva a sus páginas de la cuenta. */
	ondeskHref: string;
	onSignOut: () => void;
	signingOut?: boolean;
}) {
	const [open, setOpen] = useState(false);
	// «Account» es un grupo, no un destino, como en la consola: se abre al
	// pulsarlo y vuelve a plegarse cada vez que el menú se cierra.
	const [accountOpen, setAccountOpen] = useState(false);
	const box = useRef<HTMLDivElement>(null);
	const trigger = useRef<HTMLButtonElement>(null);
	const close = () => {
		setOpen(false);
		setAccountOpen(false);
	};
	useDismiss(open, box, trigger, close);
	const chosen = presence?.status ?? "online";
	const groupId = `account-group-${useId().replace(/:/g, "")}`;

	return (
		<div ref={box} className="relative">
			<button
				ref={trigger}
				type="button"
				className="flex items-center gap-2 rounded-full p-1 pr-2.5 transition-colors hover:bg-[rgba(14,27,46,0.05)]"
				onClick={() => setOpen((v) => !v)}
				aria-expanded={open}
				aria-haspopup="menu"
				aria-label={`Your account, ${name}`}>
				<span className="relative">
					<Monogram name={name} logoUrl={logoUrl} size="sm" />
					{/* el punto de estado, pequeño en la esquina de la cara */}
					<span className="absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-white">
						<span
							className={`block size-2 rounded-full ${chosen === "online" ? "bg-(--sk-ink)" : chosen === "busy" ? "bg-(--sk-ink-2)" : "bg-white ring-[1.5px] ring-[#9aa8ba]"}`}
							title={STATUS_META[chosen].label}
						/>
					</span>
				</span>
				<ChevronDown className={`size-3.5 shrink-0 text-(--sk-ink-3) transition-transform duration-200 ${open ? "rotate-180" : ""}`} strokeWidth={1.75} aria-hidden="true" />
			</button>
			{open && (
				<div role="menu" aria-label="Your account" className="menu-panel right-0 top-full mt-2 w-80">
					<div className="flex items-center gap-3 px-3 pb-3 pt-2">
						<Monogram name={name} logoUrl={logoUrl} size="sm" />
						<div className="min-w-0">
							<p className="truncate font-medium text-(--sk-ink)">{name}</p>
							<p className="sk-small truncate">{email}</p>
						</div>
					</div>
					<div className="border-t border-(--sk-hair) px-3 pb-2 pt-3">
						<PresenceChoices presence={presence} onChoose={onChooseStatus} disabled={choosing} />
					</div>
					<div className="mt-1 border-t border-(--sk-hair) pt-1">
						{links && <div onClick={close}>{links}</div>}
						<button type="button" role="menuitem" aria-expanded={accountOpen} aria-controls={groupId} onClick={() => setAccountOpen((v) => !v)}>
							<MenuIcon icon={UserRound} />
							<span className="flex-1">Account</span>
							<ChevronRight
								className={`size-3.5 shrink-0 text-(--sk-ink-3) transition-transform duration-200 ${accountOpen ? "rotate-90" : ""}`}
								strokeWidth={1.75}
								aria-hidden="true"
							/>
						</button>
						{accountOpen && (
							<div id={groupId} className="ml-5 border-l border-(--sk-hair) pl-1" onClick={close}>
								<a role="menuitem" href={`${ondeskHref}/account`}>
									<MenuIcon icon={UserRound} />
									<span className="flex-1">Profile</span>
									<ArrowUpRight className="size-3.5 text-(--sk-ink-3)" strokeWidth={1.75} aria-hidden="true" />
								</a>
								<a role="menuitem" href={`${ondeskHref}/account/security`}>
									<MenuIcon icon={ShieldCheck} />
									<span className="flex-1">Security</span>
									<ArrowUpRight className="size-3.5 text-(--sk-ink-3)" strokeWidth={1.75} aria-hidden="true" />
								</a>
								<a role="menuitem" href={`${ondeskHref}/account/hours`}>
									<MenuIcon icon={Clock} />
									<span className="flex-1">Working hours</span>
									<ArrowUpRight className="size-3.5 text-(--sk-ink-3)" strokeWidth={1.75} aria-hidden="true" />
								</a>
							</div>
						)}
						<button type="button" role="menuitem" disabled={signingOut} onClick={onSignOut}>
							<MenuIcon icon={LogOut} />
							{signingOut ? "Signing out…" : "Sign out"}
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

/**
 * El selector de estado: los cuatro que se eligen, cada uno con su anillo y su
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
			<p className="sk-small mb-1.5 font-medium">Your status</p>
			<ul className="flex flex-col gap-0.5">
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
								className={`-mx-2 flex w-[calc(100%+1rem)] items-start gap-3 rounded-[10px] px-2 py-1.5 text-left transition-colors hover:bg-[rgba(14,27,46,0.05)] disabled:opacity-50 ${
									on ? "bg-(--sk-ground)" : ""
								}`}>
								<span className="mt-1">
									<PresenceRing status={status} />
								</span>
								<span className="min-w-0 flex-1">
									<span className="block text-[0.875rem] font-medium text-(--sk-ink)">{option.label}</span>
									<span className="sk-small block leading-snug">{option.description}</span>
								</span>
							</button>
						</li>
					);
				})}
			</ul>
			<p className="sk-small mt-2 leading-snug" aria-live="polite">
				{chosen === "invisible"
					? "Everyone sees you as offline, in every OnDesk product."
					: presence?.activity
						? `You're in a meeting. Everyone sees you as ${presenceLabel({ status: "busy", activity: presence.activity })} until you leave, then ${meta.label} again.`
						: presence?.effective === "offline"
							? (lastSeenSentence(presence.last_seen_at) ?? "Nobody has seen you online yet.")
							: "Visible in every OnDesk product."}
			</p>
		</div>
	);
}

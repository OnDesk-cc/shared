/**
 * El panel acoplado de Nova (2026-10-08). Spec: ondesk/docs/specs/2026-10-08-nova-dock.md.
 *
 *   NovaDockProvider  el estado: abierta, ancho, la conversación en curso de cada
 *                     workspace y una pregunta pendiente. Lo lee de la cookie
 *                     `nova_dock` al montar (antes de pintar: sin parpadeo) y la
 *                     escribe en cada cambio. Por debajo de 1280px abrir y cerrar
 *                     es de la hoja y no toca la cookie: la preferencia es de
 *                     escritorio.
 *   useNovaDock       lo de arriba, para el botón, el menú de ayuda, el panel y el
 *                     campo de la portada de la consola.
 *   NovaDockColumn    la columna con su asa, para el marco. Es SÓLO un hueco: la
 *                     conversación vive en `NovaDockHost`, que la mete dentro por
 *                     portal. Así un marco que se desmonta al navegar (cada página
 *                     de la consola monta su `ConsoleShell`) no corta el
 *                     WebSocket: la columna nueva vuelve a recibir el mismo nodo.
 *   NovaDockHost      donde se monta el panel, UNA vez, en algo que no se desmonta
 *                     (la shell de cada app, la raíz de ondesk). En escritorio lo
 *                     pinta por portal en un <div> propio que la columna engancha;
 *                     por debajo de 1280px, en una hoja.
 *   NovaDockButton    el botón Nova de la barra, como interruptor.
 *
 * El ancho se arrastra con el puntero capturado y se escribe directo en el
 * estilo de la columna, un fotograma cada vez; React sólo se entera al soltar.
 * Abrir no anima el ancho (forzaría layout en cada fotograma): la columna toma su
 * sitio de golpe y lo de dentro entra (nova.css).
 */
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
	type ButtonHTMLAttributes,
	type KeyboardEvent as ReactKeyboardEvent,
	type PointerEvent as ReactPointerEvent,
	type ReactNode,
	type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "../ui/sheet";
import { NovaButton } from "./topbar";
import {
	DOCK_DEFAULT_WIDTH,
	DOCK_DESKTOP_QUERY,
	DOCK_KEY_STEP,
	NOVA_DOCK_KEY,
	clampWidth,
	conversationOf as savedConversation,
	cookieDomainFor,
	cookieString,
	dockWidthBounds,
	parsePrefs,
	readCookie,
	rememberConversation,
	serializePrefs,
	type DockPrefs,
} from "./nova-dock-state";

export interface DockAsk {
	id: string;
	text: string;
	workspaceId: string;
	conversationId: string;
}

export interface NovaDockApi {
	/** Abierta ahora: la columna en escritorio, la hoja por debajo de 1280px. */
	open: boolean;
	isDesktop: boolean;
	/** El ancho guardado; la columna lo ajusta a la ventana que haya. */
	width: number;
	/** Se acaba de abrir a mano: la columna anima la entrada (sólo esta vez). */
	animateOpen: boolean;
	setOpen: (open: boolean) => void;
	toggle: () => void;
	setWidth: (px: number) => void;
	conversationOf: (workspaceId: string) => string | null;
	setConversation: (workspaceId: string, conversationId: string) => void;
	startNew: (workspaceId: string) => string;
	ask: DockAsk | null;
	askNova: (workspaceId: string, text: string) => void;
	clearAsk: (id: string) => void;
	/** Sube cada vez que se abre a mano: el panel enfoca el campo cuando cambia. */
	focusSignal: number;
	/** El botón de la barra, para devolverle el foco con Escape. */
	buttonRef: RefObject<HTMLButtonElement | null>;
	/** El nodo que llena `NovaDockHost` y engancha `NovaDockColumn`. */
	host: HTMLDivElement | null;
}

const NovaDockContext = createContext<NovaDockApi | null>(null);

function loadPrefs(): DockPrefs {
	if (typeof window === "undefined") return parsePrefs(null);
	if (cookieDomainFor(window.location.hostname)) return parsePrefs(readCookie(document.cookie, NOVA_DOCK_KEY));
	try {
		return parsePrefs(window.localStorage.getItem(NOVA_DOCK_KEY));
	} catch {
		return parsePrefs(null);
	}
}

function savePrefs(prefs: DockPrefs): void {
	const value = serializePrefs(prefs);
	const domain = cookieDomainFor(window.location.hostname);
	if (domain) {
		document.cookie = cookieString(NOVA_DOCK_KEY, value, domain);
		return;
	}
	try {
		window.localStorage.setItem(NOVA_DOCK_KEY, value);
	} catch {
		/* modo privado estricto: se recuerda sólo en esta página */
	}
}

function subscribeDesktop(onChange: () => void): () => void {
	const media = window.matchMedia(DOCK_DESKTOP_QUERY);
	media.addEventListener("change", onChange);
	return () => media.removeEventListener("change", onChange);
}

function subscribeResize(onChange: () => void): () => void {
	window.addEventListener("resize", onChange);
	return () => window.removeEventListener("resize", onChange);
}

export function NovaDockProvider({ children }: { children: ReactNode }) {
	const [prefs, setPrefs] = useState<DockPrefs>(loadPrefs);
	const isDesktop = useSyncExternalStore(
		subscribeDesktop,
		() => window.matchMedia(DOCK_DESKTOP_QUERY).matches,
		() => false,
	);
	const [sheetOpen, setSheetOpen] = useState(false);
	const [animateOpen, setAnimateOpen] = useState(false);
	const [focusSignal, setFocusSignal] = useState(0);
	const [ask, setAsk] = useState<DockAsk | null>(null);
	const buttonRef = useRef<HTMLButtonElement | null>(null);
	const [host] = useState<HTMLDivElement | null>(() => {
		if (typeof document === "undefined") return null;
		const el = document.createElement("div");
		el.className = "nova-dock-body";
		return el;
	});

	// Guardar en cada cambio, menos el primero (lo que se acaba de leer).
	const first = useRef(true);
	useEffect(() => {
		if (first.current) {
			first.current = false;
			return;
		}
		savePrefs(prefs);
	}, [prefs]);

	// La entrada se anima una vez: al navegar después, la columna nueva aparece quieta.
	useEffect(() => {
		if (!animateOpen) return;
		const timer = window.setTimeout(() => setAnimateOpen(false), 260);
		return () => window.clearTimeout(timer);
	}, [animateOpen]);

	const open = isDesktop ? prefs.open : sheetOpen;

	const setOpen = useCallback(
		(next: boolean) => {
			if (next) setFocusSignal((n) => n + 1);
			if (!isDesktop) {
				setSheetOpen(next);
				return;
			}
			if (next) setAnimateOpen(true);
			setPrefs((p) => (p.open === next ? p : { ...p, open: next }));
		},
		[isDesktop],
	);

	const startNew = useCallback((workspaceId: string) => {
		const id = crypto.randomUUID();
		setPrefs((p) => rememberConversation(p, workspaceId, id));
		return id;
	}, []);

	const setConversation = useCallback((workspaceId: string, conversationId: string) => {
		setPrefs((p) => rememberConversation(p, workspaceId, conversationId));
	}, []);

	const askNova = useCallback(
		(workspaceId: string, text: string) => {
			const conversationId = startNew(workspaceId);
			setAsk({ id: crypto.randomUUID(), text, workspaceId, conversationId });
			setOpen(true);
		},
		[startNew, setOpen],
	);

	const clearAsk = useCallback((id: string) => setAsk((a) => (a?.id === id ? null : a)), []);
	const setWidth = useCallback((px: number) => setPrefs((p) => ({ ...p, width: clampWidth(px, window.innerWidth) })), []);

	const api = useMemo<NovaDockApi>(
		() => ({
			open,
			isDesktop,
			width: prefs.width,
			animateOpen,
			setOpen,
			toggle: () => setOpen(!open),
			setWidth,
			conversationOf: (workspaceId) => savedConversation(prefs, workspaceId),
			setConversation,
			startNew,
			ask,
			askNova,
			clearAsk,
			focusSignal,
			buttonRef,
			host,
		}),
		[open, isDesktop, prefs, animateOpen, setOpen, setWidth, setConversation, startNew, ask, askNova, clearAsk, focusSignal, host],
	);

	return <NovaDockContext.Provider value={api}>{children}</NovaDockContext.Provider>;
}

export function useNovaDock(): NovaDockApi {
	const api = useContext(NovaDockContext);
	if (!api) throw new Error("useNovaDock needs a NovaDockProvider above it");
	return api;
}

/** La columna de Nova a la derecha del marco, desde 1280px y con el panel abierto; si no, nada. */
export function NovaDockColumn() {
	const dock = useNovaDock();
	const viewport = useSyncExternalStore(
		subscribeResize,
		() => window.innerWidth,
		() => 1280,
	);
	const aside = useRef<HTMLElement | null>(null);
	const attached = useRef<HTMLDivElement | null>(null);
	const drag = useRef<{ startX: number; startWidth: number; last: number; frame: number } | null>(null);
	const [dragging, setDragging] = useState(false);

	const { min, max } = dockWidthBounds(viewport);
	const width = clampWidth(dock.width, viewport);

	// El hueco engancha el nodo del host. Al desmontar sólo lo suelta si sigue
	// siendo suyo: en la consola la columna de la página nueva puede haberlo
	// enganchado ya.
	const slot = useCallback(
		(el: HTMLDivElement | null) => {
			const host = dock.host;
			if (!host) return;
			if (el) {
				el.appendChild(host);
				attached.current = el;
			} else {
				if (attached.current && host.parentElement === attached.current) host.remove();
				attached.current = null;
			}
		},
		[dock.host],
	);

	if (!dock.isDesktop || !dock.open) return null;

	function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
		// Un solo puntero: un segundo dedo o botón a media operación no la reinicia.
		if (e.button !== 0 || drag.current) return;
		e.preventDefault();
		e.currentTarget.setPointerCapture(e.pointerId);
		drag.current = { startX: e.clientX, startWidth: width, last: width, frame: 0 };
		setDragging(true);
		document.documentElement.classList.add("nova-dock-dragging");
	}

	function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
		const d = drag.current;
		if (!d) return;
		// El panel está a la derecha: llevar el asa hacia la izquierda lo ensancha.
		d.last = clampWidth(d.startWidth + (d.startX - e.clientX), window.innerWidth);
		if (d.frame) return;
		d.frame = requestAnimationFrame(() => {
			const current = drag.current;
			if (!current) return;
			current.frame = 0;
			if (aside.current) aside.current.style.width = `${current.last}px`;
		});
	}

	function endDrag() {
		const d = drag.current;
		if (!d) return;
		if (d.frame) cancelAnimationFrame(d.frame);
		drag.current = null;
		setDragging(false);
		document.documentElement.classList.remove("nova-dock-dragging");
		dock.setWidth(d.last);
	}

	function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
		const next =
			e.key === "ArrowLeft" ? width + DOCK_KEY_STEP : e.key === "ArrowRight" ? width - DOCK_KEY_STEP : e.key === "Home" ? max : e.key === "End" ? min : null;
		if (next === null) return;
		e.preventDefault();
		dock.setWidth(clampWidth(next, viewport));
	}

	return (
		<aside ref={aside} className="nova-dock" style={{ width }} aria-label="Nova" data-animate={dock.animateOpen ? "" : undefined}>
			<div
				role="separator"
				tabIndex={0}
				aria-orientation="vertical"
				aria-label="Resize Nova"
				aria-valuenow={width}
				aria-valuemin={min}
				aria-valuemax={max}
				className="nova-dock-handle"
				data-dragging={dragging ? "" : undefined}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={endDrag}
				onPointerCancel={endDrag}
				onLostPointerCapture={endDrag}
				onDoubleClick={() => dock.setWidth(DOCK_DEFAULT_WIDTH)}
				onKeyDown={onKeyDown}
			/>
			<div ref={slot} className="flex min-h-0 flex-1 flex-col" />
		</aside>
	);
}

/**
 * Donde vive el panel. Montarlo UNA vez, en algo que no se desmonte al navegar.
 * No monta nada hasta que Nova se abre por primera vez (o la cookie la trae
 * abierta): abrir un WebSocket por cada página vista sería pagar por nada.
 */
export function NovaDockHost({ children }: { children: ReactNode }) {
	const dock = useNovaDock();
	const [activated, setActivated] = useState(dock.open);
	useEffect(() => {
		if (dock.open) setActivated(true);
	}, [dock.open]);
	if (!activated) return null;
	if (dock.isDesktop) return dock.host ? createPortal(children, dock.host) : null;
	return (
		<Sheet open={dock.open} onOpenChange={dock.setOpen}>
			<SheetContent
				showCloseButton={false}
				className="nova-sheet sk flex h-full w-full flex-col gap-0 bg-(--sk-surface) p-0 shadow-(--sk-shadow-3) max-sm:rounded-none! sm:max-w-[34rem]">
				<SheetTitle className="sr-only">Nova</SheetTitle>
				<SheetDescription className="sr-only">Ask Nova about this workspace.</SheetDescription>
				{children}
			</SheetContent>
		</Sheet>
	);
}

/** El botón Nova de la barra: abre y cierra el panel, y dice si está abierto. */
export function NovaDockButton(props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "aria-pressed">) {
	const dock = useNovaDock();
	return <NovaButton ref={dock.buttonRef} {...props} aria-pressed={dock.open} onClick={dock.toggle} />;
}

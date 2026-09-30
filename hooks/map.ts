/**
 * Los hooks de las piezas de consola (`components/console-kit.tsx`), iguales
 * que en `ondesk/src/features/frontend/hooks.ts`: el reloj del horario, el
 * aviso que se apaga solo, el cierre de un panel flotante, el salto a una parada
 * y la anchura estrecha.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/**
 * El reloj del horario en milisegundos, leído de `--clock` para que ningún
 * intervalo de JavaScript pueda desviarse del que usa el CSS. 12 s si todavía
 * no hay DOM.
 */
export function useClockMs(): number {
	const [ms] = useState(() => {
		if (typeof document === "undefined") return 12000;
		const raw = getComputedStyle(document.documentElement).getPropertyValue("--clock").trim();
		const value = parseFloat(raw);
		if (!Number.isFinite(value) || value <= 0) return 12000;
		return raw.endsWith("ms") ? value : value * 1000;
	});
	return ms;
}

/**
 * Un aviso que se enciende y se apaga solo: el «Saved.» junto al botón de un
 * panel. Dura un tercio del reloj (4 s) y un segundo guardado lo reinicia.
 */
export function useFlash(): [boolean, () => void] {
	const clock = useClockMs();
	const [on, setOn] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(
		() => () => {
			if (timer.current) clearTimeout(timer.current);
		},
		[],
	);

	const flash = useCallback(() => {
		setOn(true);
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(() => setOn(false), clock / 3);
	}, [clock]);

	return [on, flash];
}

/**
 * Cierra un panel flotante (menú, selector) con un clic fuera o con Escape, y
 * devuelve el foco al botón que lo abrió cuando se cierra con el teclado.
 */
export function useDismiss(
	open: boolean,
	container: RefObject<HTMLElement | null>,
	trigger: RefObject<HTMLElement | null>,
	close: () => void,
): void {
	useEffect(() => {
		if (!open) return;
		const onDown = (e: MouseEvent) => {
			if (container.current && !container.current.contains(e.target as Node)) close();
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				close();
				trigger.current?.focus();
			}
		};
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [open, container, trigger, close]);
}

/**
 * Lleva a la parada que nombra la URL una vez que existe: `#members` o, para
 * una ruta vieja que ahora es una parada de otra hoja, la que se pasa como
 * `fallback`.
 */
export function useScrollToStop(ready: boolean, fallback?: string): void {
	const done = useRef(false);
	useEffect(() => {
		if (!ready || done.current) return;
		const hash = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
		const id = hash || fallback;
		if (!id) return;
		done.current = true;
		requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
	}, [ready, fallback]);
}

/** `true` por debajo de la anchura dada; se reevalúa al redimensionar. */
export function useNarrow(query = "(max-width: 47.9rem)"): boolean {
	const [narrow, setNarrow] = useState(() => (typeof window !== "undefined" ? window.matchMedia(query).matches : false));
	useEffect(() => {
		const mq = window.matchMedia(query);
		const onChange = () => setNarrow(mq.matches);
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, [query]);
	return narrow;
}

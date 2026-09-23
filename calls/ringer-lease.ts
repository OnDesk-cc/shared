import { useEffect, useRef, useState } from "react";

/**
 * Un solo tono de llamada por navegador, por muchas pestañas de OnDesk que haya
 * abiertas.
 *
 * El shell de cada producto oye el mismo timbre — para eso está el socket
 * compartido — así que alguien con Nexus, Halo, Orbit y la consola abiertos oía
 * el tono cuatro veces. Las tarjetas deben mostrarse en todas partes; el SONIDO
 * debe salir de un solo sitio: la pestaña en la que la persona está de verdad, o
 * una pestaña cualquiera cuando no está en ninguna.
 *
 * ─── Una cookie, porque las pestañas están en orígenes distintos ─────────────
 *
 * `BroadcastChannel` y `localStorage` son por origen, y `nexus.ondesk.cc` y
 * `halo.ondesk.cc` son dos. Una cookie en `.ondesk.cc` es lo único que la página
 * de cada producto puede leer y escribir, y tiene justo el tamaño necesario para
 * esto: el id de la pestaña que está sonando, su reclamación de la tarea, y una
 * vida corta para que la reclamación de una pestaña cerrada caduque sola. Nada de
 * esto es para un servidor — la cookie es `Path=/`, así que sí viaja en cada
 * petición, y ocupa unas pocas decenas de bytes; el prefijo `od_` deja claro en
 * un depurador que es nuestra.
 *
 * ─── La elección ─────────────────────────────────────────────────────────────
 *
 * Cada pestaña que tiene un timbre en pantalla hace un tic varias veces por
 * segundo. Cada una calcula su propia reclamación — pestaña con foco 3, pestaña
 * visible 2, pestaña oculta 1, oculta y rechazada por el autoplay 0 —, lee la
 * cookie, y toma el lease cuando no hay titular o cuando su reclamación supera la
 * del titular; el titular refresca la cookie en cada tic. Una pestaña que perdió
 * se calla en su siguiente tic. Así el sonido sigue a la persona: entra en otro
 * producto a mitad del timbre y el tono se muda allí. Los cambios de foco y de
 * visibilidad vuelven a lanzar el tic en el acto en vez de esperar al siguiente.
 *
 * Dos pestañas ocultas que vean a la vez que no hay titular reclamarían las dos;
 * el breve retardo aleatorio antes de una reclamación de baja prioridad hace que
 * eso sea raro, y el siguiente tic lo resuelve en cualquier caso — gana el último
 * que escribe, la otra lee un id ajeno y para. Una pestaña a la que el navegador
 * no deja reproducir (ver ring-tone.tsx) lo dice con la reclamación más baja, así
 * que una pestaña que SÍ puede sonar toma el relevo de una que sólo muestra el
 * botón «Turn on sound» — salvo que la pestaña rechazada sea la que la persona
 * está mirando, donde ese botón es justo lo que hay que mostrar.
 */

const COOKIE = "od_ringer";
/** Cada cuánto vuelve a leer el lease cada pestaña que está sonando. */
const TICK_MS = 400;
/** Cuánto vive una reclamación sin refrescarse. En segundos enteros: son cookies. */
const TTL_SECONDS = 3;
/** Tope del retardo aleatorio antes de que una pestaña oculta reclame. */
const CLAIM_JITTER_MS = 250;

/** Esta pestaña, durante toda la vida de la página. */
const TAB_ID = (() => {
	try {
		return crypto.randomUUID();
	} catch {
		return Math.random().toString(36).slice(2);
	}
})();

interface Holder {
	id: string;
	priority: number;
}

/** `.ondesk.cc` para cada host de producto; sin fijar (sólo el host) en localhost. */
function cookieDomain(): string | null {
	const host = window.location.hostname;
	return host === "ondesk.cc" || host.endsWith(".ondesk.cc") ? ".ondesk.cc" : null;
}

function readHolder(): Holder | null {
	const entry = document.cookie.split("; ").find((part) => part.startsWith(`${COOKIE}=`));
	if (!entry) return null;
	const [id, priority] = decodeURIComponent(entry.slice(COOKIE.length + 1)).split(":");
	const parsed = Number(priority);
	return id && Number.isFinite(parsed) ? { id, priority: parsed } : null;
}

function writeHolder(priority: number, ttlSeconds: number = TTL_SECONDS): void {
	const domain = cookieDomain();
	const secure = window.location.protocol === "https:" ? "; Secure" : "";
	document.cookie =
		`${COOKIE}=${encodeURIComponent(`${TAB_ID}:${priority}`)}; Max-Age=${ttlSeconds}; Path=/; SameSite=Lax` +
		`${domain ? `; Domain=${domain}` : ""}${secure}`;
}

/** Suelta el lease, pero sólo si es nuestro — nunca el de otra pestaña. */
function releaseIfMine(): void {
	if (readHolder()?.id === TAB_ID) writeHolder(0, 0);
}

function claimOf(blocked: boolean): number {
	const visible = document.visibilityState === "visible";
	if (visible && document.hasFocus()) return 3;
	if (visible) return 2;
	return blocked ? 0 : 1;
}

/**
 * Si ESTA pestaña debe hacer sonar el timbre entrante ahora mismo.
 *
 * `ringing` es «hay un timbre en pantalla aquí»; `blocked` es el rechazo del
 * autoplay que ring-tone.tsx ya sigue. Devuelve false en cuanto termina el timbre
 * u otra pestaña toma el lease.
 *
 * `held` se reinicia en cada cambio de `ringing`, durante el render — el patrón
 * del propio React para un estado que sigue a una prop — así que el cuerpo del
 * efecto no escribe estado (la regla de lint que mantiene este repo) y un «held»
 * rancio del timbre anterior nunca puede colar una ráfaga de sonido en el
 * siguiente antes de que haya corrido su primer tic.
 */
export function useRingerLease(ringing: boolean, blocked: boolean): boolean {
	const [held, setHeld] = useState(false);
	const [wasRinging, setWasRinging] = useState(ringing);
	if (ringing !== wasRinging) {
		setWasRinging(ringing);
		setHeld(false);
	}
	// Se lee dentro del tic sin volver a armar el intervalo en cada cambio.
	const blockedRef = useRef(blocked);
	useEffect(() => {
		blockedRef.current = blocked;
	}, [blocked]);

	useEffect(() => {
		if (!ringing) return;

		let claimTimer: number | undefined;

		const tick = () => {
			const mine = claimOf(blockedRef.current);
			const holder = readHolder();

			if (holder !== null && holder.id !== TAB_ID && mine <= holder.priority) {
				// Otra pestaña lo tiene, con un motivo al menos igual de bueno. Silencio.
				if (claimTimer !== undefined) {
					window.clearTimeout(claimTimer);
					claimTimer = undefined;
				}
				setHeld(false);
				return;
			}

			if (holder === null && mine < 2) {
				// Nadie lo tiene y no somos la pestaña que la persona está mirando:
				// esperar un momento antes de reclamar, para que varias pestañas
				// ocultas no lo cojan todas en el mismo tic. Una pestaña con foco o
				// visible reclama en el acto.
				if (claimTimer === undefined) {
					claimTimer = window.setTimeout(() => {
						claimTimer = undefined;
						if (readHolder() === null) {
							writeHolder(claimOf(blockedRef.current));
							setHeld(true);
						}
					}, Math.random() * CLAIM_JITTER_MS);
				}
				return;
			}

			// Nuestro — recién tomado, o refrescado por unos segundos más.
			writeHolder(mine);
			setHeld(true);
		};

		// La primera decisión llega un instante después y no en el cuerpo del
		// efecto — un temporizador, como todas las siguientes, para que el propio
		// cuerpo no escriba estado.
		const first = window.setTimeout(tick, 0);
		const interval = window.setInterval(tick, TICK_MS);
		// La persona se ha movido: decidir otra vez ahora, no dentro de hasta 400 ms.
		window.addEventListener("focus", tick);
		window.addEventListener("blur", tick);
		document.addEventListener("visibilitychange", tick);
		// Una pestaña que se va les pasa el sonido a las demás en el acto.
		window.addEventListener("pagehide", releaseIfMine);

		return () => {
			window.clearTimeout(first);
			window.clearInterval(interval);
			if (claimTimer !== undefined) window.clearTimeout(claimTimer);
			window.removeEventListener("focus", tick);
			window.removeEventListener("blur", tick);
			document.removeEventListener("visibilitychange", tick);
			window.removeEventListener("pagehide", releaseIfMine);
			releaseIfMine();
		};
	}, [ringing]);

	return ringing && held;
}

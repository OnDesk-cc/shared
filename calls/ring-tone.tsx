import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { Button } from "../ui/button";
import { useRingerLease } from "./ringer-lease";

/**
 * Los dos tonos de llamada. Se sirven tal cual desde `public/`, así que cambiar
 * un sonido es dejar otro archivo en `nexus/public/sounds/` con el mismo nombre
 * — ver el README de allí.
 * ▸ Hoy: este componente vive en `shared` y lo montan los seis productos y
 * ondesk; cada uno sirve su propia copia desde su `public/sounds/`, así que
 * cambiar un sonido es cambiar el archivo en los siete.
 */
const INCOMING_SOUND = "/sounds/ringtone-in.mp3";
const OUTGOING_SOUND = "/sounds/ringtone-out.mp3";
/** Un timbre entrante tiene que oírse desde el otro lado de la sala; uno saliente es sólo feedback. */
const INCOMING_VOLUME = 0.8;
const OUTGOING_VOLUME = 0.45;

export type RingMode = "in" | "out" | null;

/**
 * Dos elementos, montados durante toda la vida del shell, uno reproduciéndose
 * mientras algo suena: el tono entrante cuando alguien te llama, el saliente mientras
 * suena tu propia llamada. Se pausan y se rebobinan entre timbres para que cada
 * archivo se descargue y se decodifique una sola vez, al cargar, y no en el
 * momento en que alguien llama.
 *
 * «Durante toda la vida del shell» es una condición de la que depende todo, y
 * mantenerla cierta es trabajo del overlay: esto antes estaba dentro del
 * `return null` temprano del overlay, lo que significaba que los elementos se
 * creaban en el momento del timbre y se destruían después — así que nunca se
 * precargaba nada, y nada de lo que sigue podría haber funcionado jamás.
 *
 * ─── Autoplay, y por qué un timbre puede sonar sin que nadie pulse nada ───────
 *
 * Un tono de llamada es justo el caso para el que existe la política de
 * autoplay: sonido en una pestaña en la que la persona no acaba de hacer clic.
 * Todos los navegadores rechazan `play()` hasta que la página ha visto un gesto
 * del usuario, y Safari va más allá — es el ELEMENTO el que tiene que haberse
 * reproducido desde un gesto, no la página. Así que cada elemento se desbloquea
 * solo con el primer gesto que vea el documento, sea cuando sea: un `play()`
 * silenciado seguido de un `pause()`, dentro del handler del evento, que es la
 * forma que aceptan los tres motores y que nadie oye. Un timbre una hora después
 * es entonces un simple `play()` sobre un elemento del que el navegador ya se
 * fía. Cualquier clic en el shell cuenta — abrir una conversación, poner el foco
 * en el cuadro de redacción — y por eso esto no necesita un botón propio ni un
 * aviso de permiso.
 *
 * Lo que no puede hacer es sonar en una pestaña que se cargó y nunca se tocó, y
 * para eso está la alternativa de abajo: cuando se rechaza `play()` el timbre se
 * sigue mostrando — la tarjeta es la señal principal, el sonido la secundaria —
 * y se ofrece un control «Turn on sound». El siguiente gesto en cualquier sitio,
 * sea ese botón o no, vuelve a reproducir el tono de forma síncrona dentro del
 * gesto, porque en Safari un reintento programado desde una actualización de
 * estado puede caer fuera de la ventana en la que el clic todavía cuenta.
 *
 * Sólo el rechazo recibe el botón. Un archivo que falta también rechaza, y
 * ofrecer un botón que no hace nada dos veces es peor que el silencio.
 *
 * ─── Una sola pestaña hace sonar el timbre entrante ──────────────────────────
 *
 * La tarjeta se dibuja en cada pestaña de OnDesk que la persona tenga abierta;
 * el tono sale de una de ellas — aquella en la que está, o cualquiera cuando no
 * está en ninguna. Esa elección es `useRingerLease` (una cookie en `.ondesk.cc`,
 * porque las pestañas están en orígenes distintos), y decide sólo el bucle
 * ENTRANTE: el tono saliente ya suena en un único sitio, la pestaña desde la que
 * se hizo la llamada. Una pestaña que pierde el lease conserva la tarjeta y no
 * muestra botón.
 */
export function RingTone({ mode }: { mode: RingMode }) {
	const [blocked, setBlocked] = useState(false);
	const [attempt, setAttempt] = useState(0);
	const audible = useRingerLease(mode === "in", blocked);

	// Estables, para que los efectos de los bucles dependan de lo que de verdad
	// cambió y no vuelvan a ejecutar play()/pause() en cada render del overlay.
	const onBlocked = useCallback(() => setBlocked(true), []);
	const onUnblocked = useCallback(() => setBlocked(false), []);

	return (
		<>
			<Loop
				src={INCOMING_SOUND}
				volume={INCOMING_VOLUME}
				active={mode === "in" && audible}
				attempt={attempt}
				onBlocked={onBlocked}
				onUnblocked={onUnblocked}
			/>
			<Loop
				src={OUTGOING_SOUND}
				volume={OUTGOING_VOLUME}
				active={mode === "out"}
				attempt={attempt}
				onBlocked={onBlocked}
				onUnblocked={onUnblocked}
			/>
			{mode !== null && blocked && (mode === "out" || audible) && (
				<Button
					size="sm"
					variant="outline"
					className="rounded-none gap-1.5"
					onClick={() => {
						setBlocked(false);
						setAttempt((current) => current + 1);
					}}
				>
					<Volume2 className="size-3.5" />
					Turn on sound
				</Button>
			)}
		</>
	);
}

/** Los gestos que un navegador cuenta como activación del usuario. En fase de captura, para que un handler que detenga la propagación no pueda ocultar ninguno. */
const GESTURES: (keyof WindowEventMap)[] = ["pointerdown", "keydown"];

function Loop({
	src,
	volume,
	active,
	attempt,
	onBlocked,
	onUnblocked,
}: {
	src: string;
	volume: number;
	active: boolean;
	attempt: number;
	onBlocked: () => void;
	onUnblocked: () => void;
}) {
	const ref = useRef<HTMLAudioElement>(null);
	// Lo que lee el handler del gesto, porque se engancha una sola vez y `active`
	// cambia por debajo. Se escribe desde un efecto, nunca durante el render.
	const activeRef = useRef(active);
	useEffect(() => {
		activeRef.current = active;
	}, [active]);
	/** Si este elemento ya se ha reproducido desde un gesto. Con una vez basta. */
	const primedRef = useRef(false);

	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		element.volume = volume;

		if (!active) {
			element.pause();
			element.currentTime = 0;
			return;
		}

		void element.play().catch((error: unknown) => {
			if (error instanceof DOMException && error.name === "NotAllowedError") {
				onBlocked();
				return;
			}
			console.warn(`Could not play ${src}`, error);
		});
	}, [active, attempt, src, volume, onBlocked]);

	useEffect(() => {
		const element = ref.current;
		if (!element) return;

		const onGesture = () => {
			if (activeRef.current) {
				// Sonando, y en pausa: el navegador nos rechazó y este clic es el
				// gesto que estaba esperando. Reproducir YA, dentro del handler.
				if (element.paused) void element.play().then(onUnblocked).catch(() => {});
				primedRef.current = true;
				return;
			}
			if (primedRef.current) return;
			primedRef.current = true;

			// En reposo: desbloquear el elemento para después sin que nadie lo oiga.
			// Silenciado y no a volumen 0, porque iOS ignora el volumen. Se le quita
			// el silencio en cuanto el navegador ha respondido, en un sentido u otro.
			element.muted = true;
			element
				.play()
				.then(() => {
					// Puede que haya empezado un timbre mientras esto estaba en vuelo;
					// si es así está sonando (silenciado, un instante) y no hay que
					// pausarlo por debajo.
					if (!activeRef.current) {
						element.pause();
						element.currentTime = 0;
					}
				})
				.catch(() => {
					// Rechazado incluso desde un gesto, o no hay archivo. Queda el camino
					// del momento del timbre y su botón; aquí no hay nada que decir.
					primedRef.current = false;
				})
				.finally(() => {
					element.muted = false;
				});
		};

		for (const type of GESTURES) window.addEventListener(type, onGesture, { capture: true });
		return () => {
			for (const type of GESTURES) window.removeEventListener(type, onGesture, { capture: true });
		};
	}, [onUnblocked]);

	return <audio ref={ref} src={src} loop preload="auto" />;
}

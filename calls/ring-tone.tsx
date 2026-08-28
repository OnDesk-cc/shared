import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { Button } from "../ui/button";
import { useRingerLease } from "./ringer-lease";

/**
 * The two ringtones. Served straight from `public/`, so replacing a sound is
 * dropping a different file at `nexus/public/sounds/` under the same name — see
 * the README there.
 */
const INCOMING_SOUND = "/sounds/ringtone-in.mp3";
const OUTGOING_SOUND = "/sounds/ringtone-out.mp3";
/** An incoming ring has to be heard across a room; an outgoing one is feedback. */
const INCOMING_VOLUME = 0.8;
const OUTGOING_VOLUME = 0.45;

export type RingMode = "in" | "out" | null;

/**
 * Two elements, mounted for the life of the shell, one playing while something
 * rings: the incoming tone when somebody is calling you, the outgoing one while
 * your own call rings. Paused and rewound between rings so each file is fetched
 * and decoded once, at load, not at the moment somebody calls.
 *
 * "For the life of the shell" is load-bearing and is the overlay's job to keep
 * true: this used to sit inside the overlay's early `return null`, which meant
 * the elements were created at the moment of the ring and destroyed after it —
 * so nothing was ever preloaded, and nothing below could ever have worked.
 *
 * ─── Autoplay, and why a ring can sound without anybody pressing anything ─────
 *
 * A ringtone is the case autoplay policy exists for: sound in a tab the person
 * has not just clicked in. Every browser refuses `play()` until the page has
 * seen a user gesture, and Safari goes further — it is the ELEMENT that has to
 * have been played from a gesture, not the page. So each element unlocks itself
 * on the first gesture the document sees, whenever that is: a muted `play()`
 * followed by a `pause()`, inside the event handler, which is the shape all
 * three engines accept and which nobody hears. A ring an hour later is then a
 * plain `play()` on an element the browser already trusts. Any click in the
 * shell counts — opening a conversation, focusing the composer — which is why
 * this needs no button of its own and no permission prompt.
 *
 * What it cannot do is ring a tab that has been loaded and never touched, and
 * that is what the fallback below is for: when `play()` is refused the ring
 * still shows — the card is the primary signal, the sound the second — and a
 * "Turn on sound" control is offered. The very next gesture anywhere, that
 * button or not, replays the tone synchronously inside the gesture, because in
 * Safari a retry scheduled from a state update can land outside the window in
 * which the click still counts.
 *
 * Only the refusal gets the button. A missing file rejects too, and offering a
 * button that does nothing twice is worse than silence.
 *
 * ─── One tab sounds the incoming ring ────────────────────────────────────────
 *
 * The card is drawn in every OnDesk tab the person has open; the tone comes
 * from one of them — the one they are in, or any one when they are in none.
 * That election is `useRingerLease` (a cookie on `.ondesk.cc`, since the tabs
 * are on different origins), and it decides only the INCOMING loop: the
 * outgoing tone already plays in exactly one place, the tab the call was placed
 * from. A tab that loses the lease keeps the card and shows no button.
 */
export function RingTone({ mode }: { mode: RingMode }) {
	const [blocked, setBlocked] = useState(false);
	const [attempt, setAttempt] = useState(0);
	const audible = useRingerLease(mode === "in", blocked);

	// Stable, so the loops' effects depend on what actually changed rather than
	// re-running play()/pause() on every render of the overlay.
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

/** The gestures a browser counts as user activation. Capture phase, so a handler that stops propagation cannot hide one. */
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
	// What the gesture handler reads, since it is attached once and `active`
	// changes under it. Written from an effect, never during render.
	const activeRef = useRef(active);
	useEffect(() => {
		activeRef.current = active;
	}, [active]);
	/** Whether this element has been played from a gesture yet. Once is enough. */
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
				// Ringing, and paused: the browser refused us and this click is the
				// gesture it was waiting for. Play NOW, inside the handler.
				if (element.paused) void element.play().then(onUnblocked).catch(() => {});
				primedRef.current = true;
				return;
			}
			if (primedRef.current) return;
			primedRef.current = true;

			// Idle: unlock the element for later without anybody hearing it. Muted
			// rather than volume 0, because iOS ignores volume. Unmuted again once
			// the browser has answered either way.
			element.muted = true;
			element
				.play()
				.then(() => {
					// A ring may have started while this was in flight; if so it is
					// playing (muted, briefly) and must not be paused from under it.
					if (!activeRef.current) {
						element.pause();
						element.currentTime = 0;
					}
				})
				.catch(() => {
					// Refused even from a gesture, or no file. The ring-time path and
					// its button remain; nothing to say here.
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

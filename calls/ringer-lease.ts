import { useEffect, useRef, useState } from "react";

/**
 * One ringtone per browser, however many OnDesk tabs are open.
 *
 * Every product's shell hears the same ring — that is the point of the shared
 * socket — so somebody with Nexus, Halo, Orbit and the console open heard the
 * tone four times over. The cards should show everywhere; the SOUND should come
 * from one place: the tab the person is actually in, or any one tab when they
 * are in none of them.
 *
 * ─── A cookie, because the tabs are on different origins ─────────────────────
 *
 * `BroadcastChannel` and `localStorage` are per origin, and `nexus.ondesk.cc`
 * and `halo.ondesk.cc` are two. A cookie on `.ondesk.cc` is the one thing every
 * product's page can read and write, and it is exactly big enough for this: the
 * id of the tab that is ringing, its claim to the job, and a short life so a
 * closed tab's claim expires on its own. Nothing here goes to a server — the
 * cookie is `Path=/`, so it does ride every request, and it is a few dozen
 * bytes; the `od_` prefix keeps it clearly ours in a debugger.
 *
 * ─── The election ────────────────────────────────────────────────────────────
 *
 * Every tab that has a ring on screen ticks a few times a second. Each computes
 * its own claim — focused tab 3, visible tab 2, hidden tab 1, hidden and
 * refused by autoplay 0 — reads the cookie, and takes the lease when there is
 * no holder or when its claim beats the holder's; the holder refreshes the
 * cookie on every tick. A tab that lost goes silent on its next tick. So the
 * sound follows the person: click into another product mid-ring and the tone
 * moves there. Focus and visibility changes re-run the tick at once rather
 * than waiting for the next one.
 *
 * Two hidden tabs seeing no holder at the same instant would both claim; the
 * short random delay before a low-priority claim makes that rare, and the next
 * tick settles it in any case — last writer wins, the other reads a foreign id
 * and stops. A tab the browser refuses to let play (see ring-tone.tsx) says so
 * with the lowest claim, so a tab that CAN sound takes over from one that only
 * shows the "Turn on sound" button — unless the refused tab is the one the
 * person is looking at, where that button is the right thing to show.
 */

const COOKIE = "od_ringer";
/** How often every ringing tab re-reads the lease. */
const TICK_MS = 400;
/** How long a claim lives without being refreshed. Whole seconds: cookies. */
const TTL_SECONDS = 3;
/** Upper bound on the random delay before a hidden tab claims. */
const CLAIM_JITTER_MS = 250;

/** This tab, for the life of the page. */
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

/** `.ondesk.cc` for every product host; unset (host-only) on localhost. */
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

/** Drops the lease, but only if it is ours — never another tab's. */
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
 * Whether THIS tab should sound the incoming ring right now.
 *
 * `ringing` is "a ring is on screen here"; `blocked` is the autoplay refusal
 * ring-tone.tsx already tracks. Returns false the moment the ring ends or
 * another tab takes the lease.
 *
 * `held` is reset on every change of `ringing`, during render — React's own
 * pattern for state that follows a prop — so the effect body writes no state
 * (the lint rule this repo keeps) and a stale "held" from the previous ring can
 * never leak a burst of sound into the next one before its first tick has run.
 */
export function useRingerLease(ringing: boolean, blocked: boolean): boolean {
	const [held, setHeld] = useState(false);
	const [wasRinging, setWasRinging] = useState(ringing);
	if (ringing !== wasRinging) {
		setWasRinging(ringing);
		setHeld(false);
	}
	// Read inside the tick without re-arming the interval on every change.
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
				// Somebody else has it and has at least as good a reason. Quiet.
				if (claimTimer !== undefined) {
					window.clearTimeout(claimTimer);
					claimTimer = undefined;
				}
				setHeld(false);
				return;
			}

			if (holder === null && mine < 2) {
				// Nobody holds it and we are not the tab the person is looking at:
				// wait a moment before claiming, so several hidden tabs do not all
				// grab it in the same tick. A focused or visible tab claims at once.
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

			// Ours — freshly taken, or refreshed for another few seconds.
			writeHolder(mine);
			setHeld(true);
		};

		// The first decision is a moment away rather than in the effect body — a
		// timer, like every later one, so the body itself writes no state.
		const first = window.setTimeout(tick, 0);
		const interval = window.setInterval(tick, TICK_MS);
		// The person moved: re-decide now, not in up to 400 ms.
		window.addEventListener("focus", tick);
		window.addEventListener("blur", tick);
		document.addEventListener("visibilitychange", tick);
		// A tab going away hands the sound to the others straight away.
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

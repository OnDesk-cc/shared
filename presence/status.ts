import { Circle, Clock, MinusCircle, EyeOff, type LucideIcon } from "lucide-react";

/**
 * The presence vocabulary.
 *
 * Presence is the one platform fact this product does NOT mirror. Names,
 * avatars, memberships, seats and permissions are copied into nexus-db and kept
 * in step by webhook and reconcile; where somebody is right now changes every
 * minute by construction, so a copy of it would be wrong most of the time. The
 * browser asks ondesk directly instead — see ./presence-api.ts.
 *
 * This file mirrors `ondesk/functions/_lib/types/presence.ts`, and an identical
 * copy lives in each of the four products: the same deliberate duplication as
 * `email.ts`, `crypto.ts` and `notify.ts`. Nothing is shared between these
 * repositories and a status vocabulary is not the thing to start with — it is
 * four labels and one colour each, and the five bundles ship independently.
 * When one moves, grep for `PresenceStatus` in all five.
 */

/** What a person may choose. */
export type PresenceStatus = "online" | "away" | "busy" | "invisible";

/** What everyone else sees. `invisible` never appears here — that is the point. */
export type EffectiveStatus = "online" | "away" | "busy" | "offline";

/**
 * What a person is DOING, as opposed to what they chose. Reported by a Halo room
 * while its socket is up; the server shows it as `busy` with this attached as
 * the reason, and drops it on its own when the room stops reporting. The choice
 * underneath is never touched, which is why "back to normal after the meeting"
 * needs no code at all.
 */
export type PresenceActivity = "meeting";

/**
 * What somebody's working hours say about this minute.
 *
 * Not a status and not an activity: a status is chosen, an activity is asserted
 * by a client, and this is derived from a week stored against the membership —
 * see ondesk's `workspace_members.shift_*` and `_lib/shifts.ts`. It never
 * overrides the status, and nothing here has to be asked for separately: the
 * roster resolves it per request and puts it on the wire.
 *
 * `changes_at` is when the answer stops being true — the end of the window they
 * are in, or the start of the next one — which is what lets a client say "back
 * tomorrow at 09:00" without a second round trip. It is an instant, so it is
 * rendered in the READER's zone: their question is when they can expect a reply.
 */
export interface ShiftState {
	on: boolean;
	changes_at: number | null;
}

export interface PublicPresence {
	user_id: string;
	status: EffectiveStatus;
	/** Null when nobody has ever seen them, and null when they chose not to be seen. */
	last_seen_at: number | null;
	/** Only ever set alongside `status: "busy"` — the reason for it. */
	activity: PresenceActivity | null;
	/**
	 * Their working hours, resolved. Null when they have set none, which is most
	 * people; **optional** because the field arrived in ondesk before this package
	 * did, and a product still on an older build must keep compiling against a
	 * roster that carries it.
	 */
	shift?: ShiftState | null;
}

export interface OwnPresence {
	user_id: string;
	/** The choice — what the switcher ticks. */
	status: PresenceStatus;
	/** What that choice currently makes you to everyone else. */
	effective: EffectiveStatus;
	last_seen_at: number;
	/** What is overriding the choice right now, if anything. */
	activity: PresenceActivity | null;
}

interface StatusMeta {
	label: string;
	/** One line, in the menu, saying what picking this does to other people. */
	description: string;
	icon: LucideIcon;
	/** Tailwind background for the dot. */
	dot: string;
}

export const STATUS_META: Record<PresenceStatus | "offline", StatusMeta> = {
	online: {
		label: "Online",
		description: "Available across OnDesk",
		icon: Circle,
		dot: "bg-emerald-500",
	},
	away: {
		label: "Away",
		description: "Here, but not at your desk",
		icon: Clock,
		dot: "bg-amber-500",
	},
	busy: {
		label: "Busy",
		description: "Around, but ask before interrupting",
		icon: MinusCircle,
		dot: "bg-rose-500",
	},
	invisible: {
		label: "Invisible",
		description: "Appear offline. Your last seen is hidden too",
		icon: EyeOff,
		dot: "bg-muted-foreground",
	},
	offline: {
		label: "Offline",
		description: "Not connected",
		icon: Circle,
		dot: "bg-muted-foreground",
	},
};

/** The four the switcher offers, in the order it offers them. */
export const CHOOSABLE_STATUSES: PresenceStatus[] = ["online", "away", "busy", "invisible"];

/** The words for what somebody is doing. Not choosable; the dot stays `busy`'s. */
export const ACTIVITY_META: Record<PresenceActivity, { label: string }> = {
	meeting: { label: "In meeting" },
};

/**
 * The state as one label: "Busy · In meeting" for somebody in a room, the plain
 * status label for everybody else. Use this wherever a status label is shown to
 * other people, so a meeting reads as a meeting and not as an unexplained Busy.
 */
export function presenceLabel(presence: Pick<PublicPresence, "status" | "activity">): string {
	const base = STATUS_META[presence.status].label;
	return presence.activity ? `${base} · ${ACTIVITY_META[presence.activity].label}` : base;
}

/**
 * "5m ago" / "3h ago" / "2d ago", then a date.
 *
 * Never says "online" and never guesses: a null timestamp returns null and the
 * caller decides what to render instead. Null means one of two things that are
 * meant to be indistinguishable — never seen, or chose not to be seen — so
 * inventing a label here would be inventing an answer to which.
 */
export function lastSeenLabel(lastSeenAt: number | null | undefined): string | null {
	if (lastSeenAt == null || lastSeenAt <= 0) return null;
	const seconds = Math.max(0, Math.floor(Date.now() / 1000) - lastSeenAt);
	if (seconds < 3_600) return `${Math.max(1, Math.floor(seconds / 60))}m ago`;
	if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h ago`;
	if (seconds < 7 * 86_400) return `${Math.floor(seconds / 86_400)}d ago`;
	return new Date(lastSeenAt * 1000).toLocaleDateString([], { month: "short", day: "numeric" });
}

/** The same fact with the words in front: "Last seen 5m ago". */
export function lastSeenSentence(lastSeenAt: number | null | undefined): string | null {
	const label = lastSeenLabel(lastSeenAt);
	return label === null ? null : `Last seen ${label}`;
}

/** The sidebar-sized form: "5m", "3h", "2d", then a date. No words to truncate. */
export function lastSeenShort(lastSeenAt: number | null | undefined): string | null {
	if (lastSeenAt == null || lastSeenAt <= 0) return null;
	const seconds = Math.max(0, Math.floor(Date.now() / 1000) - lastSeenAt);
	if (seconds < 3_600) return `${Math.max(1, Math.floor(seconds / 60))}m`;
	if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h`;
	if (seconds < 7 * 86_400) return `${Math.floor(seconds / 86_400)}d`;
	return new Date(lastSeenAt * 1000).toLocaleDateString([], { month: "short", day: "numeric" });
}

/** "", "tomorrow " or "on Monday " — how far off an instant is, in whole local days. */
function dayPrefix(unixSeconds: number): string {
	const then = new Date(unixSeconds * 1000);
	const now = new Date();
	const days = Math.round(
		(new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime() -
			new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
			86_400_000,
	);
	if (days <= 0) return "";
	if (days === 1) return "tomorrow ";
	if (days < 7) return `on ${then.toLocaleDateString([], { weekday: "long" })} `;
	return `on ${then.toLocaleDateString([], { month: "short", day: "numeric" })} `;
}

/**
 * The shift as a sentence: "Off shift · back tomorrow at 09:00", "On shift until
 * 17:00", or null when there are no hours to say anything about.
 *
 * In the reader's clock, deliberately. The rules behind it are a statement about
 * the other person's day and are shown in their zone wherever they are shown at
 * all; this is a statement about when the reader can expect them, and converting
 * it is the whole point of `changes_at` being an instant.
 */
export function shiftSentence(shift: ShiftState | null | undefined): string | null {
	if (!shift) return null;
	if (shift.changes_at === null) return shift.on ? "On shift" : "Off shift";
	return shift.on
		? `On shift until ${dayPrefix(shift.changes_at)}${clockOf(shift.changes_at)}`
		: `Off shift · back ${dayPrefix(shift.changes_at)}at ${clockOf(shift.changes_at)}`;
}

/** "09:00" in the reader's zone, from an instant. */
function clockOf(unixSeconds: number): string {
	return new Date(unixSeconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * How somebody reads in one line: the state when they are there, the last-seen
 * when they are not, and nothing at all when neither is known.
 *
 * Once they have working hours, the shift explains an absence and annotates a
 * presence, and it never contradicts the dot:
 *
 *  - away from their desk and off shift → the shift, because "back tomorrow at
 *    09:00" is a plan and "Last seen 14h ago" is a fact the reader then has to
 *    interpret;
 *  - away from their desk during their hours → the last-seen, unchanged. They are
 *    due in and they are not here, and "On shift until 17:00" beside a grey dot
 *    would be the interface arguing with itself;
 *  - at their desk but off shift → both, because somebody online at 22:00 is
 *    genuinely reachable and genuinely on their own time;
 *  - at their desk and on shift → the plain status. Everything is as expected and
 *    saying so is noise.
 *
 * Somebody with no hours set reads exactly as they did before shifts existed.
 */
export function presenceLine(presence: PublicPresence | undefined): string | null {
	if (!presence) return null;

	const offShift = presence.shift != null && !presence.shift.on;

	if (presence.status === "offline") {
		return offShift ? shiftSentence(presence.shift) : lastSeenSentence(presence.last_seen_at);
	}
	return offShift ? `${presenceLabel(presence)} · ${shiftSentence(presence.shift)}` : presenceLabel(presence);
}

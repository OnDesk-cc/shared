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

export interface PublicPresence {
	user_id: string;
	status: EffectiveStatus;
	/** Null when nobody has ever seen them, and null when they chose not to be seen. */
	last_seen_at: number | null;
	/** Only ever set alongside `status: "busy"` — the reason for it. */
	activity: PresenceActivity | null;
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

/**
 * How somebody reads in one line: the state when they are there, the last-seen
 * when they are not, and nothing at all when neither is known.
 */
export function presenceLine(presence: PublicPresence | undefined): string | null {
	if (!presence) return null;
	if (presence.status !== "offline") return presenceLabel(presence);
	return lastSeenSentence(presence.last_seen_at);
}

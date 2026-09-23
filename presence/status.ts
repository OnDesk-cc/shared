import { Circle, Clock, MinusCircle, EyeOff, type LucideIcon } from "lucide-react";

/**
 * El vocabulario de presencia.
 *
 * La presencia es el único dato de plataforma que este producto NO espeja.
 * Nombres, avatares, membresías, asientos y permisos se copian en nexus-db y se
 * mantienen al día por webhook y reconciliación; dónde está alguien ahora mismo
 * cambia cada minuto por definición, así que una copia estaría mal casi siempre.
 * En su lugar, el navegador le pregunta directamente a ondesk — ver
 * ./presence-api.ts.
 *
 * Este archivo refleja `ondesk/functions/_lib/types/presence.ts`, y una copia
 * idéntica vive en cada uno de los cuatro productos: la misma duplicación
 * deliberada que `email.ts`, `crypto.ts` y `notify.ts`. No se comparte nada entre
 * estos repositorios, y un vocabulario de estados no es lo primero por lo que
 * empezar — son cuatro etiquetas y un color cada una, y los cinco bundles se
 * despliegan por separado. Cuando uno cambie, busca `PresenceStatus` en los
 * cinco.
 * ▸ Hoy: este archivo es `@ondesk/shared/presence/status` y lo importan los seis
 * productos y ondesk; `presence-api.ts` no está aquí sino en el
 * `src/features/presence/` de cada app, y las copias de `status.ts` que siguen
 * en esa carpeta ya no las importa nadie.
 */

/** Lo que una persona puede elegir. */
export type PresenceStatus = "online" | "away" | "busy" | "invisible";

/** Lo que ven todos los demás. `invisible` nunca aparece aquí — de eso se trata. */
export type EffectiveStatus = "online" | "away" | "busy" | "offline";

/**
 * Lo que una persona está HACIENDO, frente a lo que eligió. Lo informa una sala
 * de Halo mientras su socket sigue arriba; el servidor lo muestra como `busy` con
 * esto adjunto como motivo, y lo quita solo cuando la sala deja de informar. La
 * elección de debajo nunca se toca, y por eso «volver a la normalidad después de
 * la reunión» no necesita ni una línea de código.
 */
export type PresenceActivity = "meeting";

/**
 * Lo que dice el horario laboral de alguien sobre este minuto.
 *
 * No es un estado ni una actividad: un estado se elige, una actividad la afirma
 * un cliente, y esto se deriva de una semana guardada contra la membresía — ver
 * `workspace_members.shift_*` y `_lib/shifts.ts` en ondesk. Nunca pasa por encima
 * del estado, y nada de esto hay que pedirlo aparte: el roster lo resuelve en
 * cada petición y lo pone en el cable.
 *
 * `changes_at` es cuándo la respuesta deja de ser cierta — el final de la franja
 * en la que están, o el inicio de la siguiente — y es lo que deja a un cliente
 * decir «back tomorrow at 09:00» sin una segunda ida y vuelta. Es un instante, así
 * que se pinta en la zona horaria de QUIEN LEE: su pregunta es cuándo puede
 * esperar una respuesta.
 */
export interface ShiftState {
	on: boolean;
	changes_at: number | null;
}

export interface PublicPresence {
	user_id: string;
	status: EffectiveStatus;
	/** Null cuando nadie los ha visto nunca, y null cuando eligieron no ser vistos. */
	last_seen_at: number | null;
	/** Sólo se rellena junto a `status: "busy"` — es su motivo. */
	activity: PresenceActivity | null;
	/**
	 * Su horario laboral, ya resuelto. Null cuando no han puesto ninguno, que es
	 * lo que pasa con casi todo el mundo; **opcional** porque el campo llegó a
	 * ondesk antes que a este paquete, y un producto que siga en una build antigua
	 * tiene que seguir compilando contra un roster que lo trae.
	 */
	shift?: ShiftState | null;
}

export interface OwnPresence {
	user_id: string;
	/** La elección — lo que marca el selector. */
	status: PresenceStatus;
	/** Lo que esa elección te hace ser ahora mismo para todos los demás. */
	effective: EffectiveStatus;
	last_seen_at: number;
	/** Lo que está pasando por encima de la elección ahora mismo, si hay algo. */
	activity: PresenceActivity | null;
}

interface StatusMeta {
	label: string;
	/** Una línea, en el menú, que dice qué les hace a los demás elegir esto. */
	description: string;
	icon: LucideIcon;
	/** Fondo de Tailwind para el punto. */
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

/** Los cuatro que ofrece el selector, en el orden en que los ofrece. */
export const CHOOSABLE_STATUSES: PresenceStatus[] = ["online", "away", "busy", "invisible"];

/** Las palabras para lo que alguien está haciendo. No se puede elegir; el punto sigue siendo el de `busy`. */
export const ACTIVITY_META: Record<PresenceActivity, { label: string }> = {
	meeting: { label: "In meeting" },
};

/**
 * El estado como una sola etiqueta: «Busy · In meeting» para alguien que está en
 * una sala, la etiqueta de estado sin más para todos los demás. Úsalo dondequiera
 * que se muestre una etiqueta de estado a otras personas, para que una reunión se
 * lea como una reunión y no como un «Busy» sin explicar.
 */
export function presenceLabel(presence: Pick<PublicPresence, "status" | "activity">): string {
	const base = STATUS_META[presence.status].label;
	return presence.activity ? `${base} · ${ACTIVITY_META[presence.activity].label}` : base;
}

/**
 * «5m ago» / «3h ago» / «2d ago», y después una fecha.
 *
 * Nunca dice «online» y nunca adivina: una marca de tiempo null devuelve null y
 * quien llama decide qué pintar en su lugar. Null significa una de dos cosas que
 * deben ser indistinguibles — nunca visto, o eligió no ser visto — así que
 * inventar una etiqueta aquí sería inventar la respuesta a cuál de las dos.
 */
export function lastSeenLabel(lastSeenAt: number | null | undefined): string | null {
	if (lastSeenAt == null || lastSeenAt <= 0) return null;
	const seconds = Math.max(0, Math.floor(Date.now() / 1000) - lastSeenAt);
	if (seconds < 3_600) return `${Math.max(1, Math.floor(seconds / 60))}m ago`;
	if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h ago`;
	if (seconds < 7 * 86_400) return `${Math.floor(seconds / 86_400)}d ago`;
	return new Date(lastSeenAt * 1000).toLocaleDateString([], { month: "short", day: "numeric" });
}

/** El mismo dato con las palabras delante: «Last seen 5m ago». */
export function lastSeenSentence(lastSeenAt: number | null | undefined): string | null {
	const label = lastSeenLabel(lastSeenAt);
	return label === null ? null : `Last seen ${label}`;
}

/** La forma a la medida de la barra lateral: «5m», «3h», «2d», y después una fecha. Sin palabras que truncar. */
export function lastSeenShort(lastSeenAt: number | null | undefined): string | null {
	if (lastSeenAt == null || lastSeenAt <= 0) return null;
	const seconds = Math.max(0, Math.floor(Date.now() / 1000) - lastSeenAt);
	if (seconds < 3_600) return `${Math.max(1, Math.floor(seconds / 60))}m`;
	if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h`;
	if (seconds < 7 * 86_400) return `${Math.floor(seconds / 86_400)}d`;
	return new Date(lastSeenAt * 1000).toLocaleDateString([], { month: "short", day: "numeric" });
}

/** `""`, `"tomorrow "` u `"on Monday "` — lo lejos que queda un instante, en días locales enteros. */
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
 * El turno como una frase: «Off shift · back tomorrow at 09:00», «On shift until
 * 17:00», o null cuando no hay horario del que decir nada.
 *
 * En el reloj de quien lee, a propósito. Las reglas que hay detrás son una
 * afirmación sobre el día de la otra persona y se muestran en su zona horaria,
 * allí donde se muestren; esto es una afirmación sobre cuándo puede esperarla
 * quien lee, y convertirla es justo la razón de que `changes_at` sea un instante.
 */
export function shiftSentence(shift: ShiftState | null | undefined): string | null {
	if (!shift) return null;
	if (shift.changes_at === null) return shift.on ? "On shift" : "Off shift";
	return shift.on
		? `On shift until ${dayPrefix(shift.changes_at)}${clockOf(shift.changes_at)}`
		: `Off shift · back ${dayPrefix(shift.changes_at)}at ${clockOf(shift.changes_at)}`;
}

/** «09:00» en la zona horaria de quien lee, a partir de un instante. */
function clockOf(unixSeconds: number): string {
	return new Date(unixSeconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Cómo se lee alguien en una línea: el estado cuando está, la última conexión
 * cuando no, y nada en absoluto cuando no se sabe ninguna de las dos cosas.
 *
 * En cuanto tiene horario laboral, el turno explica una ausencia y anota una
 * presencia, y nunca contradice al punto:
 *
 *  - fuera de su puesto y fuera de turno → el turno, porque «back tomorrow at
 *    09:00» es un plan y «Last seen 14h ago» es un dato que quien lee luego tiene
 *    que interpretar;
 *  - fuera de su puesto durante su horario → la última conexión, sin cambios. Le
 *    toca estar y no está, y «On shift until 17:00» al lado de un punto gris
 *    sería la interfaz discutiendo consigo misma;
 *  - en su puesto pero fuera de turno → las dos cosas, porque alguien conectado a
 *    las 22:00 está de verdad localizable y está de verdad en su tiempo libre;
 *  - en su puesto y en turno → el estado sin más. Todo es lo esperado y decirlo
 *    es ruido.
 *
 * Alguien sin horario puesto se lee exactamente igual que antes de que
 * existieran los turnos.
 */
export function presenceLine(presence: PublicPresence | undefined): string | null {
	if (!presence) return null;

	const offShift = presence.shift != null && !presence.shift.on;

	if (presence.status === "offline") {
		return offShift ? shiftSentence(presence.shift) : lastSeenSentence(presence.last_seen_at);
	}
	return offShift ? `${presenceLabel(presence)} · ${shiftSentence(presence.shift)}` : presenceLabel(presence);
}

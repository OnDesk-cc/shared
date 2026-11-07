/**
 * Las frases de las notificaciones de un producto en el idioma de cada quien
 * (recetas R6 y R7 de `ondesk/docs/specs/2026-11-06-plataforma-multilingue.md`).
 *
 * Cada producto escribe su libro, un objeto por idioma:
 *
 *   events: { invited: { title: "{actor} invited you to {meeting}", subject: "…", … } }
 *   words:  { somebody: "Somebody", minutes: { one: "{count} minute", other: "{count} minutes" } }
 *
 * y un evento se guarda como su clave y sus valores (`notifications.params`). Un
 * valor es texto llano, una fecha (`{ at, tz, zone }`: segundos unix, la zona en la
 * que se escribe y si se añade «(zona)») o una palabra del libro (`{ word, vars }`,
 * que puede ser un plural por `vars.count`). Así el Worker escribe cada correo en
 * el idioma de su destinatario y la app pinta cada fila en el de quien la lee, con
 * las mismas frases y sin guardar texto traducido.
 *
 * Datos y funciones puras, sin React: lo importan igual el Worker y la SPA.
 */
import { formatDate, interpolate, plural, type PluralForms } from "./format";
import type { Locale } from "./locale";

export type EventVar = string | number | { at: number; tz?: string; zone?: boolean; full?: boolean; dateOnly?: boolean } | { word: string; vars?: EventVars };
export type EventVars = Record<string, EventVar>;

export interface EventCopy {
	events: Record<string, Record<string, string>>;
	words: Record<string, string | PluralForms>;
}
export type EventBook = Record<Locale, EventCopy>;

function isPlural(v: unknown): v is PluralForms {
	return !!v && typeof v === "object" && "other" in (v as object);
}

function renderWord(book: EventBook, locale: Locale, word: string, vars: EventVars | undefined): string {
	const entry = book[locale]?.words[word] ?? book.en.words[word];
	if (entry === undefined) return word;
	const flat = renderVars(book, locale, vars ?? {});
	if (isPlural(entry)) return plural(locale, entry, Number(flat.count ?? 0), flat);
	return interpolate(entry, flat);
}

function renderVar(book: EventBook, locale: Locale, value: EventVar): string | number {
	if (typeof value === "string" || typeof value === "number") return value;
	if ("word" in value) return renderWord(book, locale, value.word, value.vars);
	const style: Intl.DateTimeFormatOptions = value.dateOnly
		? { dateStyle: value.full ? "full" : "medium" }
		: { dateStyle: value.full ? "full" : "medium", timeStyle: "short" };
	let tz = value.tz;
	let text: string;
	try {
		text = formatDate(locale, value.at, { ...style, ...(tz ? { timeZone: tz } : {}) });
	} catch {
		// Una zona guardada antes de que se validara: UTC está mal para esa persona
		// pero se lee, y es mejor que romper un correo que ya debía salir.
		tz = "UTC";
		text = formatDate(locale, value.at, { ...style, timeZone: tz });
	}
	return value.zone && tz ? `${text} (${tz})` : text;
}

function renderVars(book: EventBook, locale: Locale, vars: EventVars): Record<string, string | number> {
	const out: Record<string, string | number> = {};
	for (const [k, v] of Object.entries(vars)) out[k] = renderVar(book, locale, v);
	return out;
}

/** Un campo de un evento. Lo que el idioma no tenga cae al inglés; un evento desconocido, a "". */
export function renderEvent(book: EventBook, locale: Locale, key: string, field: string, vars: EventVars): string {
	const template = book[locale]?.events[key]?.[field] ?? book.en.events[key]?.[field];
	if (template === undefined) return "";
	return interpolate(template, renderVars(book, locale, vars));
}

/** Una palabra suelta del libro (para una fila «Access: edición» de un correo). */
export function renderWordOf(book: EventBook, locale: Locale, word: string, vars?: EventVars): string {
	return renderWord(book, locale, word, vars);
}

/** Lo que se guarda en `notifications.params`. */
export function eventParams(key: string, vars: EventVars): string {
	return JSON.stringify({ key, vars });
}

/** Lee `notifications.params`. null si no hay, no es JSON o el evento no está en el libro. */
export function parseEventParams(raw: string | null | undefined, book: EventBook): { key: string; vars: EventVars } | null {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as { key?: unknown; vars?: unknown };
		if (typeof parsed.key !== "string" || !book.en.events[parsed.key]) return null;
		if (!parsed.vars || typeof parsed.vars !== "object") return null;
		return { key: parsed.key, vars: parsed.vars as EventVars };
	} catch {
		return null;
	}
}

/** El título y la descripción de una fila de la campana. Las filas sin `params` se pintan con lo que guardaron. */
export function notificationText(
	row: { title: string; description: string; params?: string | null },
	locale: Locale,
	book: EventBook,
): { title: string; description: string } {
	const event = parseEventParams(row.params, book);
	if (!event) return { title: row.title, description: row.description };
	return {
		title: renderEvent(book, locale, event.key, "title", event.vars),
		description: renderEvent(book, locale, event.key, "description", event.vars),
	};
}

/** Un valor suelto (una fecha, «45 minutos») para la columna de datos de un correo. */
export function renderEventVar(book: EventBook, locale: Locale, value: EventVar): string {
	return String(renderVar(book, locale, value));
}

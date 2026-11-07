/**
 * Placeholders, plurales, fechas y números. Todo pasa por `Intl` con la etiqueta
 * del idioma (`INTL_TAG`), nunca por formatos escritos a mano: el orden de día y
 * mes y el separador decimal cambian entre en, es y pt.
 */
import { INTL_TAG, type Locale } from "./locale";

/** Formas de plural, con la misma forma que las del sitio (`ondesk/src/i18n/format.ts`). */
export interface PluralForms {
	one: string;
	other: string;
}

export type Vars = Record<string, string | number>;

/** Rellena `{name}`. Un placeholder sin valor se deja tal cual, para que se vea el fallo. */
export function interpolate(template: string, vars?: Vars): string {
	if (!vars) return template;
	return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole));
}

const pluralRules = new Map<Locale, Intl.PluralRules>();
const numberFormats = new Map<Locale, Intl.NumberFormat>();

/** Elige la forma con las reglas del idioma; `{count}` sale con el número ya formateado. */
export function plural(locale: Locale, forms: PluralForms, count: number, vars?: Vars): string {
	let rules = pluralRules.get(locale);
	if (!rules) {
		rules = new Intl.PluralRules(INTL_TAG[locale]);
		pluralRules.set(locale, rules);
	}
	const form = rules.select(count) === "one" ? forms.one : forms.other;
	return interpolate(form, { ...vars, count: formatNumber(locale, count) });
}

export function formatNumber(locale: Locale, value: number, opts?: Intl.NumberFormatOptions): string {
	if (opts) return new Intl.NumberFormat(INTL_TAG[locale], opts).format(value);
	let nf = numberFormats.get(locale);
	if (!nf) {
		nf = new Intl.NumberFormat(INTL_TAG[locale]);
		numberFormats.set(locale, nf);
	}
	return nf.format(value);
}

/** Un número son segundos unix, como se guardan en las BD de la plataforma. */
function toDate(value: number | Date): Date {
	return value instanceof Date ? value : new Date(value * 1000);
}

export function formatDate(locale: Locale, value: number | Date, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }): string {
	return new Intl.DateTimeFormat(INTL_TAG[locale], opts).format(toDate(value));
}

const RELATIVE_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
	["year", 365 * 24 * 3600],
	["month", 30 * 24 * 3600],
	["week", 7 * 24 * 3600],
	["day", 24 * 3600],
	["hour", 3600],
	["minute", 60],
];

/** «hace 2 días», «in 3 hours», «agora». Menos de un minuto es «ahora». */
export function formatRelative(locale: Locale, value: number | Date, now: Date = new Date()): string {
	const diff = Math.round((toDate(value).getTime() - now.getTime()) / 1000);
	const rtf = new Intl.RelativeTimeFormat(INTL_TAG[locale], { numeric: "auto" });
	for (const [unit, seconds] of RELATIVE_STEPS) {
		if (Math.abs(diff) >= seconds) return rtf.format(Math.trunc(diff / seconds), unit);
	}
	return rtf.format(0, "second");
}

/**
 * Una plantilla en trozos: el texto y los valores tal cual, sin pasarlos a
 * texto. Es lo que necesita una frase con un enlace o un `<strong>` dentro
 * («Lee los {link} antes de seguir»): el valor es un elemento de React. Un
 * marcador sin valor se queda escrito, como en `interpolate`.
 */
export function splitTemplate<T>(template: string, vars: Record<string, T>): (string | T)[] {
	const out: (string | T)[] = [];
	let text = "";
	let last = 0;
	for (const m of template.matchAll(/\{(\w+)\}/g)) {
		text += template.slice(last, m.index);
		last = (m.index ?? 0) + m[0].length;
		if (m[1] in vars) {
			if (text) out.push(text);
			text = "";
			out.push(vars[m[1]]);
		} else text += m[0];
	}
	text += template.slice(last);
	if (text) out.push(text);
	return out;
}

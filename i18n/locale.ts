/**
 * Los tres idiomas de la plataforma y la regla que decide cuál ve una persona.
 *
 * El orden lo fijó el usuario (spec 2026-11-06-plataforma-multilingue): lo que
 * la persona configuró en su perfil → el idioma con el que leyó el sitio (la
 * cookie `ondesk_lang`) → el navegador → inglés. Con el interruptor de la
 * plataforma apagado el resultado es siempre inglés, aunque haya datos
 * guardados en otro idioma: así se puede desplegar todo antes del lanzamiento
 * sin que nadie vea nada.
 *
 * Sin DOM ni React: lo importan tanto las SPAs como los workers.
 */

export type Locale = "en" | "es" | "pt";

export const LOCALES: readonly Locale[] = ["en", "es", "pt"];

export const DEFAULT_LOCALE: Locale = "en";

/** La etiqueta BCP 47 que se le pasa a `Intl`. Español latinoamericano y portugués de Brasil. */
export const INTL_TAG: Record<Locale, string> = { en: "en-US", es: "es-419", pt: "pt-BR" };

export function isLocale(v: unknown): v is Locale {
	return v === "en" || v === "es" || v === "pt";
}

/**
 * La parte del idioma de una etiqueta (`es-mx`, `pt-BR`, `en-US`, `pt-419`, `es`).
 * Cualquier idioma que no sea uno de los tres da null: `de-DE` no es «casi inglés».
 */
export function localeFromTag(tag: string | null | undefined): Locale | null {
	if (!tag) return null;
	const lang = tag.trim().toLowerCase().split(/[-_]/)[0];
	return isLocale(lang) ? lang : null;
}

export interface ResolveLocaleInput {
	/** El interruptor `languages_enabled` de la plataforma. */
	enabled: boolean;
	/** `users.locale`: null es «Automático». */
	profile: Locale | null;
	/** El valor crudo de la cookie `ondesk_lang`; se valida aquí. */
	cookie: string | null;
	/** `navigator.languages`, en orden de preferencia. */
	navigator: readonly string[];
}

export function resolveLocale(input: ResolveLocaleInput): Locale {
	if (!input.enabled) return DEFAULT_LOCALE;
	if (input.profile && isLocale(input.profile)) return input.profile;
	const fromCookie = localeFromTag(input.cookie);
	if (fromCookie) return fromCookie;
	for (const tag of input.navigator) {
		const l = localeFromTag(tag);
		if (l) return l;
	}
	return DEFAULT_LOCALE;
}

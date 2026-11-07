/**
 * El idioma en una SPA: `I18nProvider` resuelve el idioma (perfil → cookie
 * `ondesk_lang` → navegador → `en`, y `en` con el interruptor apagado), pone
 * `<html lang>` y reparte el diccionario de la app y las herramientas de formato.
 *
 *   // src/i18n/index.ts de cada app
 *   export type AppDict = Translation<typeof en>;
 *   export const useT = () => useI18n<AppDict>();
 *
 *   // dentro del provider de sesión
 *   <I18nProvider dictionaries={{ en, es, pt }} profileLocale={user?.locale} ondeskOrigin={ondeskUrl()}>
 *
 * `profileLocale` en undefined es «la sesión todavía carga»: se resuelve con la
 * cookie y el navegador para no pintar inglés antes de tiempo, y se vuelve a
 * resolver cuando llega. Los componentes de `@ondesk/shared` leen el idioma del
 * mismo contexto con `useSharedStrings()`; sin provider (admin) hablan inglés.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { INTL_TAG, resolveLocale, type Locale } from "./locale";
import { formatDate, formatNumber, formatRelative, interpolate, plural, type PluralForms, type Vars } from "./format";
import { readLangCookie } from "./cookie";
import { cachedLanguagesEnabled, fetchLanguagesEnabled } from "./flag";
import { SHARED_STRINGS, type SharedDict } from "./strings";

export interface I18nTools {
	locale: Locale;
	/** El interruptor de la plataforma. Apagado, `locale` es siempre `en`. */
	enabled: boolean;
	t: (template: string, vars?: Vars) => string;
	pl: (forms: PluralForms, count: number, vars?: Vars) => string;
	date: (value: number | Date, opts?: Intl.DateTimeFormatOptions) => string;
	relative: (value: number | Date, now?: Date) => string;
	num: (value: number, opts?: Intl.NumberFormatOptions) => string;
}

export interface I18nValue<D> extends I18nTools {
	dict: D;
	/**
	 * Cambia el idioma de esta pestaña al momento (null: «Automático»). No lo
	 * guarda en ningún sitio: persistirlo (`PATCH /api/auth/me/language`) es cosa
	 * de quien llama.
	 */
	setLocale: (next: Locale | null) => void;
}

interface State {
	locale: Locale;
	enabled: boolean;
	dict: unknown;
	setLocale: (next: Locale | null) => void;
}

const I18nContext = createContext<State | null>(null);

export function makeTools(locale: Locale, enabled: boolean): I18nTools {
	return {
		locale,
		enabled,
		t: interpolate,
		pl: (forms, count, vars) => plural(locale, forms, count, vars),
		date: (value, opts) => formatDate(locale, value, opts),
		relative: (value, now) => formatRelative(locale, value, now),
		num: (value, opts) => formatNumber(locale, value, opts),
	};
}

function browserLanguages(): readonly string[] {
	return typeof navigator === "undefined" ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];
}

function browserCookie(): string {
	return typeof document === "undefined" ? "" : document.cookie;
}

export function I18nProvider<D>(props: {
	dictionaries: Record<Locale, D>;
	/** `users.locale` de `/api/auth/me`: null es «Automático», undefined es «todavía carga». */
	profileLocale: Locale | null | undefined;
	/** De dónde leer el interruptor: el origen de ondesk (`ondeskUrl()`). */
	ondeskOrigin: string;
	children: ReactNode;
}) {
	const { dictionaries, profileLocale, ondeskOrigin, children } = props;
	const [enabled, setEnabled] = useState(() => cachedLanguagesEnabled());
	// Un cambio hecho en esta pestaña (el selector) gana al perfil hasta que el
	// perfil traiga el mismo valor; `undefined` = no hay cambio local.
	const [override, setOverride] = useState<Locale | null | undefined>(undefined);

	useEffect(() => {
		let alive = true;
		void fetchLanguagesEnabled(ondeskOrigin).then((on) => {
			if (alive) setEnabled(on);
		});
		return () => {
			alive = false;
		};
	}, [ondeskOrigin]);

	const profile = override !== undefined ? override : (profileLocale ?? null);
	const locale = resolveLocale({ enabled, profile, cookie: readLangCookie(browserCookie()), navigator: browserLanguages() });

	useEffect(() => {
		if (typeof document !== "undefined") document.documentElement.lang = INTL_TAG[locale];
	}, [locale]);

	const setLocale = useCallback((next: Locale | null) => setOverride(next), []);
	const value = useMemo<State>(() => ({ locale, enabled, dict: dictionaries[locale], setLocale }), [locale, enabled, dictionaries, setLocale]);
	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** El diccionario de la app y las herramientas. Fuera de un provider es un error de programación. */
export function useI18n<D>(): I18nValue<D> {
	const state = useContext(I18nContext);
	if (!state) throw new Error("useI18n() fuera de <I18nProvider>");
	const { locale, enabled, dict, setLocale } = state;
	return useMemo(() => ({ ...makeTools(locale, enabled), dict: dict as D, setLocale }), [locale, enabled, dict, setLocale]);
}

/** Para los componentes de `@ondesk/shared`. Sin provider, inglés. */
export function useSharedStrings(): I18nTools & { s: SharedDict } {
	const state = useContext(I18nContext);
	const locale = state?.locale ?? "en";
	const enabled = state?.enabled ?? false;
	return useMemo(() => ({ ...makeTools(locale, enabled), s: SHARED_STRINGS[locale] }), [locale, enabled]);
}

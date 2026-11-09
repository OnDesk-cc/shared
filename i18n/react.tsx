/**
 * El idioma en una SPA: `I18nProvider` resuelve el idioma (perfil → cookie
 * `ondesk_lang` → navegador → `en`), pone
 * `<html lang>` y reparte el diccionario de la app y las herramientas de formato.
 *
 *   // src/i18n/index.ts de cada app
 *   export type AppDict = Translation<typeof en>;
 *   export const useT = () => useI18n<AppDict>();
 *
 *   // dentro del provider de sesión
 *   <I18nProvider dictionaries={{ en, es, pt }} profileLocale={user?.locale}>
 *
 * `profileLocale` en undefined es «la sesión todavía carga»: se resuelve con la
 * cookie y el navegador para no pintar inglés antes de tiempo, y se vuelve a
 * resolver cuando llega. Los componentes de `@ondesk/shared` leen el idioma del
 * mismo contexto con `useSharedStrings()`; sin provider (admin) hablan inglés.
 */
import { createContext, Fragment, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { INTL_TAG, resolveLocale, type Locale } from "./locale";
import { formatDate, formatNumber, formatRelative, interpolate, plural, splitTemplate, type PluralForms, type Vars } from "./format";
import { readLangCookie } from "./cookie";
import { SHARED_STRINGS, type SharedDict } from "./strings";

export interface I18nTools {
	locale: Locale;
	t: (template: string, vars?: Vars) => string;
	/** Como `t`, pero los valores pueden ser elementos: «Lee los {link} antes de seguir». */
	rich: (template: string, vars: Record<string, ReactNode>) => ReactNode;
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
	dict: unknown;
	setLocale: (next: Locale | null) => void;
}

const I18nContext = createContext<State | null>(null);

/**
 * El idioma y el diccionario que pinta ahora mismo el provider, para el código que
 * no es un componente (validaciones, modelos, mensajes de error de un cliente de
 * API): lo lee AL LLAMARSE, nunca al cargar el módulo, así que una constante de
 * módulo no puede usarlo. Una SPA tiene un solo provider; sin él, inglés.
 */
let current: { locale: Locale; dict: unknown } = { locale: "en", dict: null };

export function getCurrentI18n<D>(fallback: D): I18nTools & { dict: D } {
	return { ...makeTools(current.locale), dict: (current.dict as D | null) ?? fallback };
}

export function makeTools(locale: Locale): I18nTools {
	return {
		locale,
		t: interpolate,
		rich: (template, vars) => createElement(Fragment, null, ...splitTemplate<ReactNode>(template, vars).map((part, i) => createElement(Fragment, { key: i }, part))),
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
	children: ReactNode;
}) {
	const { dictionaries, profileLocale, children } = props;
	// Un cambio hecho en esta pestaña (el selector) gana al perfil hasta que el
	// perfil traiga el mismo valor; `undefined` = no hay cambio local.
	const [override, setOverride] = useState<Locale | null | undefined>(undefined);

	const profile = override !== undefined ? override : (profileLocale ?? null);
	const locale = resolveLocale({ profile, cookie: readLangCookie(browserCookie()), navigator: browserLanguages() });

	useEffect(() => {
		if (typeof document !== "undefined") document.documentElement.lang = INTL_TAG[locale];
	}, [locale]);

	const setLocale = useCallback((next: Locale | null) => setOverride(next), []);
	current = { locale, dict: dictionaries[locale] };
	const value = useMemo<State>(() => ({ locale, dict: dictionaries[locale], setLocale }), [locale, dictionaries, setLocale]);
	// La llave es el idioma: al cambiarlo se vuelve a montar todo lo de dentro. Sin
	// ella, React se salta los componentes que no leen el contexto (el texto que
	// sale de `getCurrentI18n()`: las paradas de una página, las etiquetas de un
	// modelo) y se quedarían en el idioma anterior hasta el siguiente render.
	// Cambiar de idioma es raro; perder el estado de un formulario a medias, aceptable.
	return (
		<I18nContext.Provider value={value}>
			<Fragment key={locale}>{children}</Fragment>
		</I18nContext.Provider>
	);
}

/** El diccionario de la app y las herramientas. Fuera de un provider es un error de programación. */
export function useI18n<D>(): I18nValue<D> {
	const state = useContext(I18nContext);
	if (!state) throw new Error("useI18n() fuera de <I18nProvider>");
	const { locale, dict, setLocale } = state;
	return useMemo(() => ({ ...makeTools(locale), dict: dict as D, setLocale }), [locale, dict, setLocale]);
}

/** Para los componentes de `@ondesk/shared`. Sin provider, inglés. */
export function useSharedStrings(): I18nTools & { s: SharedDict } {
	const state = useContext(I18nContext);
	const locale = state?.locale ?? "en";
	return useMemo(() => ({ ...makeTools(locale), s: SHARED_STRINGS[locale] }), [locale]);
}

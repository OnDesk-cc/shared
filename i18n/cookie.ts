/**
 * La cookie `ondesk_lang`: el idioma con el que la persona leyó el sitio, elegido
 * o detectado. Vive en `.ondesk.cc` para que la consola y cada app la lean.
 *
 * No es `ondesk_locale` (la del sitio, que guarda la EDICIÓN elegida a mano y le
 * gana al país en el enrutado del edge): mezclar «elegido» y «detectado» en esa
 * cookie rompería el enrutado. Ver la spec 2026-11-06-plataforma-multilingue.
 */
import { localeFromTag, type Locale } from "./locale";

export const LANG_COOKIE = "ondesk_lang";
export const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** `Domain=.ondesk.cc` sólo en ondesk.cc y sus subdominios; en localhost o pages.dev, sin dominio. */
export function langCookieString(locale: Locale, hostname: string, secure: boolean): string {
	const host = hostname.toLowerCase();
	const domain = host === "ondesk.cc" || host.endsWith(".ondesk.cc") ? "; Domain=.ondesk.cc" : "";
	return `${LANG_COOKIE}=${locale}${domain}; Path=/; Max-Age=${LANG_COOKIE_MAX_AGE}; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function readLangCookie(cookieHeader: string): Locale | null {
	const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${LANG_COOKIE}=([^;]*)`));
	return match ? localeFromTag(decodeURIComponent(match[1])) : null;
}

/** Sólo en el navegador. */
export function writeLangCookie(locale: Locale): void {
	if (typeof document === "undefined") return;
	document.cookie = langCookieString(locale, location.hostname, location.protocol === "https:");
}

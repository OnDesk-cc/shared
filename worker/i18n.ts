/**
 * Idioma en el servidor: validar lo que llega de fuera y traducirlo al código que
 * entiende Stripe. El idioma efectivo de una persona lo calcula ondesk (perfil,
 * último idioma resuelto, interruptor) y llega a los productos por el espejo.
 */
import { DEFAULT_LOCALE, isLocale, type Locale } from "../i18n/locale";

export type { Locale } from "../i18n/locale";

/** Los códigos de `preferred_locales` y de `locale` de las sesiones de Stripe. */
export function stripeLocale(l: Locale): "en" | "es-419" | "pt-BR" {
	return l === "es" ? "es-419" : l === "pt" ? "pt-BR" : "en";
}

/** Un valor de BD, de un formulario o de un webhook, ya validado. */
export function localeOr(v: unknown, fallback: Locale = DEFAULT_LOCALE): Locale {
	return isLocale(v) ? v : fallback;
}

/**
 * Cuándo una app le dice a ondesk el idioma que resolvió el navegador (receta R2
 * de la spec `ondesk/docs/specs/2026-11-06-plataforma-multilingue.md`).
 *
 * Mientras el perfil diga «Automático» (`locale` null), los correos de la persona
 * salen en `last_locale`: el último idioma que resolvió alguna de sus pantallas.
 * Se avisa sólo si hay sesión, el perfil no fija
 * un idioma, el resuelto no es ya el guardado y no se mandó antes en esta carga.
 */
import type { Locale } from "./locale";

export interface LocaleProfile {
	/** `users.locale`: null = «Automático»; undefined = un /me que no lo trae. */
	locale?: Locale | null;
	last_locale?: Locale | null;
}

export function shouldReportLocale(user: LocaleProfile | null | undefined, resolved: Locale, alreadySent: Locale | null): boolean {
	if (!user) return false;
	if (user.locale) return false;
	if (user.last_locale === resolved) return false;
	return alreadySent !== resolved;
}

/** `PATCH {ondesk}/api/auth/me/language { last_locale }`. Nunca lanza: es un aviso, no una acción. */
export async function reportResolvedLocale(ondeskOrigin: string, locale: Locale, fetcher: typeof fetch = fetch): Promise<void> {
	try {
		await fetcher(`${ondeskOrigin}/api/auth/me/language`, {
			method: "PATCH",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ last_locale: locale }),
		});
	} catch {
		// Sin red o sin ondesk: se vuelve a intentar en la próxima carga.
	}
}

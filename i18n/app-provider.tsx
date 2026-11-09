/**
 * El provider de idioma de una app de la plataforma (Atlas, Halo, Nexus, Orbit,
 * Pulse, Vault, developers, partners): el `I18nProvider` con el perfil de la
 * sesión, más el aviso a ondesk del idioma resuelto cuando el perfil dice
 * «Automático» (ver `./report-locale.ts`).
 *
 *   <AppI18nProvider dictionaries={{ en, es, pt }} user={user} ondeskOrigin={ondeskUrl()}>
 *     <RouterProvider router={router} />
 *   </AppI18nProvider>
 *
 * `user`: undefined mientras carga, null sin sesión (páginas públicas: cookie y
 * navegador), o el usuario de `/api/auth/me` con `locale` y `last_locale`.
 */
import { useEffect, type ReactNode } from "react";
import type { Locale } from "./locale";
import { I18nProvider, useI18n } from "./react";
import { reportResolvedLocale, shouldReportLocale, type LocaleProfile } from "./report-locale";

// Una vez por carga de la página, aunque el árbol se vuelva a montar al cambiar de idioma.
let sent: Locale | null = null;

function ReportLocale({ user, ondeskOrigin }: { user: LocaleProfile | null | undefined; ondeskOrigin: string }) {
	const { locale } = useI18n<unknown>();
	useEffect(() => {
		if (!shouldReportLocale(user, locale, sent)) return;
		sent = locale;
		void reportResolvedLocale(ondeskOrigin, locale);
	}, [user, locale, ondeskOrigin]);
	return null;
}

export function AppI18nProvider<D>({
	dictionaries,
	user,
	ondeskOrigin,
	children,
}: {
	dictionaries: Record<Locale, D>;
	user: LocaleProfile | null | undefined;
	ondeskOrigin: string;
	children: ReactNode;
}) {
	const profileLocale = user === undefined ? undefined : user ? (user.locale ?? null) : null;
	return (
		<I18nProvider dictionaries={dictionaries} profileLocale={profileLocale}>
			<ReportLocale user={user} ondeskOrigin={ondeskOrigin} />
			{children}
		</I18nProvider>
	);
}

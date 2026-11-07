/**
 * Los textos fijos de la plantilla de correo de producto (`email.ts`) en los tres
 * idiomas. El asunto, el titular y el cuerpo los traduce cada producto; aquí sólo
 * vive lo que es igual en todos: el saludo, el botón, las etiquetas y el pie.
 */
import type { Locale } from "../i18n/locale";

export interface EmailStrings {
	/** `lang` del documento. */
	htmlLang: string;
	/** «Hi {name}, {body}»: el cuerpo empieza en minúscula y sigue al saludo. */
	greeting: string;
	/** «Open in {product}». */
	openIn: string;
	preview: string;
	warning: string;
	/** El pie. `{product}` sale escapado; `{link}` es el enlace ya compuesto. */
	footer: string;
	footerWithLink: string;
	managePreferences: string;
}

export const EMAIL_STRINGS: Record<Locale, EmailStrings> = {
	en: {
		htmlLang: "en",
		greeting: "Hi {name}, {body}",
		openIn: "Open in {product}",
		preview: "Preview",
		warning: "Warning",
		footer: "You're receiving this because of your {product} notification settings.",
		footerWithLink: "You're receiving this because of your {product} notification settings. {link}.",
		managePreferences: "Manage preferences",
	},
	es: {
		htmlLang: "es",
		greeting: "Hola {name}, {body}",
		openIn: "Abrir en {product}",
		preview: "Vista previa",
		warning: "Aviso",
		footer: "Recibes este correo por tu configuración de notificaciones de {product}.",
		footerWithLink: "Recibes este correo por tu configuración de notificaciones de {product}. {link}.",
		managePreferences: "Gestionar preferencias",
	},
	pt: {
		htmlLang: "pt-BR",
		greeting: "Olá {name}, {body}",
		openIn: "Abrir no {product}",
		preview: "Prévia",
		warning: "Aviso",
		footer: "Você está recebendo este e-mail por causa das suas configurações de notificação do {product}.",
		footerWithLink: "Você está recebendo este e-mail por causa das suas configurações de notificação do {product}. {link}.",
		managePreferences: "Gerenciar preferências",
	},
};

/**
 * Email transaccional para las notificaciones de un producto.
 *
 * Un producto no envía nada más. Los restablecimientos de contraseña, las
 * invitaciones y los códigos de doble factor son de ondesk — los productos no
 * autentican a nadie, así que no tienen correo de cuenta que enviar. Añadir uno
 * en un producto significaría un segundo origen capaz de hablar en nombre de la
 * plataforma sobre la cuenta de alguien.
 *
 * Una sola implementación, con la marca de cada producto: el
 * `functions/_lib/email.ts` de cada app llama a `createEmailer` con la placa de su
 * app y su nombre de producto y reexporta el par, así que notify.ts nunca sabe
 * que este paquete existe.
 *
 * La plantilla es el cielo claro de OnDesk hecho apto para correo (la baldosa de la
 * app y su nombre, una tarjeta blanca, la píldora azul marino, filas de datos);
 * ver `renderNotification`.
 */

interface EmailOptions {
	to: string;
	subject: string;
	html: string;
	/** Alternativa en texto plano. Se deriva de `html` cuando se omite. */
	text?: string;
}

/** Lo que el envío necesita de los bindings de un producto, estructuralmente. */
export interface EmailEnv {
	CF_ACCOUNT_ID?: string;
	EMAIL_API_TOKEN?: string;
	EMAIL_FROM?: string;
	EMAIL_FROM_NAME?: string;
}

interface SendResponse {
	success: boolean;
	errors?: { code: number; message: string }[];
	result?: { delivered?: string[]; permanent_bounces?: string[]; queued?: string[] } | null;
}

export function emailConfigured(env: EmailEnv): boolean {
	return Boolean(env.CF_ACCOUNT_ID && env.EMAIL_API_TOKEN && env.EMAIL_FROM);
}

/**
 * Alternativa en texto plano para que los mensajes no sean sólo HTML (ayuda con la
 * puntuación antispam). La plantilla son tablas: cada fila (`</tr>`) acaba en salto
 * de línea, las celdas contiguas se unen con un espacio, el preheader oculto se
 * descarta y un enlace cuyo texto es su propia dirección la dice una sola vez.
 */
export function htmlToText(html: string): string {
	return html
		.replace(/<(style|script|head)\b[\s\S]*?<\/\1>/gi, "")
		.replace(/<div\b[^>]*data-preheader[^>]*>[\s\S]*?<\/div>/gi, "")
		.replace(/<a\b[^>]*?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_whole, href: string, label: string) => {
			const text = label.replace(/<[^>]+>/g, "").trim();
			return !text || text === href ? href : `mailto:${text}` === href ? text : `${text} (${href})`;
		})
		.replace(/<br\s*\/?>/gi, "\n")
		// Se restituye `<td` para que la etiqueta siga completa y la quite el paso
		// de abajo; lo que queda entre las dos celdas es un solo espacio.
		.replace(/<\/t[dh]>\s*<t[dh]\b/gi, " <td")
		.replace(/<\/(p|div|h[1-6]|li|table|blockquote)>/gi, "\n\n")
		.replace(/<\/tr>/gi, "\n")
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;|&zwnj;/g, " ")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&amp;/g, "&")
		.replace(/[ \t]+/g, " ")
		.replace(/^ +| +$/gm, "")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

/**
 * Quita el HTML y recorta el contenido a una vista previa corta. Sin longitud por
 * defecto a propósito: los productos se quedaron con longitudes distintas antes
 * de que esto se moviera aquí, y el envoltorio fino `_lib/email.ts` de cada app
 * conserva la suya.
 */
export function excerpt(html: string, maxLength: number): string {
	const text = htmlToText(html);
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength).trimEnd()}…`;
}

/** Escapa cualquier cosa que haya escrito una persona antes de que llegue al HTML. */
export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

export interface NotificationEmailInput {
	/** El nombre visible del destinatario. */
	recipientName: string;
	/** Titular, p. ej. «ACME-42 was assigned to you». */
	heading: string;
	/** Explicación de una línea de lo que ha pasado. */
	body: string;
	/** Enlace absoluto al producto. */
	url: string;
	ctaLabel?: string;
	/** Filas clave/valor que se pintan como tabla de datos bajo el CTA. */
	details?: { label: string; value: string }[];
	/**
	 * Contenido citado que se pinta bajo el cuerpo — el comentario o mensaje que
	 * disparó el email. Los productos cuyo contenido no debe viajar por correo
	 * (Vault: una credencial se abre por la ruta de revelado, el único camino que
	 * registra quién miró) simplemente no lo pasan nunca.
	 */
	preview?: string;
	/** Etiqueta pequeña sobre la vista previa. Por defecto «Preview». */
	previewLabel?: string;
	/** Se pinta como una caja destructiva con sello. Se usa para caducidad y revocación. */
	warning?: string;
	/** Enlace a la pantalla de preferencias, que se muestra en el pie. */
	preferencesUrl?: string;
}

export interface Emailer {
	/**
	 * Envía a través de la API REST de Cloudflare Email Sending. Las Pages
	 * Functions no pueden usar el binding `send_email` de Workers, así que esto
	 * llama en su lugar al endpoint de ámbito de cuenta con un token de API.
	 */
	sendEmail(env: EmailEnv, opts: EmailOptions): Promise<void>;
	/** La única plantilla de notificación con la que se pinta cada correo de producto. */
	notificationEmail(input: NotificationEmailInput): string;
}

// ─── La tarjeta: el cielo claro hecho apto para correo ───────────────────────
//
// Un correo de producto en el mundo «Clear Sky» (2026-10-04): sobre el suelo
// azulado, la marca de la app (su baldosa y su nombre) y una tarjeta blanca con
// un titular, una o dos frases, UNA acción (la píldora azul marino) y los datos
// en filas con filetes finos. Es la misma forma que
// `ondesk/functions/_lib/email.ts`; la versión de ondesk lleva además el código y
// la carta del buzón, que aquí no existen. Tablas con `role="presentation"`,
// estilos en línea en todo lo que importa (el `<style>` sólo lleva la consulta de
// móvil y la protección del modo oscuro), `bgcolor` además de estilos, columna de
// 600px fluida por debajo y claro solo. Los radios los ignora Outlook de
// escritorio, que pinta lo mismo en cuadrado. La baldosa es una imagen alojada
// en el dominio de la app (`/brand/icon-light.png`, del kit de marca) sobre una
// celda de su color: con las imágenes bloqueadas queda un cuadrado de su color.
// Hay dos copias a mano de esto (`halo-realtime/src/notify.ts` y
// `nexus-realtime/src/notify.ts`): un cambio de diseño se hace en las tres.

const FONT = "'Geist','Segoe UI',-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif";
const GROUND = "#f4f7fb";
const SURFACE = "#ffffff";
const INK = "#0e1b2e";
const INK_2 = "#46566c";
const INK_3 = "#56657a";
const HAIR = "#e3e9f1";
const ACCENT = "#2f6be0";
const DANGER_BG = "#fbeceb";
const DANGER_FG = "#8f2219";

/** El color de cada app (el de su baldosa); el de OnDesk es el acento. */
const APP_HUE: Record<string, string> = {
	pulse: "#0b9fb3",
	vault: "#17996a",
	orbit: "#ee6c2b",
	nexus: "#4466f2",
	halo: "#8f55e8",
	atlas: "#5aa82e",
};

/**
 * La app de una marca. Se deduce de la última palabra del nombre de marca
 * («OnDesk Pulse» → pulse) y no de un parámetro nuevo, para que un producto que
 * aún fija una versión anterior de este paquete no falle al compilar cuando
 * cambie su envoltorio.
 */
function appFor(brandName: string): string | null {
	const last = brandName.trim().split(/\s+/).pop()?.toLowerCase() ?? "";
	return last in APP_HUE ? last : null;
}

/** La marca sobre la tarjeta: la baldosa (imagen alojada sobre su color) y el nombre. */
function brandRow(name: string, app: string | null): string {
	const hue = app ? APP_HUE[app] : ACCENT;
	const src = app ? `https://${app}.ondesk.cc/brand/icon-light.png` : "https://ondesk.cc/brand/icon-light.png";
	return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td width="30" height="30" bgcolor="${hue}" style="width:30px;height:30px;border-radius:8px;background:${hue};"><img src="${src}" width="30" height="30" alt="" style="display:block;width:30px;height:30px;border:0;border-radius:8px;" /></td><td style="padding-left:10px;font-family:${FONT};font-size:17px;line-height:22px;font-weight:600;letter-spacing:-0.02em;color:${INK};" class="ink-text">${escapeHtml(name)}</td></tr></table>`;
}

function heading(text: string): string {
	return `<h1 style="margin:0 0 12px;font-family:${FONT};font-size:24px;line-height:1.25;font-weight:600;letter-spacing:-0.02em;color:${INK};">${text}</h1>`;
}

function para(html: string): string {
	return `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.6;color:${INK_2};">${html}</p>`;
}

/** Bloque en tabla con su separación arriba en el `padding` de celda (Outlook ignora el margin). */
function block(inner: string, top = 8): string {
	return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:${top}px 0 16px;">${inner}</td></tr></table>`;
}

/** La acción: la píldora azul marino, la única de cada correo. */
function action(url: string, label: string): string {
	return block(
		`<table role="presentation" class="act" cellpadding="0" cellspacing="0" border="0"><tr><td class="ink-bg" align="center" bgcolor="${INK}" style="background:${INK};border-radius:999px;mso-padding-alt:13px 26px;font-family:${FONT};font-size:15px;line-height:20px;font-weight:600;"><a class="ink-bg ink-fg" href="${escapeHtml(url)}" style="display:inline-block;padding:13px 26px;border-radius:999px;background:${INK};color:${SURFACE};text-decoration:none;font-family:${FONT};font-size:15px;line-height:20px;font-weight:600;">${escapeHtml(label)}</a></td></tr></table>`,
		8,
	);
}

/** Los datos: la clave en voz pequeña, el valor en tinta, filetes finos. */
function facts(rows: { label: string; value: string }[]): string {
	const body = rows
		.map(
			(row, i) =>
				`<tr class="frow"><td class="stack kcell" width="140" valign="top" style="${i > 0 ? `border-top:1px solid ${HAIR};` : ""}padding:11px 12px 11px 0;font-family:${FONT};font-size:13px;line-height:20px;color:${INK_3};">${escapeHtml(row.label)}</td><td class="stack vcell" valign="top" style="${i > 0 ? `border-top:1px solid ${HAIR};` : ""}padding:11px 0;font-family:${FONT};font-size:15px;line-height:20px;font-weight:500;color:${INK};word-break:break-word;">${escapeHtml(row.value)}</td></tr>`,
		)
		.join("");
	return block(
		`<table role="presentation" class="ftable" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${HAIR};border-bottom:1px solid ${HAIR};">${body}</table>`,
		8,
	);
}

/** Aviso: un recuadro de rojo apagado con su palabra. `html` YA viene escapado. */
function stampBox(stamp: string, html: string): string {
	return block(
		`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${DANGER_BG}" style="background:${DANGER_BG};border-radius:12px;padding:14px 16px;font-family:${FONT};"><p style="margin:0 0 4px;font-family:${FONT};font-size:13px;line-height:18px;font-weight:600;color:${DANGER_FG};">${escapeHtml(stamp)}</p><p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.5;color:${DANGER_FG};">${html}</p></td></tr></table>`,
		8,
	);
}

/** Vista previa: sobre el suelo, bajo una etiqueta pequeña. `html` YA viene escapado. */
function previewBlock(label: string, html: string): string {
	return block(
		`<p style="margin:0 0 6px;font-family:${FONT};font-size:13px;line-height:18px;color:${INK_3};">${escapeHtml(label)}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${GROUND}" style="background:${GROUND};border-radius:12px;padding:14px 16px;font-family:${FONT};font-size:15px;line-height:1.55;color:${INK};word-break:break-word;">${html}</td></tr></table>`,
		8,
	);
}

/** El marco completo. `footer` es HTML ya compuesto por quien llama (con sus enlaces escapados). */
function card(input: { title: string; preheader: string; plate: string; app: string | null; content: string; footer: string }): string {
	const filler = "&nbsp;&zwnj;".repeat(40);
	return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(input.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&amp;display=swap" rel="stylesheet" />
<style>
  :root { color-scheme: light only; supported-color-schemes: light; }
  body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table { border-collapse: collapse; mso-table-lspace: 0; mso-table-rspace: 0; }
  a { color: ${ACCENT}; }
  /* Modo oscuro, en lo posible: el suelo, la tarjeta y la píldora se quedan como son. */
  @media (prefers-color-scheme: dark) {
    body, .ground { background: ${GROUND} !important; }
    .surface { background: ${SURFACE} !important; }
    .ink-text, .ink-text h1, .ink-text p { color: ${INK} !important; }
    .ink-bg { background: ${INK} !important; color: ${SURFACE} !important; }
    .ink-fg { color: ${SURFACE} !important; }
  }
  [data-ogsb] body, [data-ogsb] .ground { background-color: ${GROUND} !important; }
  [data-ogsb] .surface { background-color: ${SURFACE} !important; }
  [data-ogsb] .ink-bg { background-color: ${INK} !important; }
  [data-ogsc] .ink-text, [data-ogsc] .ink-text h1, [data-ogsc] .ink-text p { color: ${INK} !important; }
  [data-ogsc] .ink-bg, [data-ogsc] .ink-fg { color: ${SURFACE} !important; }
  @media only screen and (max-width: 599px) {
    .col { width: 100% !important; max-width: 100% !important; }
    .pad { padding-left: 16px !important; padding-right: 16px !important; }
    .cardpad { padding: 24px 20px 8px !important; }
    .ftable, .ftable tbody, .frow { display: block !important; width: 100% !important; }
    .stack { display: block !important; width: 100% !important; box-sizing: border-box; }
    .kcell { padding: 11px 0 0 !important; }
    .vcell { border-top: 0 !important; padding-top: 2px !important; }
    .act { width: 100% !important; }
    .act a { display: block !important; }
  }
</style>
</head>
<body class="ground" bgcolor="${GROUND}" style="margin:0;padding:0;background:${GROUND};color:${INK};font-family:${FONT};">
<div data-preheader style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(input.preheader)}${filler}</div>
<table role="presentation" class="ground" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${GROUND}" style="background:${GROUND};">
<tr><td align="center" style="padding:0;">
<table role="presentation" class="col" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
<tr><td class="pad" style="padding:32px 24px 18px;">${brandRow(input.plate, input.app)}</td></tr>
<tr><td class="pad" style="padding:0 24px;">
<table role="presentation" class="surface" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${SURFACE}" style="background:${SURFACE};border-radius:20px;">
<tr><td class="cardpad ink-text" style="padding:32px 32px 16px;font-family:${FONT};color:${INK};">${input.content}</td></tr>
</table>
</td></tr>
<tr><td class="pad" style="padding:18px 32px 40px;font-family:${FONT};font-size:13px;line-height:1.55;color:${INK_3};">${input.footer}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/**
 * El cuerpo de una notificación dentro de la tarjeta. Una función suelta y no un
 * cierre de `createEmailer` para que las copias a mano de los Workers de tiempo
 * real puedan pegarla tal cual con su placa y su app fijas.
 */
function renderNotification(
	cfg: { plate: string; app: string | null; productName: string },
	input: NotificationEmailInput,
): string {
	const {
		recipientName,
		heading: title,
		body,
		url,
		ctaLabel = `Open in ${cfg.productName}`,
		details,
		preview,
		previewLabel = "Preview",
		warning,
		preferencesUrl,
	} = input;

	const footer = preferencesUrl
		? `You're receiving this because of your ${escapeHtml(cfg.productName)} notification settings. <a href="${escapeHtml(preferencesUrl)}" style="color:${INK_2};text-decoration:underline;">Manage preferences</a>.`
		: `You're receiving this because of your ${escapeHtml(cfg.productName)} notification settings.`;

	return card({
		title,
		preheader: `Hi ${recipientName}, ${body}`,
		plate: cfg.plate,
		app: cfg.app,
		footer,
		content: [
			heading(escapeHtml(title)),
			para(`Hi ${escapeHtml(recipientName)}, ${escapeHtml(body)}`),
			warning ? stampBox("Warning", escapeHtml(warning)) : "",
			preview ? previewBlock(previewLabel, escapeHtml(preview).replace(/\n/g, "<br />")) : "",
			action(url, ctaLabel),
			details?.length ? facts(details) : "",
		].join("\n"),
	});
}

export function createEmailer(brand: {
	/** La placa de la tarjeta y el nombre From por defecto, p. ej. «OnDesk Vault»; su última palabra elige el swatch de la línea. */
	brandName: string;
	/** Cómo lo dicen el CTA y el pie, p. ej. «Vault» → «Open in Vault». */
	productName: string;
}): Emailer {
	const { brandName, productName } = brand;

	async function sendEmail(env: EmailEnv, opts: EmailOptions): Promise<void> {
		if (!emailConfigured(env)) {
			throw new Error("Email is not configured (CF_ACCOUNT_ID, EMAIL_API_TOKEN, EMAIL_FROM)");
		}

		const res = await fetch(
			`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/email/sending/send`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${env.EMAIL_API_TOKEN}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					from: { address: env.EMAIL_FROM, name: env.EMAIL_FROM_NAME ?? brandName },
					to: opts.to,
					subject: opts.subject,
					html: opts.html,
					text: opts.text ?? htmlToText(opts.html),
				}),
			},
		);

		const body = (await res.json().catch(() => null)) as SendResponse | null;

		if (!res.ok || !body?.success) {
			const detail = body?.errors?.map((e) => `${e.code} ${e.message}`).join("; ") || `HTTP ${res.status}`;
			throw new Error(`Email delivery failed (${res.status}): ${detail}`);
		}

		const bounced = body.result?.permanent_bounces;
		if (bounced?.length) {
			throw new Error(`Email permanently bounced: ${bounced.join(", ")}`);
		}
	}

	// La plantilla es `renderNotification` (arriba): la marca lleva la baldosa de la app
	// y su nombre.
	const cfg = { plate: brandName, app: appFor(brandName), productName };

	function notificationEmail(input: NotificationEmailInput): string {
		return renderNotification(cfg, input);
	}

	return { sendEmail, notificationEmail };
}

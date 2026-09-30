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
 * La plantilla es el mapa de red hecho apto para correo (banda de las seis líneas,
 * placa con el swatch de la línea de la app, billete de tinta, tabla de datos);
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

// ─── La tarjeta: el mapa de red hecho apto para correo ───────────────────────
//
// Un correo de producto es un billete impreso de la red: la banda de las seis
// líneas, la placa de la app con el swatch de su línea al lado, un titular, una o
// dos frases, UNA acción (un billete de tinta cuadrado) y los datos como tabla de
// tarifas, sobre papel. Es la misma forma que `ondesk/functions/_lib/email.ts`; la
// versión de ondesk lleva además el código y la carta del buzón, que aquí no
// existen. Tablas con `role="presentation"`, estilos en línea en todo lo que
// importa (el `<style>` sólo lleva la consulta de móvil), `bgcolor` además de
// estilos, columna de 600px fluida por debajo, sin imágenes, radios ni sombras y
// claro solo. Hay dos copias a mano de esto (`halo-realtime/src/notify.ts` y
// `nexus-realtime/src/notify.ts`): un cambio de diseño se hace en las tres.

const FONT = "'Fira Sans','Segoe UI',Helvetica,Arial,sans-serif";
const INK = "#111111";
const INK_2 = "#4d4d4d";
const RULE = "#cfcfcf";
const PAPER = "#ffffff";
const DESTRUCTIVE = "#b3261e";

/** Las seis líneas en el orden del mapa: Pulse, Vault, Orbit, Nexus, Halo, Atlas. */
const LINE_COLOURS = ["#e2231a", "#00843d", "#0019a8", "#ef7b10", "#b3007a", "#0098a6"];

/**
 * El swatch de cada app junto a su placa. Se deduce de la última palabra del
 * nombre de marca («OnDesk Pulse» → pulse) y no de un parámetro nuevo, para que
 * un producto que aún fija una versión anterior de este paquete no falle al
 * compilar cuando cambie su envoltorio.
 */
const APP_LINE: Record<string, string> = {
	pulse: "#e2231a",
	vault: "#00843d",
	orbit: "#0019a8",
	nexus: "#ef7b10",
	halo: "#b3007a",
	atlas: "#0098a6",
};

function lineFor(brandName: string): string | null {
	const last = brandName.trim().split(/\s+/).pop()?.toLowerCase() ?? "";
	return APP_LINE[last] ?? null;
}

function band(px: number): string {
	const rows = LINE_COLOURS.map(
		(colour) =>
			`<tr><td height="${px}" bgcolor="${colour}" style="height:${px}px;line-height:${px}px;font-size:${px}px;mso-line-height-rule:exactly;background:${colour};">&nbsp;</td></tr>`,
	).join("");
	return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rows}</table>`;
}

/** La placa (celda de tinta, texto de papel, 800) y, si hay, el swatch de la línea. */
function plateBlock(name: string, line: string | null): string {
	const swatch = line
		? `<td width="10" style="width:10px;font-size:1px;line-height:1px;">&nbsp;</td><td valign="middle"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="26" height="10" bgcolor="${line}" style="width:26px;height:10px;line-height:10px;font-size:10px;mso-line-height-rule:exactly;background:${line};">&nbsp;</td></tr></table></td>`
		: "";
	return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td bgcolor="${INK}" style="background:${INK};color:${PAPER};font-family:${FONT};font-size:18px;font-weight:800;letter-spacing:-0.02em;line-height:22px;padding:6px 11px 8px;">${escapeHtml(name)}</td>${swatch}</tr></table>`;
}

function heading(text: string): string {
	return `<h1 style="margin:0 0 16px;font-family:${FONT};font-size:26px;line-height:1.15;font-weight:800;letter-spacing:-0.02em;color:${INK};">${text}</h1>`;
}

function para(html: string): string {
	return `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.55;color:${INK};">${html}</p>`;
}

/** Bloque en tabla con su separación arriba en el `padding` de celda (Outlook ignora el margin). */
function block(inner: string, top = 8): string {
	return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:${top}px 0 16px;">${inner}</td></tr></table>`;
}

/** El billete: celda de tinta con borde de 3px, cuadrada, texto de papel en negrita. */
function action(url: string, label: string): string {
	return block(
		`<table role="presentation" class="act" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${INK}" style="background:${INK};border:3px solid ${INK};padding:14px 28px;font-family:${FONT};font-size:16px;line-height:20px;font-weight:700;"><a href="${escapeHtml(url)}" style="color:${PAPER};text-decoration:none;font-weight:700;display:inline-block;">${escapeHtml(label)}</a></td></tr></table>`,
		8,
	);
}

/** La tabla de tarifas: claves en etiqueta, valores en negrita, reglas de 1px. */
function facts(rows: { label: string; value: string }[]): string {
	const body = rows
		.map(
			(row) =>
				`<tr class="frow"><td class="stack kcell" width="130" valign="top" style="border-top:1px solid ${RULE};padding:10px 12px 10px 0;font-family:${FONT};font-size:12px;line-height:18px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${INK_2};">${escapeHtml(row.label)}</td><td class="stack vcell" valign="top" style="border-top:1px solid ${RULE};padding:10px 0;font-family:${FONT};font-size:15px;line-height:20px;font-weight:700;color:${INK};word-break:break-word;">${escapeHtml(row.value)}</td></tr>`,
		)
		.join("");
	return block(
		`<table role="presentation" class="ftable" width="100%" cellpadding="0" cellspacing="0" border="0">${body}<tr class="frow"><td class="stack" colspan="2" height="1" style="border-top:1px solid ${RULE};height:1px;line-height:1px;font-size:1px;">&nbsp;</td></tr></table>`,
		8,
	);
}

/** Aviso: caja de 3px destructiva con un sello impreso. `html` YA viene escapado. */
function stampBox(stamp: string, html: string): string {
	return block(
		`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border:3px solid ${DESTRUCTIVE};padding:14px 16px;font-family:${FONT};"><p style="margin:0 0 8px;font-family:${FONT};font-size:11px;line-height:14px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:${DESTRUCTIVE};"><span style="border:1px solid ${DESTRUCTIVE};padding:2px 6px;">${escapeHtml(stamp)}</span></p><p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.5;font-weight:700;color:${INK};">${html}</p></td></tr></table>`,
		8,
	);
}

/** Vista previa: entre reglas de 1px, bajo una etiqueta pequeña. `html` YA viene escapado. */
function previewBlock(label: string, html: string): string {
	return block(
		`<p style="margin:0 0 6px;font-family:${FONT};font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${INK_2};">${escapeHtml(label)}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid ${RULE};border-bottom:1px solid ${RULE};padding:12px 0;font-family:${FONT};font-size:15px;line-height:1.5;color:${INK};word-break:break-word;">${html}</td></tr></table>`,
		8,
	);
}

/** El marco completo. `footer` es HTML ya compuesto por quien llama (con sus enlaces escapados). */
function card(input: { title: string; preheader: string; plate: string; line: string | null; content: string; footer: string }): string {
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
<link href="https://fonts.googleapis.com/css2?family=Fira+Sans:wght@400;700;800&amp;display=swap" rel="stylesheet" />
<style>
  :root { color-scheme: light only; supported-color-schemes: light; }
  body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table { border-collapse: collapse; mso-table-lspace: 0; mso-table-rspace: 0; }
  a { color: ${INK}; }
  @media only screen and (max-width: 599px) {
    .col { width: 100% !important; max-width: 100% !important; }
    .pad { padding-left: 20px !important; padding-right: 20px !important; }
    .ftable, .ftable tbody, .frow { display: block !important; width: 100% !important; }
    .stack { display: block !important; width: 100% !important; box-sizing: border-box; }
    .kcell { border-top: 1px solid ${RULE} !important; padding: 10px 0 0 !important; }
    .vcell { border-top: 0 !important; padding-top: 4px !important; }
    .act { width: 100% !important; }
  }
</style>
</head>
<body bgcolor="${PAPER}" style="margin:0;padding:0;background:${PAPER};color:${INK};font-family:${FONT};">
<div data-preheader style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(input.preheader)}${filler}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAPER}" style="background:${PAPER};">
<tr><td align="center" style="padding:0;">
<table role="presentation" class="col" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAPER}" style="width:600px;max-width:600px;background:${PAPER};">
<tr><td>${band(4)}</td></tr>
<tr><td class="pad" style="padding:24px 32px 0;">${plateBlock(input.plate, input.line)}</td></tr>
<tr><td class="pad" style="padding:24px 32px 0;font-family:${FONT};color:${INK};">${input.content}</td></tr>
<tr><td class="pad" style="padding:32px 32px 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid ${RULE};padding:16px 0 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${INK_2};">${input.footer}</td></tr></table>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/**
 * El cuerpo de una notificación dentro de la tarjeta. Una función suelta y no un
 * cierre de `createEmailer` para que las copias a mano de los Workers de tiempo
 * real puedan pegarla tal cual con su placa y su línea fijas.
 */
function renderNotification(
	cfg: { plate: string; line: string | null; productName: string },
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
		? `You're receiving this because of your ${escapeHtml(cfg.productName)} notification settings. <a href="${escapeHtml(preferencesUrl)}" style="color:${INK};font-weight:700;text-decoration:underline;">Manage preferences</a>.`
		: `You're receiving this because of your ${escapeHtml(cfg.productName)} notification settings.`;

	return card({
		title,
		preheader: `Hi ${recipientName}, ${body}`,
		plate: cfg.plate,
		line: cfg.line,
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

	// La plantilla es `renderNotification` (arriba): la placa lleva el nombre de la app
	// y, al lado, el swatch de su línea.
	const cfg = { plate: brandName, line: lineFor(brandName), productName };

	function notificationEmail(input: NotificationEmailInput): string {
		return renderNotification(cfg, input);
	}

	return { sendEmail, notificationEmail };
}

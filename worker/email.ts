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
 * `functions/_lib/email.ts` de cada app llama a `createEmailer` con su logotipo
 * de texto y su nombre de producto y reexporta el par, así que notify.ts nunca
 * sabe que este paquete existe.
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

/** Alternativa en texto plano para que los mensajes no sean sólo HTML (ayuda con la puntuación antispam). */
export function htmlToText(html: string): string {
	return html
		.replace(/<(style|script|head)\b[\s\S]*?<\/\1>/gi, "")
		.replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n\n")
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/g, " ")
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
	/** Filas clave/valor que se pintan encima del CTA. */
	details?: { label: string; value: string }[];
	/**
	 * Contenido citado que se pinta bajo el cuerpo — el comentario o mensaje que
	 * disparó el email. Los productos cuyo contenido no debe viajar por correo
	 * (Vault: una credencial se abre por la ruta de revelado, el único camino que
	 * registra quién miró) simplemente no lo pasan nunca.
	 */
	preview?: string;
	/** Se pinta como un aviso en rojo. Se usa para caducidad y revocación. */
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

export function createEmailer(brand: {
	/** El logotipo de texto de la tarjeta y el nombre From por defecto, p. ej. «OnDesk Vault». */
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

	function baseTemplate(title: string, content: string, footer: string): string {
		return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; margin: 0; padding: 40px 16px; color: #18181b; }
    .card { background: #ffffff; border-radius: 12px; max-width: 480px; margin: 0 auto; padding: 40px 36px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .logo { font-size: 20px; font-weight: 700; margin-bottom: 32px; color: #18181b; }
    h1 { font-size: 22px; font-weight: 700; margin: 0 0 8px; }
    p { font-size: 15px; color: #52525b; line-height: 1.6; margin: 0 0 20px; }
    .btn { display: inline-block; background: #18181b; color: #ffffff !important; text-decoration: none; font-size: 15px; font-weight: 600; padding: 12px 28px; border-radius: 8px; margin: 8px 0 24px; }
    .footer { font-size: 12px; color: #a1a1aa; margin-top: 32px; border-top: 1px solid #f4f4f5; padding-top: 20px; }
    .warning { background: #fef2f2; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #b91c1c; margin-bottom: 20px; }
    .quote { border-left: 3px solid #e4e4e7; padding: 2px 0 2px 14px; margin: 0 0 20px; font-size: 14px; color: #3f3f46; }
    .meta { background: #f4f4f5; border-radius: 8px; padding: 14px 16px; margin: 0 0 20px; font-size: 13px; color: #52525b; }
    .meta-row { margin: 0 0 6px; }
    .meta-row:last-child { margin-bottom: 0; }
    .meta-key { color: #a1a1aa; display: inline-block; min-width: 84px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">${brandName}</div>
    ${content}
    <div class="footer">${footer}</div>
  </div>
</body>
</html>`;
	}

	function notificationEmail(input: NotificationEmailInput): string {
		const {
			recipientName,
			heading,
			body,
			url,
			ctaLabel = `Open in ${productName}`,
			details,
			preview,
			warning,
			preferencesUrl,
		} = input;

		const detailsBlock = details?.length
			? `<div class="meta">${details
					.map(
						(d) => `<p class="meta-row"><span class="meta-key">${escapeHtml(d.label)}</span> ${escapeHtml(d.value)}</p>`,
					)
					.join("")}</div>`
			: "";

		const previewBlock = preview ? `<div class="quote">${escapeHtml(preview).replace(/\n/g, "<br />")}</div>` : "";
		const warningBlock = warning ? `<div class="warning">${escapeHtml(warning)}</div>` : "";

		const footer = preferencesUrl
			? `You're receiving this because of your ${productName} notification settings. <a href="${preferencesUrl}" style="color:#71717a;">Manage preferences</a>.`
			: `You're receiving this because of your ${productName} notification settings.`;

		return baseTemplate(
			heading,
			`
    <h1>${escapeHtml(heading)}</h1>
    <p>Hi ${escapeHtml(recipientName)}, ${escapeHtml(body)}</p>
    ${warningBlock}
    ${previewBlock}
    ${detailsBlock}
    <a href="${url}" class="btn">${escapeHtml(ctaLabel)}</a>
  `,
			footer,
		);
	}

	return { sendEmail, notificationEmail };
}

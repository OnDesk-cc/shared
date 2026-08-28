/**
 * Transactional email for a product's notifications.
 *
 * A product sends nothing else. Password resets, invitations and two-factor
 * codes are ondesk's — the products authenticate nobody, so they have no
 * account mail to send. Adding one in a product would mean a second origin able
 * to speak in the platform's name about someone's account.
 *
 * One implementation, branded per product: each app's `functions/_lib/email.ts`
 * calls `createEmailer` with its wordmark and product name and re-exports the
 * pair, so notify.ts never knows this package exists.
 */

interface EmailOptions {
	to: string;
	subject: string;
	html: string;
	/** Plain-text alternative. Derived from `html` when omitted. */
	text?: string;
}

/** What sending needs from a product's bindings, structurally. */
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

/** Plain-text fallback so messages aren't HTML-only (helps spam scoring). */
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
 * Strips HTML and clamps content down to a short preview. No default length on
 * purpose: the products settled on different ones before this moved here, and
 * each app's thin `_lib/email.ts` wrapper keeps its own.
 */
export function excerpt(html: string, maxLength: number): string {
	const text = htmlToText(html);
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength).trimEnd()}…`;
}

/** Escapes anything a person typed before it reaches the HTML. */
export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

export interface NotificationEmailInput {
	/** Recipient's display name. */
	recipientName: string;
	/** Headline, e.g. "ACME-42 was assigned to you". */
	heading: string;
	/** One-line explanation of what happened. */
	body: string;
	/** Absolute link into the product. */
	url: string;
	ctaLabel?: string;
	/** Key/value rows rendered above the CTA. */
	details?: { label: string; value: string }[];
	/**
	 * Quoted content rendered under the body — the comment or message that
	 * triggered the email. Products whose content must not travel by mail
	 * (Vault: a credential is opened by the reveal route, the one path that
	 * records who looked) simply never pass it.
	 */
	preview?: string;
	/** Rendered as a red callout. Used for expiry and revocation. */
	warning?: string;
	/** Link to the preferences screen, shown in the footer. */
	preferencesUrl?: string;
}

export interface Emailer {
	/**
	 * Sends through the Cloudflare Email Sending REST API. Pages Functions
	 * cannot use the `send_email` Workers binding, so this calls the
	 * account-scoped endpoint with an API token instead.
	 */
	sendEmail(env: EmailEnv, opts: EmailOptions): Promise<void>;
	/** The one notification template every product mail is rendered with. */
	notificationEmail(input: NotificationEmailInput): string;
}

export function createEmailer(brand: {
	/** The card's wordmark and default From name, e.g. "OnDesk Vault". */
	brandName: string;
	/** How the CTA and footer say it, e.g. "Vault" → "Open in Vault". */
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

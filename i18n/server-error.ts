/**
 * El texto de un error del servidor en el idioma de quien lee (receta R4 de la
 * spec `ondesk/docs/specs/2026-11-06-plataforma-multilingue.md`).
 *
 * Los endpoints propios responden `{ error: "Folder not found" }` en inglés, y así
 * se quedan: la API pública (`/api/v1`) y los registros los leen así. Cada app
 * lleva en su diccionario un apartado `errors` cuyas claves son códigos estables
 * y cuyo texto inglés es, palabra por palabra, el mensaje del servidor; las
 * variables van como en cualquier otra clave (`"A name may be at most {max}
 * characters"`). Con eso, la app encuentra el código de un mensaje sin que el
 * servidor tenga que mandarlo:
 *
 *   1. `code` en la respuesta, si lo hay y el diccionario lo conoce (con `params`);
 *   2. el mensaje exacto;
 *   3. el mensaje reconocido por una plantilla: los valores salen del mensaje y
 *      entran en la traducción;
 *   4. si nada casa, el mensaje tal cual (un error que nadie tradujo se lee en
 *      inglés, nunca se pierde), y sin mensaje, `fallback`.
 */
import { interpolate, type Vars } from "./format";

export interface ServerErrorBody {
	error?: string;
	code?: string;
	params?: Vars;
}

type Messages = Record<string, string>;

const cache = new WeakMap<Messages, { exact: Map<string, string>; templates: { key: string; re: RegExp; names: string[] }[] }>();

function index(en: Messages) {
	let found = cache.get(en);
	if (found) return found;
	const exact = new Map<string, string>();
	const templates: { key: string; re: RegExp; names: string[] }[] = [];
	for (const [key, text] of Object.entries(en)) {
		if (!/\{\w+\}/.test(text)) {
			exact.set(text, key);
			continue;
		}
		const names: string[] = [];
		const pattern = text
			.split(/(\{\w+\})/)
			.map((part) => {
				const m = /^\{(\w+)\}$/.exec(part);
				if (m) {
					names.push(m[1]);
					return "(.+?)";
				}
				return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			})
			.join("");
		templates.push({ key, re: new RegExp(`^${pattern}$`, "s"), names });
	}
	found = { exact, templates };
	cache.set(en, found);
	return found;
}

/**
 * `en` y `local` son el apartado `errors` del diccionario inglés y del de quien
 * lee (el mismo objeto si lee en inglés).
 */
export function translateServerError(body: ServerErrorBody | null | undefined, en: Messages, local: Messages, fallback = ""): string {
	if (body?.code && local[body.code] !== undefined) return interpolate(local[body.code], body.params ?? {});
	const message = body?.error;
	if (!message) return fallback;
	const { exact, templates } = index(en);
	const key = exact.get(message);
	if (key !== undefined && local[key] !== undefined) return local[key];
	for (const t of templates) {
		const m = t.re.exec(message);
		if (!m || local[t.key] === undefined) continue;
		const vars: Vars = {};
		t.names.forEach((name, i) => {
			vars[name] = m[i + 1];
		});
		return interpolate(local[t.key], vars);
	}
	return message;
}

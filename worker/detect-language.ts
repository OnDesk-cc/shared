/**
 * ¿En qué idioma escribe alguien que no tiene cuenta? Lo usa Pulse con el primer
 * mensaje de un ticket que entra por correo, para mandarle los textos automáticos
 * (acuse, avisos de SLA) en su idioma.
 *
 * Es un contador de palabras frecuentes, sin modelo: basta para separar en, es y
 * pt, es gratis y es determinista. La regla importante es la de la duda: si no
 * hay al menos 4 aciertos o el ganador no dobla al segundo, devuelve null y el
 * llamador usa el idioma del workspace. Adivinar mal es peor que no adivinar.
 */
import type { Locale } from "../i18n/locale";

// Palabras frecuentes de uso general, elegidas porque NO se comparten entre los
// tres idiomas: por eso faltan «de», «a», «o», «no», «nos», «que», «para», «me»,
// «se», «como», «desde», «está», «esta», y en inglés «do» y «as» (portugués).
const WORDS: Record<Locale, readonly string[]> = {
	en: ["the", "and", "is", "you", "your", "can", "please", "thanks", "thank", "with", "have", "not", "this", "my", "i", "it", "we", "are", "since", "to", "of", "for", "would", "could", "will", "from", "was", "be", "hi", "hello", "help", "need", "get", "an", "at", "on", "if", "but", "what", "how", "there", "our"],
	es: ["el", "la", "los", "las", "y", "es", "por", "favor", "gracias", "hola", "puedo", "pueden", "mi", "con", "una", "un", "del", "al", "necesito", "tengo", "ya", "pero", "muy", "cuenta", "ayuda", "ayudar", "quiero", "hay", "su", "sus", "también", "cuando", "donde", "porque", "hacer", "buenos", "buenas", "ayer", "acceder", "tiene"],
	pt: ["os", "e", "é", "obrigado", "obrigada", "olá", "não", "consigo", "minha", "meu", "vocês", "você", "com", "uma", "um", "da", "dos", "das", "ao", "na", "pelo", "pela", "preciso", "tenho", "já", "bom", "dia", "muito", "pode", "podem", "também", "quando", "onde", "porque", "fazer", "isso", "esse", "essa", "mas", "conta", "ajuda", "ajudar", "ontem", "acessar", "tem"],
};

const INDEX = new Map<string, Locale[]>();
for (const [locale, words] of Object.entries(WORDS) as [Locale, readonly string[]][]) {
	for (const w of words) INDEX.set(w, [...(INDEX.get(w) ?? []), locale]);
}

const MIN_HITS = 4;

/** Quita HTML, la cita de la respuesta anterior y la firma: sólo cuenta lo que escribió esta persona. */
function ownText(text: string): string {
	const plain = text
		.replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ")
		.replace(/<br\s*\/?>|<\/(p|div|li)>/gi, "\n")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/g, " ");
	const kept: string[] = [];
	for (const line of plain.split(/\r?\n/)) {
		const t = line.trim();
		if (t === "--" || t === "-- " || line.startsWith("-- ")) break;
		if (/^(On|El|Em)\b.+(wrote|escribió|escreveu):\s*$/i.test(t)) break;
		if (t.startsWith(">")) continue;
		kept.push(line);
	}
	return kept.join(" ").toLowerCase();
}

export function detectTextLocale(text: string): Locale | null {
	const words = ownText(text).match(/\p{L}+/gu) ?? [];
	const hits: Record<Locale, number> = { en: 0, es: 0, pt: 0 };
	for (const w of words) for (const l of INDEX.get(w) ?? []) hits[l]++;
	const ranked = (Object.entries(hits) as [Locale, number][]).sort((a, b) => b[1] - a[1]);
	const [[best, top], [, second]] = ranked;
	if (top < MIN_HITS || top < second * 2) return null;
	return best;
}

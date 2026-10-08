/**
 * La búsqueda semántica de Nova central (fase 1b, 2026-10-07). Spec:
 * ondesk/docs/specs/2026-10-07-nova-central.md § 2b.
 *
 * El índice vive en Nova; aquí está lo que comparten Nova y los productos:
 *
 *   chunkText       el corte del texto en trozos, el mismo a los dos lados: Nova
 *                   embebe cada trozo y el producto recalcula el del acierto
 *                   para el extracto, así que Nova no guarda ningún texto
 *   novaExcerpt     el extracto de un trozo, para un resultado
 *   pickReadable    cómo elige el producto los resultados: el mejor trozo por
 *                   objeto y sólo los que su puerta de permisos resuelve
 *   takeFeedPage    cómo pagina un producto su bandeja (`nova_outbox`) sin
 *                   perder nunca un objeto
 *   NOVA_CANDIDATES_SCHEMA  el parámetro `candidates` de una herramienta `retrieval`
 */
import type { JsonSchema } from "./json-schema";
import type { NovaSearchCandidate } from "./nova-contract";

/** El `sub` del token con el que el indexador de Nova llama a `<producto>.index_feed`. */
export const NOVA_INDEXER_SUBJECT = "nova:indexer";
/** Cuánto texto de un objeto entra en el índice; lo que sigue no se busca. */
export const NOVA_INDEX_MAX_CHARS = 24_000;
export const NOVA_CHUNK_CHARS = 1_200;
export const NOVA_CHUNK_OVERLAP = 150;
export const NOVA_EXCERPT_CHARS = 400;

/** Espacios normalizados, cortado a NOVA_INDEX_MAX_CHARS y partido en trozos que acaban en un espacio y se solapan. */
export function chunkText(text: string): string[] {
	const clean = text.replace(/\s+/g, " ").trim().slice(0, NOVA_INDEX_MAX_CHARS);
	if (!clean) return [];
	const chunks: string[] = [];
	let start = 0;
	while (start < clean.length) {
		let end = Math.min(start + NOVA_CHUNK_CHARS, clean.length);
		if (end < clean.length) {
			const cut = clean.lastIndexOf(" ", end);
			if (cut > start + NOVA_CHUNK_CHARS / 2) end = cut;
		}
		chunks.push(clean.slice(start, end).trim());
		if (end >= clean.length) break;
		// El siguiente empieza en la primera palabra de los últimos 150 caracteres.
		const space = clean.indexOf(" ", end - NOVA_CHUNK_OVERLAP);
		start = space > start && space < end ? space + 1 : end;
	}
	return chunks;
}

/** El trozo `chunk` del texto actual (o el primero, si el texto cambió y ya no existe), en 400 caracteres. */
export function novaExcerpt(text: string, chunk: number): string {
	const chunks = chunkText(text);
	const piece = chunks[chunk] ?? chunks[0] ?? "";
	if (piece.length <= NOVA_EXCERPT_CHARS) return piece;
	return `${piece.slice(0, NOVA_EXCERPT_CHARS).replace(/\s+\S*$/, "")}…`;
}

/** Un candidato por objeto (el trozo con más puntuación), de más a menos parecido. */
export function bestPerItem(candidates: NovaSearchCandidate[]): NovaSearchCandidate[] {
	const best = new Map<string, NovaSearchCandidate>();
	for (const c of candidates) {
		const key = `${c.kind}:${c.id}`;
		const prev = best.get(key);
		if (!prev || c.score > prev.score) best.set(key, c);
	}
	return [...best.values()].sort((a, b) => b.score - a.score);
}

/**
 * Los resultados de una búsqueda: por orden de parecido, sólo los que `resolve`
 * (la puerta de permisos del producto) devuelve, hasta `limit`. El índice
 * propone; quien decide qué puede abrir esta persona es siempre el producto.
 */
export async function pickReadable<T>(
	candidates: NovaSearchCandidate[],
	limit: number,
	resolve: (candidate: NovaSearchCandidate) => Promise<T | null>,
): Promise<T[]> {
	const out: T[] = [];
	for (const c of bestPerItem(candidates)) {
		if (out.length >= limit) break;
		const hit = await resolve(c);
		if (hit !== null) out.push(hit);
	}
	return out;
}

/** Una fila de `nova_outbox` de un producto. */
export interface OutboxRow {
	seq: number;
	kind: string;
	item_id: string;
	workspace_id: string;
}

/**
 * Una página del feed: filas en orden de `seq`, compactadas por objeto, hasta
 * `limit` objetos distintos. `nextAfter` es el `seq` de la última fila
 * consumida, así que una fila de un objeto que no cupo nunca queda detrás del
 * cursor.
 */
export function takeFeedPage(rows: OutboxRow[], after: number, limit: number): { items: OutboxRow[]; nextAfter: number; consumed: number } {
	const items = new Map<string, OutboxRow>();
	let nextAfter = after;
	let consumed = 0;
	for (const row of rows) {
		const key = `${row.kind}:${row.item_id}`;
		if (!items.has(key) && items.size >= limit) break;
		items.set(key, row);
		nextAfter = row.seq;
		consumed++;
	}
	return { items: [...items.values()], nextAfter, consumed };
}

/** El parámetro `candidates` de una herramienta `retrieval`; lo rellena Nova, nunca el modelo. */
export const NOVA_CANDIDATES_SCHEMA: JsonSchema = {
	type: "array",
	maxItems: 50,
	items: {
		type: "object",
		additionalProperties: false,
		required: ["kind", "id", "chunk", "score"],
		properties: {
			kind: { type: "string", maxLength: 16 },
			id: { type: "string", maxLength: 64 },
			chunk: { type: "integer", minimum: 0, maximum: 100 },
			score: { type: "number" },
		},
	},
};

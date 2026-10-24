/**
 * La bandeja de eventos de automatización de un producto (2026-10-21). Spec:
 * ondesk/docs/specs/2026-10-21-automatizaciones.md § 2.
 *
 * Cada producto con disparadores (Pulse, Orbit, Halo, Atlas) tiene la tabla
 * `automation_events` (`AUTOMATION_EVENTS_SQL`, en su migración y en su
 * `schema.sql`) y la publica como herramienta `index` con `feed: "automations"`
 * (`automationEventsTool`). Nova la lee después de su cursor, empareja cada
 * evento con las automatizaciones del workspace y lee el objeto como el dueño:
 * por eso un evento sólo lleva un puntero (`resource`), quién lo hizo, el
 * `origin` y los datos del cambio, nunca el contenido del objeto.
 *
 *   enqueueAutomationEvents  las filas de una escritura, en un `db.batch`. Se
 *                            llama con await justo después de escribir; NUNCA
 *                            lanza (registra y devuelve 0): un evento perdido no
 *                            puede tumbar lo que hizo una persona. Un `data` de
 *                            más de 2 048 caracteres se guarda como {}
 *   readAutomationEvents     el feed: en orden de `seq`, después de `after`, 100
 *                            como mucho
 *   purgeAutomationEvents    lo de más de 3 días; la herramienta del feed la
 *                            lanza en `waitUntil` cada vez que Nova lee
 *   pokeNovaFor              POST ${NOVA_ISSUER}/api/events/poke {product}, en
 *                            `waitUntil`, con 3 s de tope; nunca lanza. Sin datos:
 *                            lo peor que puede hacer quien lo falsifique es
 *                            adelantar una lectura
 *   automationEventsTool     `<product>.automation_events`, para `nova:indexer`
 */
import { AUTOMATION_EVENT_DATA_MAX_CHARS, type NovaAutomationEvent, type NovaAutomationFeed, type NovaScalar } from "./nova-contract";
import { defineTool, novaIssuer, type NovaToolDef, type NovaToolsEnv } from "./nova-tools";

export const AUTOMATION_EVENTS_MAX_LIMIT = 100;
export const AUTOMATION_EVENTS_RETENTION_SECONDS = 3 * 86_400;
const POKE_TIMEOUT_MS = 3_000;

/** La tabla, igual en los cuatro productos: su migración y su `schema.sql` la copian tal cual. */
export const AUTOMATION_EVENTS_SQL = `CREATE TABLE IF NOT EXISTS automation_events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  resource TEXT NOT NULL,
  actor_id TEXT,
  origin TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_automation_events_created ON automation_events(created_at);`;

export interface AutomationEventInput {
	type: string;
	workspaceId: string;
	/** `<product>:<kind>:<id>`. */
	resource: string;
	actorId: string | null;
	origin: string | null;
	/** Los campos `change` del disparador; sin campo, {}. */
	data?: Record<string, NovaScalar>;
}

type Row = Omit<NovaAutomationEvent, "data"> & { data: string };

function dataJson(event: AutomationEventInput): string {
	const json = JSON.stringify(event.data ?? {});
	if (json.length <= AUTOMATION_EVENT_DATA_MAX_CHARS) return json;
	console.error(`automation_events: data of ${event.type} is ${json.length} chars, stored as {}`);
	return "{}";
}

export async function enqueueAutomationEvents(db: D1Database, events: AutomationEventInput[]): Promise<number> {
	if (events.length === 0) return 0;
	try {
		await db.batch(
			events.map((e) =>
				db
					.prepare("INSERT INTO automation_events (id, type, workspace_id, resource, actor_id, origin, data) VALUES (?, ?, ?, ?, ?, ?, ?)")
					.bind(crypto.randomUUID(), e.type, e.workspaceId, e.resource, e.actorId, e.origin, dataJson(e)),
			),
		);
		return events.length;
	} catch (err) {
		console.error(`automation_events: could not write ${events.map((e) => e.type).join(", ")}:`, err);
		return 0;
	}
}

function parseData(raw: string): Record<string, NovaScalar> {
	try {
		const value = JSON.parse(raw) as unknown;
		return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, NovaScalar>) : {};
	} catch {
		return {};
	}
}

export async function readAutomationEvents(db: D1Database, after: number, limit: number): Promise<NovaAutomationFeed> {
	const take = Math.max(1, Math.min(AUTOMATION_EVENTS_MAX_LIMIT, Math.floor(limit)));
	const { results } = await db.prepare("SELECT * FROM automation_events WHERE seq > ? ORDER BY seq LIMIT ?").bind(after, take + 1).all<Row>();
	const rows = results ?? [];
	const page = rows.slice(0, take).map((r) => ({ ...r, data: parseData(r.data) }));
	return { events: page, next_after: page.length > 0 ? page[page.length - 1].seq : after, has_more: rows.length > take };
}

export async function purgeAutomationEvents(db: D1Database, nowSec: number): Promise<number> {
	const res = await db.prepare("DELETE FROM automation_events WHERE created_at < ?").bind(nowSec - AUTOMATION_EVENTS_RETENTION_SECONDS).run();
	return res.meta.changes ?? 0;
}

export function pokeNovaFor(env: { NOVA_ISSUER?: string }, product: string, waitUntil: (p: Promise<unknown>) => void): void {
	try {
		waitUntil(
			fetch(`${novaIssuer(env)}/api/events/poke`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ product }),
				signal: AbortSignal.timeout(POKE_TIMEOUT_MS),
			})
				.then((res) => res.body?.cancel())
				.catch((err) => console.error(`automation_events: could not poke Nova for ${product}:`, err instanceof Error ? err.message : err)),
		);
	} catch (err) {
		console.error(`automation_events: could not poke Nova for ${product}:`, err);
	}
}

export function automationEventsTool<E extends NovaToolsEnv>(product: string): NovaToolDef<E> {
	return defineTool<E, { after: number; limit?: number }>({
		name: `${product}.automation_events`,
		kind: "index",
		feed: "automations",
		description: `${product}'s automation event inbox after a cursor, for Nova's automations. Never offered to the model.`,
		params: {
			type: "object",
			additionalProperties: false,
			required: ["after"],
			properties: { after: { type: "integer", minimum: 0 }, limit: { type: "integer", minimum: 1, maximum: AUTOMATION_EVENTS_MAX_LIMIT } },
		},
		async run(ctx, params) {
			const feed = await readAutomationEvents(ctx.env.DB, params.after, params.limit ?? AUTOMATION_EVENTS_MAX_LIMIT);
			ctx.waitUntil(purgeAutomationEvents(ctx.env.DB, Math.floor(Date.now() / 1000)).catch((err) => console.error("automation_events purge failed:", err)));
			return feed;
		},
	});
}

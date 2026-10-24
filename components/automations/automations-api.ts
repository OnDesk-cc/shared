/**
 * El cliente de la API de automatizaciones de Nova (`/api/automations/*`,
 * 2026-10-21; spec ondesk/docs/specs/2026-10-21-automatizaciones.md § 7). Lo usan
 * el panel de Ajustes de cada app y la página de la consola de ondesk.
 *
 * Va directo a Nova con la cookie de sesión de `.ondesk.cc`
 * (`credentials: "include"`), como el panel de Nova. Una respuesta que no es OK
 * lanza `AutomationsError` con el `error` y el `code` que manda Nova
 * (`plan_limit`, `owner_change`, `invalid`, `forbidden`, `not_found`); un 204
 * devuelve `undefined`. `automationsKeys` son las claves de TanStack Query: todas
 * empiezan por `["automations", workspace]`, así que invalidar ésa refresca todo.
 */
import type { NovaSubject } from "../../worker/nova-contract";
import {
	automationsUrl,
	type Catalog,
	type FlowConditions,
	type FlowRunView,
	type FlowStep,
	type FlowTestResult,
	type ListedFlow,
	type FlowOutcome,
} from "./automations-model";

export class AutomationsError extends Error {
	readonly status: number;
	readonly code: string | null;
	constructor(message: string, status: number, code: string | null) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

export interface FlowInput {
	name: string;
	description?: string;
	trigger_type: string;
	conditions: FlowConditions;
	steps: FlowStep[];
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
	const res = await fetch(url, { credentials: "include", ...init });
	if (res.status === 204) return undefined as T;
	const body = (await res.json().catch(() => null)) as { error?: unknown; code?: unknown } | null;
	if (!res.ok) {
		const message = typeof body?.error === "string" ? body.error : "Automations are unavailable right now. Try again in a minute.";
		throw new AutomationsError(message, res.status, typeof body?.code === "string" ? body.code : null);
	}
	return body as T;
}

function send<T>(url: string, method: string, body?: unknown): Promise<T> {
	return request<T>(url, { method, headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

const ws = (workspace: string, extra: Record<string, string> = {}) => ({ workspace, ...extra });

export const automationsApi = {
	catalog: (novaHost: string, workspace: string) => request<Catalog>(automationsUrl(novaHost, "catalog", ws(workspace))),
	list: async (novaHost: string, workspace: string, product?: string) =>
		(await request<{ automations: ListedFlow[] }>(automationsUrl(novaHost, "", ws(workspace, product ? { product } : {})))).automations,
	get: async (novaHost: string, workspace: string, id: string) => (await request<{ automation: ListedFlow }>(automationsUrl(novaHost, id, ws(workspace)))).automation,
	create: async (novaHost: string, workspace: string, input: FlowInput) =>
		(await send<{ automation: ListedFlow }>(automationsUrl(novaHost, "", ws(workspace)), "POST", input)).automation,
	update: async (novaHost: string, workspace: string, id: string, patch: Partial<FlowInput>, opts: { confirmOwner?: boolean } = {}) =>
		(await send<{ automation: ListedFlow }>(automationsUrl(novaHost, id, ws(workspace)), "PATCH", { ...patch, ...(opts.confirmOwner ? { confirm_owner: true } : {}) }))
			.automation,
	remove: (novaHost: string, workspace: string, id: string) => send<void>(automationsUrl(novaHost, id, ws(workspace)), "DELETE"),
	pause: async (novaHost: string, workspace: string, id: string) => (await send<{ automation: ListedFlow }>(automationsUrl(novaHost, `${id}/pause`, ws(workspace)), "POST")).automation,
	resume: async (novaHost: string, workspace: string, id: string) => (await send<{ automation: ListedFlow }>(automationsUrl(novaHost, `${id}/resume`, ws(workspace)), "POST")).automation,
	takeOver: async (novaHost: string, workspace: string, id: string) =>
		(await send<{ automation: ListedFlow }>(automationsUrl(novaHost, `${id}/take-over`, ws(workspace)), "POST")).automation,
	test: (novaHost: string, workspace: string, id: string, resource: string) => send<FlowTestResult>(automationsUrl(novaHost, `${id}/test`, ws(workspace)), "POST", { resource }),
	runs: (novaHost: string, workspace: string, q: { flow?: string; outcome?: FlowOutcome; before?: string } = {}) =>
		request<{ runs: FlowRunView[]; next_cursor: string | null }>(
			automationsUrl(novaHost, "runs", ws(workspace, Object.fromEntries(Object.entries(q).filter(([, v]) => typeof v === "string" && v !== "")) as Record<string, string>)),
		),
	options: async (novaHost: string, workspace: string, tool: string) =>
		(await request<{ options: { value: string; label: string }[] }>(automationsUrl(novaHost, "options", ws(workspace, { tool })))).options,
	subjects: async (novaHost: string, workspace: string, type: string, q: string) =>
		(await request<{ subjects: { resource: string; label: string }[] }>(automationsUrl(novaHost, "subjects", ws(workspace, { type, q })))).subjects,
};

export type { NovaSubject };

export const automationsKeys = {
	all: (workspace: string) => ["automations", workspace] as const,
	catalog: (workspace: string) => ["automations", workspace, "catalog"] as const,
	list: (workspace: string, product?: string) => ["automations", workspace, "list", product ?? "all"] as const,
	runs: (workspace: string, flow?: string) => ["automations", workspace, "runs", flow ?? "all"] as const,
	options: (workspace: string, tool: string) => ["automations", workspace, "options", tool] as const,
};

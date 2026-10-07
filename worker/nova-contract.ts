/**
 * Los tipos del contrato entre Nova central y las herramientas de un producto
 * (2026-10-07). Sin ninguna dependencia de runtime, a propósito: los importan los
 * dos lados — los productos (worker/nova-tools.ts, con los tipos de Pages) y el
 * Worker de Nova (con su propia versión de @cloudflare/workers-types) — y un
 * import de `PagesFunction` aquí haría chocar las dos versiones de `Response`.
 */
import type { JsonSchema } from "./json-schema";

export type { JsonSchema } from "./json-schema";

/** Lo que el manifiesto dice de una herramienta (todo menos su `run`). */
export interface NovaManifestTool {
	name: string;
	/** En inglés: la lee el modelo. */
	description: string;
	kind: "read" | "write";
	destructive?: boolean;
	/** true: Nova la llama sola al empezar cada turno y nunca se la ofrece al modelo. */
	auto?: boolean;
	params: JsonSchema;
}

export interface NovaManifest {
	product: string;
	version: string;
	/** Cómo contestar en este producto: lo que antes era «HOW TO ANSWER» en su prompt. */
	guidance: string;
	tools: NovaManifestTool[];
}

export type NovaToolErrorCode = "unauthorized" | "forbidden" | "payment_required" | "not_found" | "invalid_params" | "too_large" | "failed";

export type NovaToolResponse = { ok: true; data: unknown } | { ok: false; code: NovaToolErrorCode; message: string };

export interface NovaToolClaims {
	iss: string;
	aud: string;
	sub: string;
	workspace: string;
	tool: string;
	origin: string;
	resource?: string;
	jti: string;
	iat: number;
	exp: number;
	[key: string]: unknown;
}

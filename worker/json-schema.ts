/**
 * El subconjunto de JSON Schema con el que se describen los parámetros de una
 * herramienta de Nova, y su validador (2026-10-07, Nova central).
 *
 * Lo justo para lo que un modelo manda: objetos, cadenas, números, booleanos,
 * listas, `enum`, `required`, `additionalProperties: false` y los límites. Lo
 * comparten los dos lados: el producto lo usa aquí para rechazar parámetros
 * inventados con un `invalid_params` (nunca un 500), y Nova se lo pasa tal cual
 * al modelo como esquema de la herramienta.
 */
export interface JsonSchema {
	type: "object" | "string" | "number" | "integer" | "boolean" | "array";
	description?: string;
	properties?: Record<string, JsonSchema>;
	required?: string[];
	additionalProperties?: false;
	items?: JsonSchema;
	enum?: readonly (string | number)[];
	minimum?: number;
	maximum?: number;
	maxLength?: number;
	maxItems?: number;
}

/** La lista de errores, en inglés porque llega al modelo; vacía si vale. */
export function validateParams(schema: JsonSchema, value: unknown, path = "params"): string[] {
	const errors: string[] = [];
	switch (schema.type) {
		case "object": {
			if (typeof value !== "object" || value === null || Array.isArray(value)) return [`${path} must be an object`];
			const obj = value as Record<string, unknown>;
			for (const key of schema.required ?? []) {
				if (obj[key] === undefined) errors.push(`${path}.${key} is required`);
			}
			for (const [key, child] of Object.entries(obj)) {
				const sub = schema.properties?.[key];
				if (!sub) {
					if (schema.additionalProperties === false) errors.push(`${path}.${key} is not allowed`);
					continue;
				}
				if (child === undefined) continue;
				errors.push(...validateParams(sub, child, `${path}.${key}`));
			}
			return errors;
		}
		case "array": {
			if (!Array.isArray(value)) return [`${path} must be an array`];
			if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path} must have at most ${schema.maxItems} items`);
			if (schema.items) value.forEach((item, i) => errors.push(...validateParams(schema.items!, item, `${path}[${i}]`)));
			return errors;
		}
		case "string":
			if (typeof value !== "string") return [`${path} must be a string`];
			if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path} must be at most ${schema.maxLength} characters`);
			break;
		case "integer":
		case "number":
			if (typeof value !== "number" || !Number.isFinite(value) || (schema.type === "integer" && !Number.isInteger(value))) {
				return [`${path} must be ${schema.type === "integer" ? "an integer" : "a number"}`];
			}
			if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path} must be >= ${schema.minimum}`);
			if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path} must be <= ${schema.maximum}`);
			break;
		case "boolean":
			if (typeof value !== "boolean") return [`${path} must be a boolean`];
			break;
	}
	if (schema.enum && !schema.enum.includes(value as string | number)) errors.push(`${path} must be one of ${schema.enum.join(", ")}`);
	return errors;
}

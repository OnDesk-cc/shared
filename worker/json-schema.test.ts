// Pruebas del validador de parámetros de las herramientas de Nova: `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateParams, type JsonSchema } from "./json-schema.ts";

const schema: JsonSchema = {
	type: "object",
	additionalProperties: false,
	required: ["query"],
	properties: {
		query: { type: "string", maxLength: 10 },
		limit: { type: "integer", minimum: 1, maximum: 50 },
		done: { type: "boolean" },
		kind: { type: "string", enum: ["tickets", "contacts"] },
		place: { type: "object", additionalProperties: false, properties: { channel_id: { type: "string", maxLength: 64 } } },
	},
};

test("un objeto válido no da errores", () => {
	assert.deepEqual(validateParams(schema, { query: "late", limit: 5, done: false, kind: "tickets", place: { channel_id: "c1" } }), []);
});

test("falta un requerido", () => {
	assert.deepEqual(validateParams(schema, {}), ["params.query is required"]);
});

test("propiedad de más con additionalProperties: false", () => {
	assert.deepEqual(validateParams(schema, { query: "a", extra: 1 }), ["params.extra is not allowed"]);
});

test("tipos, límites y enum", () => {
	assert.deepEqual(validateParams(schema, { query: "a", limit: 9999 }), ["params.limit must be <= 50"]);
	assert.deepEqual(validateParams(schema, { query: "a", limit: 1.5 }), ["params.limit must be an integer"]);
	assert.deepEqual(validateParams(schema, { query: "abcdefghijkl" }), ["params.query must be at most 10 characters"]);
	assert.deepEqual(validateParams(schema, { query: "a", done: "yes" }), ["params.done must be a boolean"]);
	assert.deepEqual(validateParams(schema, { query: "a", kind: "users" }), ["params.kind must be one of tickets, contacts"]);
	assert.deepEqual(validateParams(schema, { query: "a", place: { dm: "x" } }), ["params.place.dm is not allowed"]);
});

test("no es un objeto", () => {
	assert.deepEqual(validateParams(schema, null), ["params must be an object"]);
	assert.deepEqual(validateParams(schema, []), ["params must be an object"]);
});

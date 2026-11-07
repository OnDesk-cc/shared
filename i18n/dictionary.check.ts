/**
 * Prueba de tipos de `Translation`, que corre `npm run typecheck`: si una de
 * estas líneas deja de ser un error, el `@ts-expect-error` falla el typecheck.
 */
import type { Translation } from "./dictionary";

const en = {
	title: "Settings",
	seats: { one: "{count} seat", other: "{count} seats" },
	nested: { save: "Save" },
};
type Dict = Translation<typeof en>;

export const ok: Dict = { title: "Ajustes", seats: { one: "{count} asiento", other: "{count} asientos" }, nested: { save: "Guardar" } };

// @ts-expect-error falta `nested`
export const missingKey: Dict = { title: "Ajustes", seats: { one: "a", other: "b" } };

// @ts-expect-error un plural escrito como texto
export const pluralAsText: Dict = { title: "Ajustes", seats: "asientos", nested: { save: "Guardar" } };

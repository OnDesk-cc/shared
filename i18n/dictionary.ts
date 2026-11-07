/**
 * El tipo que obliga a que `es` y `pt` estén completos. Cada repo escribe su
 * diccionario inglés como objeto literal y declara
 *
 *   export type AppDict = Translation<typeof en>;
 *   export const es: AppDict = { … };
 *
 * Una clave que falta, o una hoja de plural escrita como texto, es un error de
 * typecheck: una traducción incompleta no se puede desplegar.
 */
import type { PluralForms } from "./format";

export type Translation<T> = T extends string
	? string
	: T extends PluralForms
		? PluralForms
		: T extends readonly (infer U)[]
			? readonly Translation<U>[]
			: { readonly [K in keyof T]: Translation<T[K]> };

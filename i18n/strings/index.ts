// Los textos de los componentes de `@ondesk/shared` por idioma. Sin React: los
// usan también funciones puras como las de `presence/status.ts`.
import type { Translation } from "../dictionary";
import type { Locale } from "../locale";
import { en } from "./en";
import { es } from "./es";
import { pt } from "./pt";

export type SharedDict = Translation<typeof en>;

export const SHARED_STRINGS: Record<Locale, SharedDict> = { en, es, pt };

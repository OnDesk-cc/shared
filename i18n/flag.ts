/**
 * El interruptor `languages_enabled` visto desde una SPA. Lo sirve ondesk en
 * `GET /api/platform/languages` (público y cacheable) y se guarda el último valor
 * en localStorage para arrancar ya en el idioma bueno, sin pintar inglés y
 * cambiar después. Mientras está apagado todo resuelve a inglés.
 */
type Store = Pick<Storage, "getItem" | "setItem">;

const KEY = "ondesk_languages_enabled";

function defaultStore(): Store | null {
	try {
		return typeof localStorage === "undefined" ? null : localStorage;
	} catch {
		return null;
	}
}

export function cachedLanguagesEnabled(storage: Store | null = defaultStore()): boolean {
	try {
		return storage?.getItem(KEY) === "1";
	} catch {
		return false;
	}
}

export async function fetchLanguagesEnabled(
	ondeskOrigin: string,
	fetcher: typeof fetch = fetch,
	storage: Store | null = defaultStore(),
): Promise<boolean> {
	try {
		const res = await fetcher(`${ondeskOrigin}/api/platform/languages`);
		if (!res.ok) return cachedLanguagesEnabled(storage);
		const body = (await res.json()) as { enabled?: unknown };
		const enabled = body.enabled === true;
		try {
			storage?.setItem(KEY, enabled ? "1" : "0");
		} catch {
			// Almacenamiento bloqueado: el valor de esta carga sigue sirviendo.
		}
		return enabled;
	} catch {
		return cachedLanguagesEnabled(storage);
	}
}

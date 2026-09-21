/**
 * El cliente CRUD que se repetía en cada feature, escrito una vez.
 *
 * Casi todos los recursos de los productos hablan el mismo dialecto con su
 * backend: `GET /x` devuelve `{ xs: [...] }`, `GET /x/:id` devuelve
 * `{ x: {...} }`, POST y PATCH devuelven el recurso y DELETE no devuelve nada.
 * Las dos fábricas de aquí construyen ese cliente a partir de tres datos
 * (`basePath`, `listKey`, `itemKey`) en vez de que cada feature escriba cinco
 * `fetch` idénticos.
 *
 * ── Las dos formas ───────────────────────────────────────────────────────────
 *
 *   createWorkspaceScopedApi  el recurso pertenece a un workspace. El id va en
 *                             la query (`?workspace_id=`) y NO en el cuerpo: en
 *                             `create` se saca del input a propósito, porque el
 *                             servidor lo lee de la query para comprobar la
 *                             pertenencia ANTES de mirar lo que le mandas.
 *   createUserScopedApi       el recurso es de la persona. No hay workspace: lo
 *                             que se puede ver sale de la sesión.
 *
 * ── Dos cosas que hay que saber ──────────────────────────────────────────────
 *
 * Todo va con `credentials: "include"`, que es lo que hace que funcione la
 * cookie compartida de `.ondesk.cc` contra el subdominio del producto.
 *
 * Un fallo se convierte en `throw new Error(err.error)`, leyendo el
 * `{ error: string }` que garantiza `worker/response.ts`. Eso significa que el
 * CÓDIGO de estado se pierde: quien necesite distinguir un 402 `plan_limit` de
 * un 403 no puede usar estas fábricas y tiene que llamar a `fetch` a mano.
 *
 * Lo usan pulse, orbit, nexus, halo y atlas. Vault no.
 */
interface CrudApiConfig {
	basePath: string;
	listKey: string;
	itemKey: string;
}

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
	return fetch(url, {
		...options,
		credentials: "include",
	});
}

async function handleResponse<T>(res: Response, errorMessage: string): Promise<T> {
	if (!res.ok) {
		const err = (await res.json()) as { error: string };
		throw new Error(err.error ?? errorMessage);
	}
	return res.json() as Promise<T>;
}

export interface WorkspaceScopedApi<T, CreateInput extends { workspace_id: string }, UpdateInput> {
	getAll(workspaceId: string): Promise<T[]>;
	getById(id: string): Promise<T>;
	create(input: CreateInput): Promise<T>;
	update(id: string, input: UpdateInput): Promise<T>;
	delete(id: string): Promise<void>;
}

export interface UserScopedApi<T, CreateInput, UpdateInput> {
	getAll(): Promise<T[]>;
	getById(id: string): Promise<T>;
	create(input: CreateInput): Promise<T>;
	update(id: string, input: UpdateInput): Promise<T>;
	delete(id: string): Promise<void>;
}

export function createWorkspaceScopedApi<
	T,
	CreateInput extends { workspace_id: string },
	UpdateInput,
>(config: CrudApiConfig): WorkspaceScopedApi<T, CreateInput, UpdateInput> {
	const { basePath, listKey, itemKey } = config;

	return {
		async getAll(workspaceId) {
			const res = await fetch(`${basePath}?workspace_id=${workspaceId}`, { credentials: "include" });
			const data = await handleResponse<Record<string, T[]>>(res, `Failed to fetch ${listKey}`);
			return data[listKey];
		},

		async getById(id) {
			const res = await fetch(`${basePath}/${id}`, { credentials: "include" });
			const data = await handleResponse<Record<string, T>>(res, `${itemKey} not found`);
			return data[itemKey];
		},

		async create(input) {
			const { workspace_id, ...body } = input;
			const res = await fetch(`${basePath}?workspace_id=${workspace_id}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify(body),
			});
			const data = await handleResponse<Record<string, T>>(res, `Failed to create ${itemKey}`);
			return data[itemKey];
		},

		async update(id, input) {
			const res = await fetch(`${basePath}/${id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify(input),
			});
			const data = await handleResponse<Record<string, T>>(res, `Failed to update ${itemKey}`);
			return data[itemKey];
		},

		async delete(id) {
			const res = await fetch(`${basePath}/${id}`, {
				method: "DELETE",
				credentials: "include",
			});
			await handleResponse<unknown>(res, `Failed to delete ${itemKey}`);
		},
	};
}

export function createUserScopedApi<T, CreateInput, UpdateInput>(
	config: CrudApiConfig
): UserScopedApi<T, CreateInput, UpdateInput> {
	const { basePath, listKey, itemKey } = config;

	return {
		async getAll() {
			const res = await fetch(basePath, { credentials: "include" });
			const data = await handleResponse<Record<string, T[]>>(res, `Failed to fetch ${listKey}`);
			return data[listKey];
		},

		async getById(id) {
			const res = await fetch(`${basePath}/${id}`, { credentials: "include" });
			const data = await handleResponse<Record<string, T>>(res, `${itemKey} not found`);
			return data[itemKey];
		},

		async create(input) {
			const res = await fetch(basePath, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify(input),
			});
			const data = await handleResponse<Record<string, T>>(res, `Failed to create ${itemKey}`);
			return data[itemKey];
		},

		async update(id, input) {
			const res = await fetch(`${basePath}/${id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify(input),
			});
			const data = await handleResponse<Record<string, T>>(res, `Failed to update ${itemKey}`);
			return data[itemKey];
		},

		async delete(id) {
			const res = await fetch(`${basePath}/${id}`, {
				method: "DELETE",
				credentials: "include",
			});
			await handleResponse<unknown>(res, `Failed to delete ${itemKey}`);
		},
	};
}

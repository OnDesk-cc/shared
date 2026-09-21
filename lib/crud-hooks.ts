/**
 * Los hooks de React Query que van encima de `crud-api.ts`.
 *
 * Fabrican, para un recurso, los dos de lectura (`useAll`, `useById`) y los tres
 * de escritura (`useCreate`, `useUpdate`, `useDelete`) con la invalidación ya
 * cableada — que es la parte que se olvida y deja una lista sin refrescar
 * después de crear algo.
 *
 * ── Las claves ───────────────────────────────────────────────────────────────
 *
 *   all(workspaceId)  ["recurso", workspaceId]   ← la lista de un workspace
 *   detail(id)        ["recurso", id]            ← una ficha
 *
 * Comparten prefijo, así que invalidar la lista NO toca las fichas ni al revés:
 * por eso `useUpdate` invalida las dos explícitamente.
 *
 * `staleTime` de 5 minutos en todo. Es un valor de catálogo — listas que cambian
 * poco —, no de bandeja: lo que tiene que estar fresco (tickets, mensajes,
 * notificaciones) NO usa estas fábricas, tiene sus propios hooks con su propio
 * tiempo.
 *
 * Las mutaciones no hacen nada optimista: se espera al servidor y luego se
 * invalida. Hoy el único consumidor es pulse.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const STALE_TIME = 1000 * 60 * 5;

// ─── Workspace-scoped query hooks ─────────────────────────────────────────────

export function createWorkspaceScopedQueryHooks<T>(
	resourceName: string,
	api: {
		getAll: (workspaceId: string) => Promise<T[]>;
		getById: (id: string) => Promise<T>;
	}
) {
	const queryKeys = {
		all: (workspaceId: string) => [resourceName, workspaceId] as const,
		detail: (id: string) => [resourceName, id] as const,
	};

	function useAll(workspaceId: string) {
		return useQuery({
			queryKey: queryKeys.all(workspaceId),
			queryFn: () => api.getAll(workspaceId),
			staleTime: STALE_TIME,
		});
	}

	function useById(id: string) {
		return useQuery({
			queryKey: queryKeys.detail(id),
			queryFn: () => api.getById(id),
			staleTime: STALE_TIME,
		});
	}

	return { queryKeys, useAll, useById };
}

// ─── User-scoped query hooks ──────────────────────────────────────────────────

export function createUserScopedQueryHooks<T>(
	resourceName: string,
	api: {
		getAll: () => Promise<T[]>;
		getById: (id: string) => Promise<T>;
	}
) {
	const queryKeys = {
		all: () => [resourceName] as const,
		detail: (id: string) => [resourceName, id] as const,
	};

	function useAll() {
		return useQuery({
			queryKey: queryKeys.all(),
			queryFn: api.getAll,
			staleTime: STALE_TIME,
		});
	}

	function useById(id: string) {
		return useQuery({
			queryKey: queryKeys.detail(id),
			queryFn: () => api.getById(id),
			staleTime: STALE_TIME,
		});
	}

	return { queryKeys, useAll, useById };
}

// ─── Workspace-scoped mutation hooks ──────────────────────────────────────────

export function createWorkspaceScopedMutationHooks<T, CreateInput, UpdateInput>(
	queryKeys: {
		all: (workspaceId: string) => readonly unknown[];
		detail: (id: string) => readonly unknown[];
	},
	api: {
		create: (input: CreateInput) => Promise<T>;
		update: (id: string, input: UpdateInput) => Promise<T>;
		delete: (id: string) => Promise<void>;
	}
) {
	function useCreate(workspaceId: string) {
		const queryClient = useQueryClient();
		return useMutation({
			mutationFn: (input: CreateInput) => api.create(input),
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: queryKeys.all(workspaceId) });
			},
		});
	}

	function useUpdate(resourceId: string, workspaceId: string) {
		const queryClient = useQueryClient();
		return useMutation({
			mutationFn: (input: UpdateInput) => api.update(resourceId, input),
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: queryKeys.all(workspaceId) });
				queryClient.invalidateQueries({ queryKey: queryKeys.detail(resourceId) });
			},
		});
	}

	function useDelete(workspaceId: string) {
		const queryClient = useQueryClient();
		return useMutation({
			mutationFn: (id: string) => api.delete(id),
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: queryKeys.all(workspaceId) });
			},
		});
	}

	return { useCreate, useUpdate, useDelete };
}

// ─── User-scoped mutation hooks ────────────────────────────────────────────────

export function createUserScopedMutationHooks<T, CreateInput, UpdateInput>(
	queryKeys: {
		all: () => readonly unknown[];
		detail: (id: string) => readonly unknown[];
	},
	api: {
		create: (input: CreateInput) => Promise<T>;
		update: (id: string, input: UpdateInput) => Promise<T>;
		delete: (id: string) => Promise<void>;
	}
) {
	function useCreate() {
		const queryClient = useQueryClient();
		return useMutation({
			mutationFn: (input: CreateInput) => api.create(input),
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: queryKeys.all() });
			},
		});
	}

	function useUpdate(resourceId: string) {
		const queryClient = useQueryClient();
		return useMutation({
			mutationFn: (input: UpdateInput) => api.update(resourceId, input),
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: queryKeys.all() });
				queryClient.invalidateQueries({ queryKey: queryKeys.detail(resourceId) });
			},
		});
	}

	function useDelete() {
		const queryClient = useQueryClient();
		return useMutation({
			mutationFn: (id: string) => api.delete(id),
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: queryKeys.all() });
			},
		});
	}

	return { useCreate, useUpdate, useDelete };
}

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

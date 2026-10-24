/**
 * Las consultas y mutaciones de TanStack Query de las automatizaciones
 * (2026-10-21), sobre `automationsApi`. Cada mutación invalida
 * `["automations", workspace]` al terminar: la lista de la app, la de la
 * consola y el historial se refrescan juntos.
 *
 * El catálogo cambia poco (sale de los manifiestos de las apps), así que vive 5
 * minutos; las opciones de un selector, 1 minuto.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { automationsApi, automationsKeys, type FlowInput } from "./automations-api";
import type { FlowOutcome } from "./automations-model";

export function useAutomationsCatalog(novaHost: string, workspaceId: string) {
	return useQuery({
		queryKey: automationsKeys.catalog(workspaceId),
		queryFn: () => automationsApi.catalog(novaHost, workspaceId),
		staleTime: 5 * 60_000,
	});
}

export function useAutomationsList(novaHost: string, workspaceId: string, product?: string) {
	return useQuery({
		queryKey: automationsKeys.list(workspaceId, product),
		queryFn: () => automationsApi.list(novaHost, workspaceId, product),
	});
}

export function useFlowOptions(novaHost: string, workspaceId: string, tool: string | null) {
	return useQuery({
		queryKey: automationsKeys.options(workspaceId, tool ?? ""),
		queryFn: () => automationsApi.options(novaHost, workspaceId, tool ?? ""),
		enabled: tool !== null,
		staleTime: 60_000,
	});
}

export function useFlowRuns(novaHost: string, workspaceId: string, q: { flow?: string; outcome?: FlowOutcome; before?: string }) {
	return useQuery({
		queryKey: [...automationsKeys.runs(workspaceId, q.flow), q.outcome ?? "all", q.before ?? ""],
		queryFn: () => automationsApi.runs(novaHost, workspaceId, q),
	});
}

/** Las acciones de una fila y del editor; todas refrescan lo del workspace al acabar. */
export function useFlowMutations(novaHost: string, workspaceId: string) {
	const qc = useQueryClient();
	const settle = { onSettled: () => qc.invalidateQueries({ queryKey: automationsKeys.all(workspaceId) }) };
	return {
		create: useMutation({ mutationFn: (input: FlowInput) => automationsApi.create(novaHost, workspaceId, input), ...settle }),
		update: useMutation({
			mutationFn: (v: { id: string; patch: Partial<FlowInput>; confirmOwner?: boolean }) =>
				automationsApi.update(novaHost, workspaceId, v.id, v.patch, { confirmOwner: v.confirmOwner }),
			...settle,
		}),
		remove: useMutation({ mutationFn: (id: string) => automationsApi.remove(novaHost, workspaceId, id), ...settle }),
		pause: useMutation({ mutationFn: (id: string) => automationsApi.pause(novaHost, workspaceId, id), ...settle }),
		resume: useMutation({ mutationFn: (id: string) => automationsApi.resume(novaHost, workspaceId, id), ...settle }),
		takeOver: useMutation({ mutationFn: (id: string) => automationsApi.takeOver(novaHost, workspaceId, id), ...settle }),
	};
}

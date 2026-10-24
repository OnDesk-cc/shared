/**
 * El historial de ejecuciones (2026-10-21): de una automatización (en su
 * editor) o de todo el workspace (en la consola). Filtro por resultado arriba,
 * una fila por ejecución (resultado en palabra, qué la disparó, cuándo) y, al
 * abrirla, su rastro paso a paso con un enlace a lo que creó o cambió.
 *
 * Las saltadas por condiciones no llegan aquí: el motor no las guarda. Pagina
 * con «Show older», que pide la página siguiente con el cursor opaco de Nova.
 */
import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { Alert, Skeleton } from "../console-kit";
import { EmptyState, RowList, rowClass, RowContent } from "../console";
import { Segmented } from "../segmented";
import { ago, reasonText, type Catalog, type FlowOutcome, type FlowRunView, type ListedFlow } from "./automations-model";
import { OutcomeTag } from "./flow-parts";
import { useFlowRuns } from "./use-automations";

type Filter = "all" | FlowOutcome;

const FILTERS: { value: Filter; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "done", label: "Done" },
	{ value: "failed", label: "Failed" },
	{ value: "unknown", label: "Check it" },
	{ value: "skipped", label: "Skipped" },
];

function triggerLabel(catalog: Catalog | undefined, type: string): string {
	return catalog?.triggers.find((t) => t.type === type)?.label ?? type;
}

export function RunsList({
	novaHost,
	workspaceId,
	catalog,
	flowId,
	flows,
}: {
	novaHost: string;
	workspaceId: string;
	catalog: Catalog | undefined;
	flowId?: string;
	/** En la consola, para poner el nombre de la automatización en cada fila. */
	flows?: ListedFlow[];
}) {
	const [filter, setFilter] = useState<Filter>("all");
	const [cursors, setCursors] = useState<string[]>([]);
	const before = cursors[cursors.length - 1];
	const runs = useFlowRuns(novaHost, workspaceId, { flow: flowId, outcome: filter === "all" ? undefined : filter, before });
	const names = new Map((flows ?? []).map((f) => [f.id, f.name]));

	return (
		<div className="flex flex-col gap-4">
			<Segmented
				label="Result"
				size="sm"
				value={filter}
				onChange={(v) => {
					setFilter(v);
					setCursors([]);
				}}
				options={FILTERS}
			/>
			{runs.isPending ? (
				<Skeleton rows={3} />
			) : runs.isError ? (
				<Alert error={runs.error} />
			) : runs.data.runs.length === 0 ? (
				<EmptyState
					title={filter === "all" ? "No runs yet" : "No runs with this result"}
					description={filter === "all" ? "Each time it starts, a run shows up here with what each step did." : undefined}
				/>
			) : (
				<>
					<RowList label="Runs">
						{runs.data.runs.map((run) => (
							<RunRow key={run.id} run={run} title={flowId ? triggerLabel(catalog, run.event_type) : (names.get(run.flow_id) ?? triggerLabel(catalog, run.event_type))} />
						))}
					</RowList>
					<div className="flex gap-2">
						{cursors.length > 0 && (
							<button type="button" className="ticket ticket--sm" onClick={() => setCursors((c) => c.slice(0, -1))}>
								Newer
							</button>
						)}
						{runs.data.next_cursor && (
							<button type="button" className="ticket ticket--sm" onClick={() => setCursors((c) => [...c, runs.data.next_cursor as string])}>
								Show older
							</button>
						)}
					</div>
				</>
			)}
		</div>
	);
}

function RunRow({ run, title }: { run: FlowRunView; title: string }) {
	const [open, setOpen] = useState(false);
	const reason = reasonText(run.reason);
	return (
		<li>
			<button type="button" className={`${rowClass} w-full text-left`} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
				<RowContent
					lead={<OutcomeTag outcome={run.outcome} />}
					title={title}
					sub={reason || (run.trace.length ? run.trace.map((t) => t.summary).filter(Boolean).join(", ") : undefined)}
					end={
						<span className="inline-flex items-center gap-2">
							<span className="sk-num">{ago(run.created_at)}</span>
							<ChevronDown className={`size-4 transition-transform duration-200 ease-out ${open ? "rotate-180" : ""}`} strokeWidth={1.75} aria-hidden="true" />
						</span>
					}
				/>
			</button>
			{open && (
				<ol className="mb-3 ml-3 mt-1 flex flex-col gap-2 border-l border-(--sk-hair-2) pl-4">
					{run.trace.length === 0 ? (
						<li className="sk-small">No step ran.{reason ? ` ${reason}` : ""}</li>
					) : (
						run.trace.map((step) => (
							<li key={step.step} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.9375rem] text-(--sk-ink-2)">
								<span className="font-medium text-(--sk-ink)">Step {step.step}</span>
								<OutcomeTag outcome={step.outcome} />
								<span className="min-w-0 [overflow-wrap:anywhere]">{step.summary}</span>
								{step.link && (
									<a href={step.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-(--sk-accent) hover:underline">
										Open
										<ExternalLink className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
									</a>
								)}
							</li>
						))
					)}
				</ol>
			)}
		</li>
	);
}

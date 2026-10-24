/**
 * Las automatizaciones en una app y en la consola (2026-10-21). Spec:
 * ondesk/docs/specs/2026-10-21-automatizaciones.md § 8.
 *
 *   AutomationsPanel    la sección «Automations» de Ajustes de una app:
 *                       - «Start here»: las que empiezan en esta app, con su
 *                         ruta de baldosas, su frase, su estado y lo de 7 días;
 *                         con `canManage`, se abren, se crean y se pausan;
 *                       - «Act here»: las que tocan esta app desde otra, de sólo
 *                         lectura, con el enlace a la app donde empiezan;
 *                       - el enlace a la consola, donde están todas
 *   AutomationsConsole  la página de la consola de ondesk: todas, con un filtro
 *                       por app, y el historial del workspace entero
 *
 * Las dos abren el mismo editor (automation-editor.tsx) en la misma página, en
 * lugar de la lista. Borrar pide confirmación; pausar, reanudar y tomar no.
 * La puerta de verdad es Nova: `canManage` sólo esconde lo que daría 403.
 */
import { useState } from "react";
import { Pause, Play, Plus, Trash2, UserRoundCheck } from "lucide-react";
import { ActionMenu, ConfirmRow, SheetDialog, Skeleton, type MenuItem } from "../console-kit";
import { EmptyState, LinkArrow, Panel, RowContent, RowList, rowClass, rowStaticClass, textLinkClass } from "../console";
import { Callout } from "../callout";
import { Segmented } from "../segmented";
import { AutomationsError } from "./automations-api";
import { flowSentence, PRODUCT_LABELS, statusLine, type AutomationProduct, type Catalog, type ListedFlow } from "./automations-model";
import { AutomationEditor } from "./automation-editor";
import { FlowRoute, StatusTag } from "./flow-parts";
import { RunsList } from "./runs-list";
import { useAutomationsCatalog, useAutomationsList, useFlowMutations } from "./use-automations";

type View = { kind: "list" } | { kind: "new" } | { kind: "edit"; id: string };

interface Common {
	novaHost: string;
	workspaceId: string;
	/** Quien mira: para saber si es el dueño de una automatización. */
	userId: string;
	/** El nombre de un miembro por su id (lo que ya tiene la app); sin él, «another member». */
	memberName?: (id: string) => string | null;
}

function unavailable(error: unknown): string {
	if (error instanceof AutomationsError && error.status === 403) return error.message;
	return "Automations are unavailable right now. Try again in a minute.";
}

function stats(flow: ListedFlow): string | null {
	if (!flow.stats || (flow.stats.done === 0 && flow.stats.failed === 0)) return null;
	const runs = flow.stats.done + flow.stats.failed;
	return `${runs} ${runs === 1 ? "run" : "runs"} this week${flow.stats.failed ? `, ${flow.stats.failed} failed` : ""}`;
}

function runsAs(flow: ListedFlow, userId: string, memberName?: (id: string) => string | null): string {
	if (flow.owner_id === userId) return "Runs as you";
	const name = memberName?.(flow.owner_id);
	return name ? `Runs as ${name}` : "Runs as another member";
}

export function AutomationsPanel({
	product,
	canManage,
	ondeskHref,
	appHref,
	...common
}: Common & {
	product: AutomationProduct;
	/** `automations.manage` de esta app. */
	canManage: boolean;
	/** La página de la consola, con todas. */
	ondeskHref: string;
	/** La sección Automations de otra app. */
	appHref: (product: AutomationProduct) => string;
}) {
	const { novaHost, workspaceId } = common;
	const [view, setView] = useState<View>({ kind: "list" });
	const catalog = useAutomationsCatalog(novaHost, workspaceId);
	const list = useAutomationsList(novaHost, workspaceId, product);

	if (catalog.isPending || list.isPending) return <Skeleton rows={4} />;
	if (catalog.isError || list.isError)
		return (
			<Callout tone="danger" role="alert" title="Automations are unavailable">
				{unavailable(catalog.error ?? list.error)}
			</Callout>
		);

	const flows = list.data;
	if (view.kind !== "list") {
		const flow = view.kind === "edit" ? (flows.find((f) => f.id === view.id) ?? null) : null;
		return (
			<AutomationEditor
				{...common}
				catalog={catalog.data}
				flow={flow}
				triggerProducts={[product]}
				onBack={() => setView({ kind: "list" })}
			/>
		);
	}

	const starts = flows.filter((f) => (f.role ?? "starts") === "starts");
	const acts = flows.filter((f) => f.role === "acts");
	const hasTriggers = catalog.data.triggers.some((t) => t.product === product);
	const name = PRODUCT_LABELS[product];
	const create = canManage && hasTriggers && (
		<button type="button" className="ticket ticket--sm ticket--solid" onClick={() => setView({ kind: "new" })}>
			<Plus className="size-4" strokeWidth={1.75} aria-hidden="true" />
			New automation
		</button>
	);

	return (
		<div className="flex flex-col gap-6">
			{hasTriggers && (
				<Panel title="Start here" meta={starts.length ? String(starts.length) : undefined} action={starts.length ? create : undefined} variant={starts.length ? "flush" : "default"}>
					{starts.length === 0 ? (
						<EmptyState
							title={`No automations start in ${name} yet`}
							description={`Something that happens in ${name} can do things in any of your apps. For example: when a ticket is created, create a task in Orbit with its subject and link.`}
							action={create || undefined}
						/>
					) : (
						<FlowRows flows={starts} catalog={catalog.data} {...common} canManage={canManage} onOpen={(id) => setView({ kind: "edit", id })} />
					)}
				</Panel>
			)}
			{(acts.length > 0 || !hasTriggers) && (
				<Panel title="Act here" variant={acts.length ? "flush" : "default"}>
					{acts.length === 0 ? (
						<EmptyState
							title={`Nothing acts in ${name} yet`}
							description={`Automations that start in another app can do things in ${name}. You set them up in the app where they start.`}
						/>
					) : (
						<RowList label={`Automations that act in ${name}`}>
							{acts.map((flow) => (
								<li key={flow.id} className={rowStaticClass}>
									<RowContent
										lead={<FlowRoute catalog={catalog.data} flow={{ trigger_product: flow.trigger_product, steps: [{ tool: `${product}.` }] }} />}
										title={flow.name}
										sub={
											<a href={appHref(flow.trigger_product)} className={textLinkClass}>
												Starts in {PRODUCT_LABELS[flow.trigger_product]}
												<LinkArrow />
											</a>
										}
										end={<StatusTag flow={flow} />}
									/>
								</li>
							))}
						</RowList>
					)}
				</Panel>
			)}
			<a href={ondeskHref} className={`${textLinkClass} self-start`}>
				Every automation in this workspace
				<LinkArrow />
			</a>
		</div>
	);
}

export function AutomationsConsole({ manageable, ...common }: Common & { manageable: AutomationProduct[] }) {
	const { novaHost, workspaceId } = common;
	const [view, setView] = useState<View>({ kind: "list" });
	const [filter, setFilter] = useState<AutomationProduct | "all">("all");
	const catalog = useAutomationsCatalog(novaHost, workspaceId);
	const list = useAutomationsList(novaHost, workspaceId);

	if (catalog.isPending || list.isPending) return <Skeleton rows={5} />;
	if (catalog.isError || list.isError)
		return (
			<Callout tone="danger" role="alert" title="Automations are unavailable">
				{unavailable(catalog.error ?? list.error)}
			</Callout>
		);

	const flows = list.data;
	const triggerProducts = [...new Set(catalog.data.triggers.map((t) => t.product))].filter((p) => manageable.includes(p));
	if (view.kind !== "list") {
		const flow = view.kind === "edit" ? (flows.find((f) => f.id === view.id) ?? null) : null;
		return <AutomationEditor {...common} catalog={catalog.data} flow={flow} triggerProducts={flow ? [flow.trigger_product] : triggerProducts} onBack={() => setView({ kind: "list" })} />;
	}

	const apps = [...new Set(flows.map((f) => f.trigger_product))];
	const shown = filter === "all" ? flows : flows.filter((f) => f.trigger_product === filter);
	const create = triggerProducts.length > 0 && (
		<button type="button" className="ticket ticket--sm ticket--solid" onClick={() => setView({ kind: "new" })}>
			<Plus className="size-4" strokeWidth={1.75} aria-hidden="true" />
			New automation
		</button>
	);

	return (
		<div className="flex flex-col gap-6">
			<Panel title="Automations" meta={flows.length ? String(flows.length) : undefined} action={flows.length ? create : undefined} variant={flows.length ? "flush" : "default"}>
				{flows.length === 0 ? (
					<EmptyState
						title="No automations yet"
						description="Something that happens in one app can do things in another: a new ticket in Pulse can create a task in Orbit and post in Nexus. Each app also lists the automations that start in it, under Settings."
						action={create || undefined}
					/>
				) : (
					<div className="flex flex-col gap-3">
						{apps.length > 1 && (
							<div className="px-5 pt-1 sm:px-7">
								<Segmented
									label="App"
									size="sm"
									value={filter}
									onChange={setFilter}
									options={[{ value: "all" as const, label: "All" }, ...apps.map((p) => ({ value: p, label: PRODUCT_LABELS[p] }))]}
								/>
							</div>
						)}
						<FlowRows flows={shown} catalog={catalog.data} {...common} canManage={(f) => manageable.includes(f.trigger_product)} onOpen={(id) => setView({ kind: "edit", id })} />
					</div>
				)}
			</Panel>
			{flows.length > 0 && (
				<Panel title="Runs">
					<RunsList novaHost={novaHost} workspaceId={workspaceId} catalog={catalog.data} flows={flows} />
				</Panel>
			)}
		</div>
	);
}

function FlowRows({
	flows,
	catalog,
	canManage,
	onOpen,
	novaHost,
	workspaceId,
	userId,
	memberName,
}: Common & { flows: ListedFlow[]; catalog: Catalog; canManage: boolean | ((flow: ListedFlow) => boolean); onOpen: (id: string) => void }) {
	const m = useFlowMutations(novaHost, workspaceId);
	const [deleting, setDeleting] = useState<ListedFlow | null>(null);
	const can = (f: ListedFlow) => (typeof canManage === "function" ? canManage(f) : canManage);

	function menu(flow: ListedFlow): { items: MenuItem[] }[] {
		const items: MenuItem[] = [];
		if (flow.status === "active") items.push({ label: "Pause", icon: Pause, onSelect: () => m.pause.mutate(flow.id) });
		else items.push({ label: "Resume", icon: Play, onSelect: () => m.resume.mutate(flow.id) });
		if (flow.owner_id !== userId) items.push({ label: "Run it as me", icon: UserRoundCheck, onSelect: () => m.takeOver.mutate(flow.id) });
		return [{ items }, { items: [{ label: "Delete", icon: Trash2, danger: true, onSelect: () => setDeleting(flow) }] }];
	}

	const rowError = m.pause.error ?? m.resume.error ?? m.takeOver.error;

	return (
		<>
			{rowError && (
				<div className="px-5 sm:px-7">
					<Callout tone="danger" role="alert">
						{rowError.message}
					</Callout>
				</div>
			)}
			<RowList label="Automations">
				{flows.map((flow) => {
					const status = statusLine(flow);
					const sub = [flowSentence(catalog, flow), status.detail ?? runsAs(flow, userId, memberName), stats(flow)].filter(Boolean).join(". ");
					const content = <RowContent lead={<FlowRoute catalog={catalog} flow={flow} />} title={flow.name} sub={sub} end={<StatusTag flow={flow} />} />;
					return (
						<li key={flow.id} className="flex items-center gap-1 pr-3 sm:pr-5">
							{can(flow) ? (
								<>
									<button type="button" className={`${rowClass} min-w-0 flex-1 text-left`} onClick={() => onOpen(flow.id)}>
										{content}
									</button>
									<ActionMenu label={`Actions for ${flow.name}`} groups={menu(flow)} />
								</>
							) : (
								<div className={`${rowStaticClass} min-w-0 flex-1`}>{content}</div>
							)}
						</li>
					);
				})}
			</RowList>
			<SheetDialog
				open={deleting !== null}
				onClose={() => setDeleting(null)}
				title="Delete this automation?"
				description={deleting ? `"${deleting.name}" stops right away and its run history goes with it. This can't be undone.` : undefined}
				footer={
					<ConfirmRow
						danger
						error={m.remove.error}
						pending={m.remove.isPending}
						label="Delete automation"
						pendingLabel="Deleting…"
						onCancel={() => setDeleting(null)}
						onConfirm={() => deleting && m.remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
					/>
				}
			/>
		</>
	);
}

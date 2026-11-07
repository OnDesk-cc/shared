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
import { flowSentence, joinSentences, PRODUCT_LABELS, statusLine, type AutomationProduct, type Catalog, type ListedFlow } from "./automations-model";
import { AutomationEditor } from "./automation-editor";
import { FlowRoute, StatusTag } from "./flow-parts";
import { RunsList } from "./runs-list";
import { useAutomationsCatalog, useAutomationsList, useFlowMutations } from "./use-automations";
import { useSharedStrings } from "../../i18n/react";

type View = { kind: "list" } | { kind: "new" } | { kind: "edit"; id: string };

interface Common {
	novaHost: string;
	workspaceId: string;
	/** Quien mira: para saber si es el dueño de una automatización. */
	userId: string;
	/** El nombre de un miembro por su id (lo que ya tiene la app); sin él, «another member». */
	memberName?: (id: string) => string | null;
}

type Strings = ReturnType<typeof useSharedStrings>;

function unavailable(error: unknown, i: Strings): string {
	if (error instanceof AutomationsError && error.status === 403) return error.message;
	return i.s.automations.unavailable;
}

function stats(flow: ListedFlow, i: Strings): string | null {
	if (!flow.stats || (flow.stats.done === 0 && flow.stats.failed === 0)) return null;
	const runs = flow.stats.done + flow.stats.failed;
	const a = i.s.automations;
	return flow.stats.failed ? i.pl(a.runsThisWeekFailed, runs, { failed: i.num(flow.stats.failed) }) : i.pl(a.runsThisWeek, runs);
}

function runsAs(flow: ListedFlow, userId: string, i: Strings, memberName?: (id: string) => string | null): string {
	const a = i.s.automations;
	if (flow.owner_id === userId) return a.runsAsYou;
	const name = memberName?.(flow.owner_id);
	return name ? i.t(a.runsAsNamed, { name }) : a.runsAsOther;
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
	const i = useSharedStrings();
	const a = i.s.automations;
	const [view, setView] = useState<View>({ kind: "list" });
	const catalog = useAutomationsCatalog(novaHost, workspaceId);
	const list = useAutomationsList(novaHost, workspaceId, product);

	if (catalog.isPending || list.isPending) return <Skeleton rows={4} />;
	if (catalog.isError || list.isError)
		return (
			<Callout tone="danger" role="alert" title={a.unavailableTitle}>
				{unavailable(catalog.error ?? list.error, i)}
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
			{a.newAutomation}
		</button>
	);

	return (
		<div className="flex flex-col gap-6">
			{hasTriggers && (
				<Panel title={a.startHere} meta={starts.length ? String(starts.length) : undefined} action={starts.length ? create : undefined} variant={starts.length ? "flush" : "default"}>
					{starts.length === 0 ? (
						<EmptyState
							title={i.t(a.noneStartIn, { app: name })}
							description={i.t(a.noneStartInBody, { app: name })}
							action={create || undefined}
						/>
					) : (
						<FlowRows flows={starts} catalog={catalog.data} {...common} canManage={canManage} onOpen={(id) => setView({ kind: "edit", id })} />
					)}
				</Panel>
			)}
			{(acts.length > 0 || !hasTriggers) && (
				<Panel title={a.actHere} variant={acts.length ? "flush" : "default"}>
					{acts.length === 0 ? (
						<EmptyState
							title={i.t(a.nothingActsIn, { app: name })}
							description={i.t(a.nothingActsInBody, { app: name })}
						/>
					) : (
						<RowList label={i.t(a.actIn, { app: name })}>
							{acts.map((flow) => (
								<li key={flow.id} className={rowStaticClass}>
									<RowContent
										lead={<FlowRoute catalog={catalog.data} flow={{ trigger_product: flow.trigger_product, steps: [{ tool: `${product}.` }] }} />}
										title={flow.name}
										sub={
											<a href={appHref(flow.trigger_product)} className={textLinkClass}>
												{i.t(a.startsIn, { app: PRODUCT_LABELS[flow.trigger_product] })}
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
				{a.everyInWorkspace}
				<LinkArrow />
			</a>
		</div>
	);
}

export function AutomationsConsole({ manageable, ...common }: Common & { manageable: AutomationProduct[] }) {
	const { novaHost, workspaceId } = common;
	const [view, setView] = useState<View>({ kind: "list" });
	const [filter, setFilter] = useState<AutomationProduct | "all">("all");
	const i = useSharedStrings();
	const a = i.s.automations;
	const catalog = useAutomationsCatalog(novaHost, workspaceId);
	const list = useAutomationsList(novaHost, workspaceId);

	if (catalog.isPending || list.isPending) return <Skeleton rows={5} />;
	if (catalog.isError || list.isError)
		return (
			<Callout tone="danger" role="alert" title={a.unavailableTitle}>
				{unavailable(catalog.error ?? list.error, i)}
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
			{a.newAutomation}
		</button>
	);

	return (
		<div className="flex flex-col gap-6">
			<Panel title={a.title} meta={flows.length ? String(flows.length) : undefined} action={flows.length ? create : undefined} variant={flows.length ? "flush" : "default"}>
				{flows.length === 0 ? (
					<EmptyState
						title={a.noneYet}
						description={a.noneYetBody}
						action={create || undefined}
					/>
				) : (
					<div className="flex flex-col gap-3">
						{apps.length > 1 && (
							<div className="px-5 pt-1 sm:px-7">
								<Segmented
									label={a.app}
									size="sm"
									value={filter}
									onChange={setFilter}
									options={[{ value: "all" as const, label: a.all }, ...apps.map((p) => ({ value: p, label: PRODUCT_LABELS[p] }))]}
								/>
							</div>
						)}
						<FlowRows flows={shown} catalog={catalog.data} {...common} canManage={(f) => manageable.includes(f.trigger_product)} onOpen={(id) => setView({ kind: "edit", id })} />
					</div>
				)}
			</Panel>
			{flows.length > 0 && (
				<Panel title={a.runs}>
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
	const i = useSharedStrings();
	const a = i.s.automations;
	const m = useFlowMutations(novaHost, workspaceId);
	const [deleting, setDeleting] = useState<ListedFlow | null>(null);
	const can = (f: ListedFlow) => (typeof canManage === "function" ? canManage(f) : canManage);

	function menu(flow: ListedFlow): { items: MenuItem[] }[] {
		const items: MenuItem[] = [];
		if (flow.status === "active") items.push({ label: a.pause, icon: Pause, onSelect: () => m.pause.mutate(flow.id) });
		else items.push({ label: a.resume, icon: Play, onSelect: () => m.resume.mutate(flow.id) });
		if (flow.owner_id !== userId) items.push({ label: a.runAsMe, icon: UserRoundCheck, onSelect: () => m.takeOver.mutate(flow.id) });
		return [{ items }, { items: [{ label: i.s.common.delete, icon: Trash2, danger: true, onSelect: () => setDeleting(flow) }] }];
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
			<RowList label={a.title}>
				{flows.map((flow) => {
					const status = statusLine(flow, i.locale);
					const sub = joinSentences([flowSentence(catalog, flow, i.locale), status.detail ?? runsAs(flow, userId, i, memberName), stats(flow, i)]);
					const content = <RowContent lead={<FlowRoute catalog={catalog} flow={flow} />} title={flow.name} sub={sub} end={<StatusTag flow={flow} />} />;
					return (
						<li key={flow.id} className="flex items-center gap-1 pr-3 sm:pr-5">
							{can(flow) ? (
								<>
									<button type="button" className={`${rowClass} min-w-0 flex-1 text-left`} onClick={() => onOpen(flow.id)}>
										{content}
									</button>
									<ActionMenu label={i.t(a.actionsFor, { name: flow.name })} groups={menu(flow)} />
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
				title={a.deleteTitle}
				description={deleting ? i.t(a.deleteBody, { name: deleting.name }) : undefined}
				footer={
					<ConfirmRow
						danger
						error={m.remove.error}
						pending={m.remove.isPending}
						label={a.deleteLabel}
						pendingLabel={a.deleting}
						onCancel={() => setDeleting(null)}
						onConfirm={() => deleting && m.remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
					/>
				}
			/>
		</>
	);
}

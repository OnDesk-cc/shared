/**
 * El editor de una automatización, nueva o guardada (2026-10-21). Spec:
 * ondesk/docs/specs/2026-10-21-automatizaciones.md § 8. Es una página dentro de
 * la sección (no un diálogo), como el editor de agentes de la consola:
 *
 *   When     el disparador. En una app, sólo los de esa app; en la consola, todos
 *   Only if  las condiciones (condition-editor.tsx)
 *   Do       hasta 5 pasos (step-editor.tsx); cada uno ve las variables del
 *            disparador y las salidas de los pasos de antes
 *   Test     sólo guardada: se elige un objeto real y Nova lo lee y enseña lo que
 *            haría cada paso, en tarjetas, sin escribir nada
 *   Runs     sólo guardada: su historial (runs-list.tsx)
 *
 * Una barra pegada abajo lleva los avisos de `draftErrors`, el error de Nova si
 * volvió y «Save». Si quien guarda no es el dueño y cambió lo que hace
 * (disparador, condiciones o pasos), un diálogo pide confirmar que desde ahora
 * corre como esa persona (Nova contesta 409 `owner_change` sin la confirmación).
 */
import { useMemo, useState } from "react";
import { FlaskConical, Plus, Search } from "lucide-react";
import { Alert, ConfirmRow, SheetDialog, TextField } from "../console-kit";
import { Panel } from "../console";
import { Callout } from "../callout";
import { AutomationsError, automationsApi, type FlowInput } from "./automations-api";
import {
	defaultParams,
	draftErrors,
	MAX_STEPS,
	PRODUCT_LABELS,
	variablesAt,
	type AutomationProduct,
	type Catalog,
	type FlowDraft,
	type FlowTestResult,
	type ListedFlow,
} from "./automations-model";
import { ConditionEditor } from "./condition-editor";
import { BackLink, StatusTag } from "./flow-parts";
import { RunsList } from "./runs-list";
import { StepEditor } from "./step-editor";
import { useFlowMutations } from "./use-automations";

function draftOf(flow: ListedFlow | null, trigger: string): FlowDraft {
	return flow
		? { name: flow.name, trigger_type: flow.trigger_type, conditions: flow.conditions, steps: flow.steps }
		: { name: "", trigger_type: trigger, conditions: { match: "all", rules: [] }, steps: [] };
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function AutomationEditor({
	novaHost,
	workspaceId,
	catalog,
	flow,
	triggerProducts,
	userId,
	memberName,
	onBack,
}: {
	novaHost: string;
	workspaceId: string;
	catalog: Catalog;
	flow: ListedFlow | null;
	/** Las apps cuyos disparadores se ofrecen: la de la sección, o todas en la consola. */
	triggerProducts: AutomationProduct[];
	userId: string;
	memberName?: (id: string) => string | null;
	onBack: () => void;
}) {
	const triggers = catalog.triggers.filter((t) => triggerProducts.includes(t.product));
	const [draft, setDraft] = useState<FlowDraft>(() => draftOf(flow, flow ? flow.trigger_type : (triggers[0]?.type ?? "")));
	const [showErrors, setShowErrors] = useState(false);
	const [confirmOwner, setConfirmOwner] = useState(false);
	const m = useFlowMutations(novaHost, workspaceId);
	const save = flow ? m.update : m.create;

	const trigger = catalog.triggers.find((t) => t.type === draft.trigger_type) ?? null;
	const errors = useMemo(() => draftErrors(catalog, draft), [catalog, draft]);
	const changesWhatItDoes = !!flow && (flow.trigger_type !== draft.trigger_type || !sameJson(flow.conditions, draft.conditions) || !sameJson(flow.steps, draft.steps));
	const notOwner = !!flow && flow.owner_id !== userId;
	const ownerName = flow ? (memberName?.(flow.owner_id) ?? "another member") : null;
	const dirty = !flow || flow.name !== draft.name || changesWhatItDoes;

	function setSteps(steps: FlowDraft["steps"]) {
		setDraft((d) => ({ ...d, steps }));
	}

	function submit(confirm = false) {
		setShowErrors(true);
		if (errors.length > 0) return;
		if (notOwner && changesWhatItDoes && !confirm) {
			setConfirmOwner(true);
			return;
		}
		const input: FlowInput = { name: draft.name.trim(), trigger_type: draft.trigger_type, conditions: draft.conditions, steps: draft.steps };
		const done = { onSuccess: () => (setConfirmOwner(false), onBack()) };
		if (flow) m.update.mutate({ id: flow.id, patch: input, confirmOwner: confirm }, done);
		else m.create.mutate(input, done);
	}

	const apiError = save.error instanceof AutomationsError || save.error instanceof Error ? save.error : null;

	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-col gap-4">
				<BackLink onClick={onBack} />
				<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
					<h2 className="sk-h2 min-w-0 text-[1.5rem] [overflow-wrap:anywhere] md:text-[1.75rem]">{flow ? flow.name : "New automation"}</h2>
					{flow && <StatusTag flow={flow} />}
				</div>
				{notOwner && (
					<Callout tone="warning" title={`This automation runs as ${ownerName}`}>
						It does what that person can do. If you change what it does, it runs as you from then on.
					</Callout>
				)}
			</header>

			<Panel title="Name">
				<TextField id="flow-name" label="Name" value={draft.name} onChange={(name) => setDraft((d) => ({ ...d, name }))} max={120} error={showErrors && !draft.name.trim() ? "Give it a name" : null} />
			</Panel>

			<Panel title="When">
				{triggers.length === 0 ? (
					<p className="sk-small">There's nothing in this app that can start an automation yet.</p>
				) : (
					<label className="flex max-w-md flex-col gap-1.5">
						<span className="sk-label mb-0!">This happens</span>
						<select
							className="field sk-select"
							value={draft.trigger_type}
							onChange={(e) => setDraft((d) => ({ ...d, trigger_type: e.target.value, conditions: { match: "all", rules: [] } }))}>
							{[...new Set(triggers.map((t) => t.product))].map((product) => (
								<optgroup key={product} label={PRODUCT_LABELS[product]}>
									{triggers
										.filter((t) => t.product === product)
										.map((t) => (
											<option key={t.type} value={t.type}>
												{t.label}
											</option>
										))}
								</optgroup>
							))}
						</select>
						{trigger?.description && <span className="sk-small">{trigger.description}</span>}
					</label>
				)}
			</Panel>

			<Panel title="Only if">
				<ConditionEditor trigger={trigger} value={draft.conditions} onChange={(conditions) => setDraft((d) => ({ ...d, conditions }))} />
			</Panel>

			<Panel title="Do" meta={`${draft.steps.length} of ${MAX_STEPS} steps`}>
				<div className="flex flex-col gap-4">
					{draft.steps.length === 0 && <p className="sk-small">Add what should happen, in order. Each step can use what the steps before it created.</p>}
					<ol className="flex flex-col gap-4">
						{draft.steps.map((step, i) => (
							<StepEditor
								key={i}
								index={i}
								count={draft.steps.length}
								step={step}
								action={catalog.actions.find((a) => a.tool === step.tool) ?? null}
								vars={variablesAt(catalog, draft.trigger_type, draft.steps, i)}
								novaHost={novaHost}
								workspaceId={workspaceId}
								errors={showErrors ? errors : []}
								onChange={(next) => setSteps(draft.steps.map((s, j) => (j === i ? next : s)))}
								onMove={(delta) => {
									const steps = [...draft.steps];
									[steps[i], steps[i + delta]] = [steps[i + delta], steps[i]];
									setSteps(steps);
								}}
								onRemove={() => setSteps(draft.steps.filter((_, j) => j !== i))}
							/>
						))}
					</ol>
					{draft.steps.length < MAX_STEPS && (
						<label className="flex max-w-md flex-col gap-1.5">
							<span className="sk-label mb-0! inline-flex items-center gap-1.5">
								<Plus className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
								Add a step
							</span>
							<select
								className="field sk-select"
								value=""
								onChange={(e) => {
									const action = catalog.actions.find((a) => a.tool === e.target.value);
									if (!action) return;
									setSteps([...draft.steps, { tool: action.tool, params: trigger ? defaultParams(action, trigger) : {} }]);
								}}>
								<option value="">Choose an action…</option>
								{[...new Set(catalog.actions.map((a) => a.product))].map((product) => (
									<optgroup key={product} label={PRODUCT_LABELS[product]}>
										{catalog.actions
											.filter((a) => a.product === product)
											.map((a) => (
												<option key={a.tool} value={a.tool}>
													{a.label}
												</option>
											))}
									</optgroup>
								))}
							</select>
						</label>
					)}
				</div>
			</Panel>

			{flow && <TestPanel novaHost={novaHost} workspaceId={workspaceId} flow={flow} dirty={dirty} />}

			{flow && (
				<Panel title="Runs">
					<RunsList novaHost={novaHost} workspaceId={workspaceId} catalog={catalog} flowId={flow.id} />
				</Panel>
			)}

			<div className="sk-card sticky bottom-4 z-10 flex flex-col gap-3 px-5 py-4 sm:px-7">
				{showErrors && errors.length > 0 && (
					<Callout tone="danger" role="alert" title="Fix these to save">
						<ul className="list-disc pl-5">
							{errors.slice(0, 6).map((e) => (
								<li key={e}>{e}</li>
							))}
						</ul>
					</Callout>
				)}
				{apiError && !confirmOwner && <Alert error={apiError} />}
				<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
					<button type="button" className="ticket ticket--sm" disabled={save.isPending} onClick={onBack}>
						Cancel
					</button>
					<button type="button" className="ticket ticket--sm ticket--solid" disabled={save.isPending || !dirty} aria-busy={save.isPending || undefined} onClick={() => submit()}>
						{save.isPending ? "Saving…" : flow ? "Save changes" : "Create automation"}
					</button>
				</div>
			</div>

			<SheetDialog
				open={confirmOwner}
				onClose={() => setConfirmOwner(false)}
				title="Run it as you?"
				description={`Right now it runs as ${ownerName}. After this change it does what you can do, in every app it touches.`}
				footer={
					<ConfirmRow
						error={apiError}
						pending={m.update.isPending}
						label="Save and run as me"
						pendingLabel="Saving…"
						onCancel={() => setConfirmOwner(false)}
						onConfirm={() => submit(true)}
					/>
				}
			/>
		</div>
	);
}

/** «Test»: un objeto real, leído como quien prueba, y lo que haría cada paso. Nada se escribe. */
function TestPanel({ novaHost, workspaceId, flow, dirty }: { novaHost: string; workspaceId: string; flow: ListedFlow; dirty: boolean }) {
	const [q, setQ] = useState("");
	const [subjects, setSubjects] = useState<{ resource: string; label: string }[] | null>(null);
	const [result, setResult] = useState<FlowTestResult | null>(null);
	const [busy, setBusy] = useState<"find" | "test" | null>(null);
	const [error, setError] = useState<Error | null>(null);

	async function find() {
		setBusy("find");
		setError(null);
		try {
			setSubjects(await automationsApi.subjects(novaHost, workspaceId, flow.trigger_type, q.trim()));
		} catch (err) {
			setError(err instanceof Error ? err : new Error("Couldn't search right now."));
		} finally {
			setBusy(null);
		}
	}

	async function run(resource: string) {
		setBusy("test");
		setError(null);
		setResult(null);
		try {
			setResult(await automationsApi.test(novaHost, workspaceId, flow.id, resource));
		} catch (err) {
			setError(err instanceof Error ? err : new Error("Couldn't test right now."));
		} finally {
			setBusy(null);
		}
	}

	return (
		<Panel title="Test">
			<div className="flex flex-col gap-4">
				<p className="max-w-[68ch] text-[0.9375rem] leading-relaxed text-(--sk-ink-2)">
					Pick a real item and see what each step would do, as you. Nothing is created or changed.
					{dirty && " This tests the saved version, not your unsaved changes."}
				</p>
				<form
					className="flex max-w-xl gap-2"
					onSubmit={(e) => {
						e.preventDefault();
						void find();
					}}>
					<label className="sr-only" htmlFor={`test-q-${flow.id}`}>
						Find an item
					</label>
					<input id={`test-q-${flow.id}`} className="field" placeholder="Search by name or number" value={q} maxLength={120} onChange={(e) => setQ(e.target.value)} />
					<button type="submit" className="ticket ticket--sm shrink-0" disabled={busy !== null} aria-busy={busy === "find" || undefined}>
						<Search className="size-4" strokeWidth={1.75} aria-hidden="true" />
						Find
					</button>
				</form>
				{error && <Alert error={error} />}
				{subjects && subjects.length === 0 && <p className="sk-small">Nothing found that you can see.</p>}
				{subjects && subjects.length > 0 && (
					<ul className="flex flex-wrap gap-2" aria-label="Items to test with">
						{subjects.map((s) => (
							<li key={s.resource}>
								<button type="button" className="ticket ticket--sm" disabled={busy !== null} onClick={() => void run(s.resource)}>
									<FlaskConical className="size-4" strokeWidth={1.75} aria-hidden="true" />
									{s.label}
								</button>
							</li>
						))}
					</ul>
				)}
				{result && (
					<div className="flex flex-col gap-3" aria-live="polite">
						{!result.matched ? (
							<Callout tone="info" title="It wouldn't run for this item">
								The conditions don't match it.
							</Callout>
						) : (
							<ol className="flex flex-col gap-3">
								{result.steps.map((s, i) => (
									<li key={i} className="rounded-[14px] bg-(--sk-ground) px-4 py-3">
										<p className="sk-small">Step {i + 1}</p>
										{s.ok && s.preview ? (
											<>
												<p className="font-medium text-(--sk-ink) [overflow-wrap:anywhere]">{s.preview.summary}</p>
												<dl className="mt-2 grid gap-x-4 gap-y-1 text-[0.875rem] sm:grid-cols-[max-content_1fr]">
													{s.preview.fields.map((f) => (
														<div key={f.label} className="contents">
															<dt className="text-(--sk-ink-3)">{f.label}</dt>
															<dd className="text-(--sk-ink-2) [overflow-wrap:anywhere]">{f.value}</dd>
														</div>
													))}
												</dl>
											</>
										) : (
											<p className="font-medium text-[#b3261e] [overflow-wrap:anywhere]">{s.error ?? "This step would fail."}</p>
										)}
									</li>
								))}
							</ol>
						)}
					</div>
				)}
			</div>
		</Panel>
	);
}

/**
 * Un paso del «Do» de una automatización (2026-10-21): la acción, su app y sus
 * parámetros, con subir, bajar y quitar.
 *
 * Cada parámetro lleva el control que dice `paramControl`:
 *   - options  un desplegable que llena la app (`x-options`: los proyectos de
 *              Orbit, los canales de Nexus…), leído como quien edita;
 *   - enum     un desplegable con los valores del esquema;
 *   - long     un texto de varias líneas con variables;
 *   - text     una línea con variables (también los números: el ticket del
 *              disparador es `{{trigger.number}}`).
 * Los dos primeros tienen al final «Use a variable…», que cambia el control por
 * un campo de texto con variables (y «Pick from the list» lo devuelve). Un valor
 * que no sale de la lista y lleva `{{` se abre ya como variable.
 */
import { useId, useState } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import type { JsonSchema } from "../../worker/json-schema";
import { FieldShell } from "../console-kit";
import { AppTile } from "../sky";
import { hasList, paramControl, paramLabel, PRODUCT_LABELS, visibleParams, type CatalogAction, type FlowStep, type Variable } from "./automations-model";
import { TemplateField } from "./template-field";
import { useFlowOptions } from "./use-automations";

const VARIABLE = "__variable__";

export function StepEditor({
	index,
	count,
	step,
	action,
	vars,
	novaHost,
	workspaceId,
	errors,
	onChange,
	onMove,
	onRemove,
}: {
	index: number;
	count: number;
	step: FlowStep;
	action: CatalogAction | null;
	vars: Variable[];
	novaHost: string;
	workspaceId: string;
	errors: string[];
	onChange: (step: FlowStep) => void;
	onMove: (delta: -1 | 1) => void;
	onRemove: () => void;
}) {
	const n = index + 1;
	const setParam = (key: string, value: unknown) => {
		const params = { ...step.params };
		if (value === "" || value === undefined) delete params[key];
		else params[key] = value;
		onChange({ ...step, params });
	};

	return (
		<li className="sk-card px-5 py-5 sm:px-6">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex min-w-0 items-center gap-3">
					{action && <AppTile id={action.product} size="sm" />}
					<div className="min-w-0">
						<p className="sk-small">Step {n}</p>
						<p className="font-medium leading-tight text-(--sk-ink) [overflow-wrap:anywhere]">
							{action ? `${action.label} in ${PRODUCT_LABELS[action.product]}` : "This action is no longer available"}
						</p>
					</div>
				</div>
				<div className="flex items-center gap-1">
					<button type="button" className="ticket ticket--glyph" aria-label={`Move step ${n} up`} disabled={index === 0} onClick={() => onMove(-1)}>
						<ArrowUp className="size-4" strokeWidth={1.75} aria-hidden="true" />
					</button>
					<button type="button" className="ticket ticket--glyph" aria-label={`Move step ${n} down`} disabled={index === count - 1} onClick={() => onMove(1)}>
						<ArrowDown className="size-4" strokeWidth={1.75} aria-hidden="true" />
					</button>
					<button type="button" className="ticket ticket--glyph" aria-label={`Remove step ${n}`} onClick={onRemove}>
						<Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
					</button>
				</div>
			</div>
			{action && (
				<div className="mt-4 grid gap-x-6 sm:grid-cols-2">
					{visibleParams(action.params).map((key) => {
						const schema = action.params.properties?.[key] as JsonSchema;
						const control = paramControl(key, schema);
						const required = action.params.required?.includes(key) ?? false;
						const error = errors.find((e) => e.startsWith(`Step ${n}: ${paramLabel(key)} `)) ?? null;
						return (
							<div key={key} className={control === "long" ? "sm:col-span-2" : undefined}>
								<ParamField
									name={key}
									schema={schema}
									control={control}
									required={required}
									value={step.params[key]}
									vars={vars}
									novaHost={novaHost}
									workspaceId={workspaceId}
									error={error ? "Required" : null}
									onChange={(v) => setParam(key, v)}
								/>
							</div>
						);
					})}
				</div>
			)}
		</li>
	);
}

function ParamField({
	name,
	schema,
	control,
	required,
	value,
	vars,
	novaHost,
	workspaceId,
	error,
	onChange,
}: {
	name: string;
	schema: JsonSchema;
	control: ReturnType<typeof paramControl>;
	required: boolean;
	value: unknown;
	vars: Variable[];
	novaHost: string;
	workspaceId: string;
	error: string | null;
	onChange: (value: unknown) => void;
}) {
	const id = useId();
	const label = `${paramLabel(name)}${required ? "" : " (optional)"}`;
	const text = value === undefined || value === null ? "" : String(value);
	const [asVariable, setAsVariable] = useState(text.includes("{{"));
	const options = useFlowOptions(novaHost, workspaceId, control === "options" ? (schema["x-options"] ?? null) : null);

	if (control === "text" || control === "long" || asVariable) {
		return (
			<div>
				<TemplateField
					id={id}
					label={label}
					value={text}
					onChange={(v) => onChange(schema.type === "integer" || schema.type === "number" ? numberOrTemplate(v) : v)}
					vars={vars}
					multiline={control === "long"}
					max={schema.maxLength}
					error={error}
					required={required}
				/>
				{asVariable && hasList(control) && (
					<button type="button" className="sk-small -mt-1 mb-2 font-medium text-(--sk-accent) hover:underline" onClick={() => (onChange(""), setAsVariable(false))}>
						Pick from the list
					</button>
				)}
			</div>
		);
	}

	const choices =
		control === "enum"
			? (schema.enum ?? []).map((v) => ({ value: String(v), label: String(v).replace(/_/g, " ") }))
			: (options.data ?? []);
	return (
		<FieldShell id={id} label={label} error={error} hint={control === "options" && options.isError ? "Couldn't load the list. Use a variable, or try again later." : undefined}>
			<select
				id={id}
				className="field sk-select"
				value={text}
				aria-describedby={`${id}-msg`}
				aria-invalid={error ? true : undefined}
				disabled={control === "options" && options.isPending}
				onChange={(e) => {
					if (e.target.value === VARIABLE) {
						onChange("");
						setAsVariable(true);
					} else onChange(e.target.value);
				}}>
				<option value="">{control === "options" && options.isPending ? "Loading…" : required ? "Choose…" : "Leave as it is"}</option>
				{choices.map((c) => (
					<option key={c.value} value={c.value}>
						{c.label}
					</option>
				))}
				<option value={VARIABLE}>Use a variable…</option>
			</select>
		</FieldShell>
	);
}

/** «42» → 42; una plantilla o lo que no es un número se queda en texto (el motor lo resuelve). */
function numberOrTemplate(v: string): string | number {
	return /^\d+$/.test(v.trim()) ? Number(v.trim()) : v;
}

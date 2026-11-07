/**
 * «Only if»: las condiciones de una automatización (2026-10-21). Una fila por
 * regla, con el campo, la comparación y el valor; «All» o «Any» arriba cuando
 * hay más de una. Sin reglas, la automatización corre cada vez que pasa el
 * disparador, y así lo dice.
 *
 * El valor de un campo `enum` es un desplegable con sus opciones; el de «Another
 * automation did it», sí o no; los demás, texto. Una comparación sin valor (is
 * empty) no enseña el campo. El motor vuelve a validar todo (conditions.ts).
 */
import { useId } from "react";
import { Plus, X } from "lucide-react";
import { Segmented } from "../segmented";
import { useSharedStrings } from "../../i18n/react";
import { conditionFields, needsValue, opsFor, type CatalogTrigger, type FlowConditions, type FlowOp, type FlowRule } from "./automations-model";

const MAX_RULES = 20;

export function ConditionEditor({ trigger, value, onChange }: { trigger: CatalogTrigger | null; value: FlowConditions; onChange: (next: FlowConditions) => void }) {
	const base = useId();
	const { s, t, locale } = useSharedStrings();
	const a = s.automations;
	if (!trigger) return <p className="sk-small">{a.chooseTriggerFirst}</p>;
	const fields = conditionFields(trigger, locale);
	const byField = new Map(fields.map((f) => [f.field, f]));
	const groups = [...new Set(fields.map((f) => f.group))];

	const setRule = (i: number, rule: FlowRule) => onChange({ ...value, rules: value.rules.map((r, j) => (j === i ? rule : r)) });
	const removeRule = (i: number) => onChange({ ...value, rules: value.rules.filter((_, j) => j !== i) });
	const addRule = () => {
		const first = fields[0];
		onChange({ ...value, rules: [...value.rules, { field: first.field, op: opsFor(first.type, locale)[0].op, value: "" }] });
	};

	return (
		<div className="flex flex-col gap-4">
			{value.rules.length === 0 ? (
				<p className="max-w-[68ch] text-[0.9375rem] leading-relaxed text-(--sk-ink-2)">{a.runsEveryTime}</p>
			) : (
				<>
					{value.rules.length > 1 && (
						<Segmented
							label={a.match}
							size="sm"
							value={value.match}
							onChange={(match) => onChange({ ...value, match })}
							options={[
								{ value: "all", label: a.allOfThese },
								{ value: "any", label: a.anyOfThese },
							]}
						/>
					)}
					<ul className="flex flex-col gap-3" aria-label={a.conditions}>
						{value.rules.map((rule, i) => {
							const field = byField.get(rule.field) ?? fields[0];
							const ops = opsFor(field.type, locale);
							const id = `${base}-${i}`;
							return (
								<li key={i} className="grid items-end gap-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_auto]">
									<label className="flex min-w-0 flex-col gap-1.5">
										<span className="sk-label mb-0!">{i === 0 ? a.field : <span className="sr-only">{a.field}</span>}</span>
										<select
											id={`${id}-field`}
											className="field sk-select"
											value={rule.field}
											onChange={(e) => {
												const next = byField.get(e.target.value) ?? fields[0];
												setRule(i, { field: next.field, op: opsFor(next.type, locale)[0].op, value: next.type === "bool" ? true : "" });
											}}>
											{groups.map((group) => (
												<optgroup key={group} label={group}>
													{fields
														.filter((f) => f.group === group)
														.map((f) => (
															<option key={f.field} value={f.field}>
																{f.label}
															</option>
														))}
												</optgroup>
											))}
										</select>
									</label>
									<label className="flex min-w-0 flex-col gap-1.5">
										<span className="sk-label mb-0!">{i === 0 ? a.comparison : <span className="sr-only">{a.comparison}</span>}</span>
										<select className="field sk-select" value={rule.op} onChange={(e) => setRule(i, { ...rule, op: e.target.value as FlowOp })}>
											{ops.map((o) => (
												<option key={o.op} value={o.op}>
													{o.label}
												</option>
											))}
										</select>
									</label>
									<label className="flex min-w-0 flex-col gap-1.5">
										<span className="sk-label mb-0!">{i === 0 ? a.value : <span className="sr-only">{a.value}</span>}</span>
										{!needsValue(rule.op) ? (
											<span className="field flex items-center text-(--sk-ink-3)" aria-hidden="true">
												{a.noValueNeeded}
											</span>
										) : field.type === "bool" ? (
											<select className="field sk-select" value={rule.value === false ? "no" : "yes"} onChange={(e) => setRule(i, { ...rule, value: e.target.value === "yes" })}>
												<option value="yes">{s.common.yes}</option>
												<option value="no">{s.common.no}</option>
											</select>
										) : field.type === "enum" && field.options?.length ? (
											<select className="field sk-select" value={String(rule.value ?? "")} onChange={(e) => setRule(i, { ...rule, value: e.target.value })}>
												<option value="">{a.choose}</option>
												{field.options.map((o) => (
													<option key={o.value} value={o.value}>
														{o.label}
													</option>
												))}
											</select>
										) : (
											<input
												className="field"
												inputMode={field.type === "number" ? "numeric" : undefined}
												value={String(rule.value ?? "")}
												maxLength={500}
												onChange={(e) => setRule(i, { ...rule, value: field.type === "number" && e.target.value !== "" && Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : e.target.value })}
											/>
										)}
									</label>
									<button type="button" className="ticket ticket--glyph mb-0.5" aria-label={t(a.removeCondition, { n: i + 1 })} onClick={() => removeRule(i)}>
										<X className="size-4" strokeWidth={1.75} aria-hidden="true" />
									</button>
								</li>
							);
						})}
					</ul>
				</>
			)}
			{value.rules.length < MAX_RULES && (
				<button type="button" className="ticket ticket--sm self-start" onClick={addRule}>
					<Plus className="size-4" strokeWidth={1.75} aria-hidden="true" />
					{a.addCondition}
				</button>
			)}
		</div>
	);
}

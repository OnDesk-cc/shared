/**
 * Un campo de texto que acepta variables (2026-10-21): `{{trigger.subject}}`
 * se escribe tal cual o se inserta desde «Insert variable», en el punto del
 * cursor. Debajo, cuando el texto lleva alguna, una vista previa la pinta como
 * ficha con su nombre legible («Subject»), y una que no existe en ese paso sale
 * en rojo (el editor no deja guardar con ella: `draftErrors`).
 *
 * El valor guardado es siempre el texto con `{{…}}`: lo que lee el motor. El
 * menú es el `menu-panel` de la consola (vidrio, Escape y clic fuera lo cierran)
 * y se agrupa por origen: el disparador, lo que cambió, quién lo hizo y cada
 * paso anterior.
 */
import { Fragment, useRef, useState } from "react";
import { Braces } from "lucide-react";
import { useDismiss } from "../../hooks/map";
import { CharCount, FieldShell } from "../console-kit";
import { Tag } from "../tag";
import { splitTemplate, type Variable } from "./automations-model";

export function TemplateField({
	id,
	label,
	value,
	onChange,
	vars,
	multiline = false,
	max,
	hint,
	error,
	required = false,
}: {
	id: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
	vars: Variable[];
	multiline?: boolean;
	max?: number;
	hint?: string;
	error?: string | null;
	required?: boolean;
}) {
	const input = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
	const box = useRef<HTMLDivElement>(null);
	const trigger = useRef<HTMLButtonElement>(null);
	const [open, setOpen] = useState(false);
	useDismiss(open, box, trigger, () => setOpen(false));

	const known = new Map(vars.map((v) => [v.token, v]));
	const parts = splitTemplate(value);
	const hasVars = parts.some((p) => p.kind === "var");
	const groups = [...new Set(vars.map((v) => v.group))];

	function insert(token: string) {
		const el = input.current;
		const text = `{{${token}}}`;
		const start = el?.selectionStart ?? value.length;
		const end = el?.selectionEnd ?? value.length;
		onChange(value.slice(0, start) + text + value.slice(end));
		setOpen(false);
		requestAnimationFrame(() => {
			if (!el) return;
			el.focus();
			el.setSelectionRange(start + text.length, start + text.length);
		});
	}

	const control = {
		id,
		ref: input,
		value,
		maxLength: max,
		required,
		"aria-invalid": error ? true : undefined,
		"aria-describedby": `${id}-msg`,
		className: "field",
	} as const;

	return (
		<FieldShell id={id} label={label} hint={hint} error={error} counter={max && max >= 200 ? <CharCount value={value} max={max} /> : undefined}>
			<div ref={box} className="relative">
				{multiline ? (
					<textarea {...control} rows={4} onChange={(e) => onChange(e.target.value)} />
				) : (
					<input {...control} onChange={(e) => onChange(e.target.value)} />
				)}
				<div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
					{hasVars ? (
						<p className="sk-small min-w-0 flex-1 leading-relaxed [overflow-wrap:anywhere]" aria-hidden="true">
							{parts.map((p, i) =>
								p.kind === "text" ? (
									<Fragment key={i}>{p.value}</Fragment>
								) : (
									<Tag key={i} tone={known.has(p.token) ? "accent" : "danger"} className="mx-0.5 align-baseline">
										{known.get(p.token)?.label ?? p.token}
									</Tag>
								),
							)}
						</p>
					) : (
						<span />
					)}
					<button
						ref={trigger}
						type="button"
						className="ticket ticket--xs ticket--ghost"
						aria-haspopup="menu"
						aria-expanded={open}
						aria-label={`Insert a variable in ${label}`}
						onClick={() => setOpen((v) => !v)}>
						<Braces className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
						Insert variable
					</button>
				</div>
				{open && (
					<div role="menu" aria-label="Variables" className="menu-panel right-0 top-full mt-1 max-h-80 w-72 overflow-y-auto">
						{groups.map((group, i) => (
							<div key={group} className={i > 0 ? "mt-1 border-t border-(--sk-hair) pt-1" : undefined}>
								<p className="sk-small px-3 pb-1 pt-2 font-medium">{group}</p>
								{vars
									.filter((v) => v.group === group)
									.map((v) => (
										<button key={v.token} type="button" role="menuitem" onClick={() => insert(v.token)}>
											{v.label}
										</button>
									))}
							</div>
						))}
					</div>
				)}
			</div>
		</FieldShell>
	);
}

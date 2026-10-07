/**
 * El conmutador (2026-10-06): dos a cinco maneras de ver lo mismo (Board | List,
 * All | Unread, Reply | Internal note, los días de una semana). Es la pista de
 * niebla del riel de pestañas con la elegida en una pastilla blanca; antes cada
 * app tenía el suyo (un bloque de tinta en mono mayúsculas, pestañas subrayadas,
 * botones sueltos con borde).
 *
 *   Segmented  un grupo de opciones del que siempre hay una elegida
 *
 * Es un `radiogroup`: Tab entra en la elegida y las flechas cambian de opción
 * (y la eligen, como un grupo de radio nativo). `iconOnly` deja sólo el glifo
 * y pone el rótulo en `aria-label` y en el `title`. Para elegir varias a la vez
 * (los días de una cita que se repite) se pasa `multiple` y `value` es una
 * lista: entonces cada opción es un botón con `aria-pressed`.
 *
 * Para pestañas que cambian de página o de panel, `Tabs` de `ui/tabs` (el riel
 * de páginas); esto es un control dentro de una página.
 */
import { useRef, type ElementType, type KeyboardEvent, type ReactNode } from "react";

export interface SegmentedOption<T extends string> {
	value: T;
	label: string;
	icon?: ElementType;
	disabled?: boolean;
	/** Algo pequeño detrás del rótulo: una cifra. */
	count?: ReactNode;
}

type Common<T extends string> = {
	options: SegmentedOption<T>[];
	/** El nombre del grupo, para el lector de pantalla («View», «Reply mode»). */
	label: string;
	size?: "sm" | "md";
	iconOnly?: boolean;
	/** Ocupa todo el ancho y reparte las opciones (en un teléfono, en un diálogo). */
	full?: boolean;
	className?: string;
};

export function Segmented<T extends string>(
	props: Common<T> & ({ multiple?: false; value: T; onChange: (value: T) => void } | { multiple: true; value: T[]; onChange: (value: T[]) => void }),
) {
	const { options, label, size = "md", iconOnly = false, full = false, className = "" } = props;
	const group = useRef<HTMLDivElement>(null);
	const isOn = (v: T) => (props.multiple ? props.value.includes(v) : props.value === v);

	function pick(v: T) {
		if (props.multiple) {
			props.onChange(props.value.includes(v) ? props.value.filter((x) => x !== v) : [...props.value, v]);
		} else if (props.value !== v) {
			props.onChange(v);
		}
	}

	// Las flechas recorren las opciones habilitadas y eligen la nueva, como un
	// grupo de radio nativo. En modo múltiple sólo mueven el foco.
	function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
		const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
		if (!keys.includes(e.key)) return;
		e.preventDefault();
		const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
		if (enabled.length === 0) return;
		const at = enabled.indexOf(index);
		const next =
			e.key === "Home"
				? enabled[0]
				: e.key === "End"
					? enabled[enabled.length - 1]
					: e.key === "ArrowRight" || e.key === "ArrowDown"
						? enabled[(at + 1) % enabled.length]
						: enabled[(at - 1 + enabled.length) % enabled.length];
		group.current?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
		if (!props.multiple) pick(options[next].value);
	}

	const focusable = props.multiple ? null : (options.find((o) => o.value === props.value && !o.disabled) ?? options.find((o) => !o.disabled))?.value;

	return (
		<div
			ref={group}
			role={props.multiple ? "group" : "radiogroup"}
			aria-label={label}
			data-size={size}
			data-icon-only={iconOnly || undefined}
			data-full={full || undefined}
			className={`sk-seg ${className}`}>
			{options.map((option, i) => {
				const on = isOn(option.value);
				const Icon = option.icon;
				return (
					<button
						key={option.value}
						type="button"
						role={props.multiple ? undefined : "radio"}
						aria-checked={props.multiple ? undefined : on}
						aria-pressed={props.multiple ? on : undefined}
						// la pastilla blanca, en los dos modos
						data-on={on || undefined}
						tabIndex={props.multiple || option.value === focusable ? 0 : -1}
						disabled={option.disabled}
						aria-label={iconOnly ? option.label : undefined}
						// el rótulo entero cuando sólo hay glifo o cuando no cabe y se corta
						title={iconOnly || full ? option.label : undefined}
						onClick={() => pick(option.value)}
						onKeyDown={(e) => onKeyDown(e, i)}>
						{Icon && <Icon strokeWidth={1.75} aria-hidden="true" />}
						{!iconOnly && <span className="sk-seg-label">{option.label}</span>}
						{!iconOnly && option.count !== undefined && option.count !== null && (
							<span className="tabular-nums text-(--sk-ink-3)">{option.count}</span>
						)}
					</button>
				);
			})}
		</div>
	);
}

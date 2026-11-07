/**
 * El selector de idioma: «Automático» y los tres idiomas, cada uno escrito en su
 * propia lengua (quien no lee español tiene que poder encontrar «English»). Sólo
 * pinta y avisa: guardar la elección (`PATCH /api/auth/me/language` en la
 * cuenta, o la cookie en una página pública) es cosa de quien lo usa.
 */
import { useId } from "react";
import { LOCALES, type Locale } from "./locale";
import { useI18n, useSharedStrings } from "./react";
import { writeLangCookie } from "./cookie";

/** El nombre de cada idioma en sí mismo. No se traduce. */
export const LOCALE_NATIVE_NAME: Record<Locale, string> = { en: "English", es: "Español", pt: "Português" };

export function LanguageSelect({
	value,
	onChange,
	disabled = false,
	allowAutomatic = true,
	label,
	automaticLabel,
	className = "",
}: {
	/** null es «Automático». */
	value: Locale | null;
	onChange: (next: Locale | null) => void;
	disabled?: boolean;
	/** En una página pública no hay perfil: sólo los tres idiomas. */
	allowAutomatic?: boolean;
	/** El rótulo del campo; por defecto «Language» en el idioma de quien lee. */
	label?: string;
	/** Lo que significa null aquí; por defecto «Automatic» («Same as the owner» en un workspace). */
	automaticLabel?: string;
	className?: string;
}) {
	const { s } = useSharedStrings();
	const id = useId();
	return (
		<label htmlFor={id} className={`flex flex-col gap-1.5 ${className}`}>
			<span className="sk-label mb-0!">{label ?? s.language.label}</span>
			<select
				id={id}
				className="field sk-select"
				value={value ?? ""}
				disabled={disabled}
				onChange={(e) => onChange(e.target.value === "" ? null : (e.target.value as Locale))}>
				{allowAutomatic && <option value="">{automaticLabel ?? s.language.automatic}</option>}
				{LOCALES.map((l) => (
					<option key={l} value={l} lang={l}>
						{LOCALE_NATIVE_NAME[l]}
					</option>
				))}
			</select>
		</label>
	);
}

/**
 * El selector discreto de una página pública (un enlace compartido, una página de
 * reservas): sin perfil que guardar, la elección va a la cookie `ondesk_lang` y
 * cambia la página al momento.
 */
export function PublicLanguageSelect({ className = "" }: { className?: string }) {
	const { locale, setLocale } = useI18n<unknown>();
	return (
		<LanguageSelect
			className={className}
			value={locale}
			allowAutomatic={false}
			onChange={(next) => {
				if (!next) return;
				writeLangCookie(next);
				setLocale(next);
			}}
		/>
	);
}

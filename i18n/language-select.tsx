/**
 * El selector de idioma: «Automático» y los tres idiomas, cada uno escrito en su
 * propia lengua (quien no lee español tiene que poder encontrar «English»). Sólo
 * pinta y avisa: guardar la elección (`PATCH /api/auth/me/language` en la
 * cuenta, o la cookie en una página pública) es cosa de quien lo usa.
 */
import { useId } from "react";
import { LOCALES, type Locale } from "./locale";
import { useSharedStrings } from "./react";

/** El nombre de cada idioma en sí mismo. No se traduce. */
export const LOCALE_NATIVE_NAME: Record<Locale, string> = { en: "English", es: "Español", pt: "Português" };

export function LanguageSelect({
	value,
	onChange,
	disabled = false,
	allowAutomatic = true,
	className = "",
}: {
	/** null es «Automático». */
	value: Locale | null;
	onChange: (next: Locale | null) => void;
	disabled?: boolean;
	/** En una página pública no hay perfil: sólo los tres idiomas. */
	allowAutomatic?: boolean;
	className?: string;
}) {
	const { s } = useSharedStrings();
	const id = useId();
	return (
		<label htmlFor={id} className={`flex flex-col gap-1.5 ${className}`}>
			<span className="sk-label mb-0!">{s.language.label}</span>
			<select
				id={id}
				className="field sk-select"
				value={value ?? ""}
				disabled={disabled}
				onChange={(e) => onChange(e.target.value === "" ? null : (e.target.value as Locale))}>
				{allowAutomatic && <option value="">{s.language.automatic}</option>}
				{LOCALES.map((l) => (
					<option key={l} value={l} lang={l}>
						{LOCALE_NATIVE_NAME[l]}
					</option>
				))}
			</select>
		</label>
	);
}

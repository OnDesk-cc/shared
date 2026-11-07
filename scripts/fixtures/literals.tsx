// Fixture del escáner de textos literales (scripts/i18n-literals.test.mjs). No se compila.
export function Fixture({ t, d }: any) {
	return (
		<div className="flex">
			<p>Hello</p>
			<input placeholder="Search" />
			<button onClick={() => toast.success("Saved")}>{t(d.x)}</button>
			<p>{t(d.x)}</p>
			<span>·</span>
			<b>OnDesk</b>
		</div>
	);
}

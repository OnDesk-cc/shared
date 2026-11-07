// Fixture del escáner de textos literales (scripts/i18n-literals.test.mjs). No se compila.
export function Fixture({ t, d }: any) {
	return (
		<div className="flex">
			<p>Hello</p>
			<input placeholder="Search" />
			<button onClick={() => toast.success("Saved")}>{t(d.x)}</button>
			<p>{t(d.x)}</p>
			<p>{d.ok ? "Copied" : t(d.x)}</p>
			<p>{d.list.join(", ")}</p>
			<span>·</span>
			<b>OnDesk</b>
			<button aria-label={`Remove ${d.name}`} title={`${d.n}`} />
		</div>
	);
}

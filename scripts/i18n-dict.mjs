#!/usr/bin/env node
/**
 * Escribe los diccionarios de una app a partir de los JSON de trabajo:
 *
 *   node node_modules/@ondesk/shared/scripts/i18n-dict.mjs --json <dir> --out src/i18n --type AppDict
 *
 * En `<dir>`: `<area>.json` (inglés, la fuente), `<area>.es.json` y `<area>.pt.json`
 * (mismas claves). Escribe `<out>/{en,es,pt}/<area>.ts` y `<out>/{en,es,pt}/index.ts`.
 * `en` define la forma; `es` y `pt` se tipan con `<Type>[area]` importado de `..`,
 * así que una clave que falta es un error de typecheck. Si a un idioma le faltan
 * claves, lo dice y sale con 1 SIN escribir ese idioma.
 *
 * Después de generado, el diccionario es código: se edita a mano. Volver a
 * generar sobrescribe, así que sólo se hace mientras se extrae una superficie.
 * Spec: ondesk/docs/specs/2026-11-06-plataforma-multilingue.md
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const opt = (name, fallback = null) => {
	const i = args.indexOf(name);
	return i < 0 ? fallback : args[i + 1];
};
const jsonDir = opt("--json");
const outDir = opt("--out");
const typeName = opt("--type", "AppDict");
if (!jsonDir || !outDir) {
	console.error("uso: i18n-dict.mjs --json <dir> --out <dir> [--type AppDict]");
	process.exit(2);
}

const areas = readdirSync(jsonDir)
	.filter((f) => /^[a-z][A-Za-z0-9]*\.json$/.test(f))
	.map((f) => f.replace(/\.json$/, ""))
	.sort();

const quote = (s) => JSON.stringify(s);
function body(obj, indent = "\t") {
	return Object.entries(obj)
		.map(([k, v]) => (typeof v === "string" ? `${indent}${/^[A-Za-z_$][\w$]*$/.test(k) ? k : quote(k)}: ${quote(v)},` : `${indent}${k}: {\n${body(v, indent + "\t")}\n${indent}},`))
		.join("\n");
}

let failed = false;
for (const lang of ["en", "es", "pt"]) {
	const dir = join(outDir, lang);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	const written = [];
	for (const area of areas) {
		const en = JSON.parse(readFileSync(join(jsonDir, `${area}.json`), "utf8"));
		let data = en;
		if (lang !== "en") {
			const file = join(jsonDir, `${area}.${lang}.json`);
			const tr = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
			// Un valor es un texto o un plural `{ one, other }`, y la traducción tiene la misma forma.
			const okValue = (e, t) =>
				typeof e === "string" ? typeof t === "string" && t.trim() !== "" : !!t && typeof t === "object" && typeof t.one === "string" && typeof t.other === "string";
			const missing = Object.keys(en).filter((k) => !okValue(en[k], tr[k]));
			if (missing.length) {
				console.error(`${lang}/${area}: faltan ${missing.length} claves: ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? "…" : ""}`);
				failed = true;
				continue;
			}
			// Los marcadores tienen que ser los mismos.
			const marks = (s) => [...new Set(s.match(/\{\w+\}/g) ?? [])].sort().join();
			for (const k of Object.keys(en)) {
				const pairs = typeof en[k] === "string" ? [[en[k], tr[k]]] : [[en[k].other, tr[k].other], [en[k].one, tr[k].one]];
				for (const [e, t] of pairs) {
					// En «one» el número puede ir escrito como palabra («Una persona»): sólo se exige en «other».
					const want = marks(e);
					const got = marks(t);
					if (want !== got && !(pairs.length === 2 && e === en[k].one && got === want.replace(/\{count\},?/, "").replace(/,$/, ""))) {
						console.error(`${lang}/${area}.${k}: marcadores ${got || "(ninguno)"} en vez de ${want}`);
						failed = true;
					}
				}
			}
			data = Object.fromEntries(Object.keys(en).map((k) => [k, tr[k]]));
		}
		const header = "// Generado por @ondesk/shared/scripts/i18n-dict.mjs; desde aquí se edita a mano.\n";
		const typed = lang === "en" ? "" : `import type { ${typeName} } from "..";\n\n`;
		const decl = lang === "en" ? `export const ${area} = {` : `export const ${area}: ${typeName}[${quote(area)}] = {`;
		writeFileSync(join(dir, `${area}.ts`), `${header}${typed}${decl}\n${body(data)}\n};\n`);
		written.push(area);
	}
	const imports = written.map((a) => `import { ${a} } from "./${a}";`).join("\n");
	const typed = lang === "en" ? "" : `import type { ${typeName} } from "..";\n`;
	const decl = lang === "en" ? `export const en = { ${written.join(", ")} };` : `export const ${lang}: ${typeName} = { ${written.join(", ")} };`;
	if (lang === "en" || written.length === areas.length) {
		writeFileSync(join(dir, "index.ts"), `// Generado por @ondesk/shared/scripts/i18n-dict.mjs.\n${typed}${imports}\n\n${decl}\n`);
	}
}
console.log(`${areas.length} áreas: ${areas.join(", ")}`);
process.exit(failed ? 1 : 0);

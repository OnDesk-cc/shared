#!/usr/bin/env node
/**
 * El escáner de textos sin traducir. Lista el texto visible que sigue escrito a
 * mano en el JSX en vez de salir del diccionario:
 *
 *   - texto JSX con al menos una letra (`<p>Hello</p>`);
 *   - cadenas literales en atributos que se leen (`placeholder`, `title`,
 *     `aria-label`, `alt`, `label`, `description`, …), también plantillas
 *     (`aria-label={`Remove ${x}`}` sale como «Remove …»);
 *   - el primer argumento literal de `toast()`, `toast.*()`, `confirm()` y `alert()`.
 *
 * Uso, desde cualquier repo que tenga `@ondesk/shared` y `typescript`:
 *
 *   node node_modules/@ondesk/shared/scripts/i18n-literals.mjs src [más dirs] [--allow i18n-literals.allow.json]
 *
 * `--allow` es `{ "ruta/relativa/o/nombre.tsx": ["OnDesk", …], "*": ["…"] }`:
 * marcas, códigos y nombres propios que no se traducen. Sale con 1 si queda algo.
 * Ver la spec `ondesk/docs/specs/2026-11-06-plataforma-multilingue.md`.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const TEXT_ATTRIBUTES = new Set([
	"placeholder",
	"title",
	"aria-label",
	"aria-description",
	"alt",
	"label",
	"description",
	"emptyText",
	"confirmLabel",
	"cancelLabel",
	"tooltip",
	"heading",
	"subtitle",
	"hint",
]);
const CALLS = new Set(["toast", "confirm", "alert"]);
const HAS_LETTER = /\p{L}/u;

function calleeRoot(expr) {
	if (ts.isIdentifier(expr)) return expr.text;
	if (ts.isPropertyAccessExpression(expr)) return calleeRoot(expr.expression);
	return null;
}

/** Los hallazgos de un archivo: `{ line, text }`, en orden. `allow` quita textos exactos. */
export function scanSource(fileName, text, allow = []) {
	const allowed = new Set(allow);
	const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
	const found = [];
	const push = (node, value) => {
		const clean = value.replace(/\s+/g, " ").trim();
		if (!clean || !HAS_LETTER.test(clean) || allowed.has(clean)) return;
		found.push({ line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, text: clean });
	};
	// Cadenas sueltas dentro de una expresión hija de JSX (`{ok ? "Copied" : x}`),
	// sin entrar en llamadas: `{list.join(", ")}` o `{t(d.x)}` no son texto visible.
	const visitChildExpression = (node) => {
		if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) push(node, node.text);
		else if (ts.isConditionalExpression(node)) {
			visitChildExpression(node.whenTrue);
			visitChildExpression(node.whenFalse);
		} else if (ts.isBinaryExpression(node)) {
			visitChildExpression(node.left);
			visitChildExpression(node.right);
		} else if (ts.isParenthesizedExpression(node)) visitChildExpression(node.expression);
	};
	const visit = (node) => {
		if (ts.isJsxText(node)) push(node, node.text);
		else if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)))
			visitChildExpression(node.expression);
		else if (ts.isJsxAttribute(node) && node.initializer) {
			const name = node.name.getText(sf);
			if (TEXT_ATTRIBUTES.has(name)) {
				const init = node.initializer;
				if (ts.isStringLiteral(init)) push(init, init.text);
				else if (ts.isJsxExpression(init) && init.expression && (ts.isStringLiteral(init.expression) || ts.isNoSubstitutionTemplateLiteral(init.expression)))
					push(init.expression, init.expression.text);
				else if (ts.isJsxExpression(init) && init.expression && ts.isTemplateExpression(init.expression)) {
					// `Remove ${x}` → «Remove …»: el texto fijo de la plantilla, con un hueco por variable.
					const tpl = init.expression;
					push(tpl, [tpl.head.text, ...tpl.templateSpans.map((span) => span.literal.text)].join("…"));
				}
			}
		} else if (ts.isCallExpression(node) && CALLS.has(calleeRoot(node.expression) ?? "")) {
			const first = node.arguments[0];
			if (first && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))) push(first, first.text);
		}
		ts.forEachChild(node, visit);
	};
	visit(sf);
	return found;
}

function* walk(dir) {
	for (const entry of readdirSync(dir)) {
		if (entry === "node_modules" || entry.startsWith(".")) continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) yield* walk(full);
		else if (full.endsWith(".tsx") && !full.endsWith(".test.tsx")) yield full;
	}
}

function main(argv) {
	const dirs = [];
	let allowFile = null;
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === "--allow") allowFile = argv[++i];
		else dirs.push(argv[i]);
	}
	if (dirs.length === 0) {
		console.error("uso: i18n-literals.mjs <dir...> [--allow archivo.json]");
		process.exit(2);
	}
	const allow = allowFile && existsSync(allowFile) ? JSON.parse(readFileSync(allowFile, "utf8")) : {};
	const cwd = process.cwd();
	let total = 0;
	for (const dir of dirs) {
		for (const file of walk(dir)) {
			const rel = relative(cwd, file).replace(/\\/g, "/");
			const list = [...(allow["*"] ?? []), ...(allow[rel] ?? []), ...(allow[basename(file)] ?? [])];
			for (const f of scanSource(file, readFileSync(file, "utf8"), list)) {
				console.log(`${rel}:${f.line}  ${f.text}`);
				total++;
			}
		}
	}
	console.log(total === 0 ? "i18n-literals: 0 textos sin traducir" : `i18n-literals: ${total} textos sin traducir`);
	process.exit(total === 0 ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main(process.argv.slice(2));

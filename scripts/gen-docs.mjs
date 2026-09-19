#!/usr/bin/env node
/**
 * Regenera los bloques `<!-- BEGIN generated:… -->` de docs/.
 *
 * Lee el código real (wrangler.toml, functions/, src/routes/, _db/) y reescribe
 * SOLO lo que hay entre marcadores. Todo lo que escribas a mano fuera de ellos
 * sobrevive intacto, así que este script se puede correr siempre que cambies algo:
 *
 *     npm run docs
 *
 * Si un doc no existe, lo crea con la plantilla mínima. Si un bloque no aparece
 * en el doc, el script avisa en vez de inventarse dónde meterlo.
 *
 * Sin dependencias: Node >= 18, nada que instalar.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep, basename, extname } from "node:path";

const ROOT = process.cwd();
const DOCS = join(ROOT, "docs");
const argv = new Set(process.argv.slice(2));
const CHECK = argv.has("--check");

/* ────────────────────────────────────────────────────────────────────────────
 * utilidades
 * ──────────────────────────────────────────────────────────────────────────── */

const read = (p) => readFileSync(p, "utf8");
const exists = (p) => existsSync(p);

function walk(dir, out = []) {
	if (!exists(dir)) return out;
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full, out);
		else out.push(full);
	}
	return out;
}

/** Ruta relativa al proyecto, siempre con `/`, para que sirva de enlace markdown. */
const rel = (p) => relative(ROOT, p).split(sep).join("/");

/** Escapa lo que rompería una celda de tabla markdown. */
const cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();

/**
 * Primera frase de un texto, recortada.
 *
 * Corta sólo en punto seguido de espacio o fin: cortar también en `:` partía
 * resúmenes por los dos puntos que viven dentro de un backtick
 * (`at_period_end: true`).
 */
function firstSentence(text, max = 170) {
	if (!text) return "";
	const clean = text.replace(/\s+/g, " ").trim();
	if (!clean) return "";
	const m = clean.match(/^(.+?\.)(\s|$)/);
	let out = m ? m[1] : clean;
	if (out.length > max) out = out.slice(0, max - 1).replace(/\s\S*$/, "") + "…";
	return out;
}

/**
 * ¿Es esta línea una regla decorativa (`─── Título ───`, `═══════`) en vez de
 * prosa? El repo las usa como separadores de sección, y sin filtrarlas el
 * resumen de media tabla acaba siendo una fila de guiones.
 */
const isRule = (p) =>
	// Los títulos de sección abren con DOS caracteres de caja (`── Por qué ──`),
	// así que para ─ y ═ basta con dos. Para el guion y la raya hacen falta tres:
	// una raya suelta es prosa normal («— y por eso…»), no un separador.
	/^[─═]{2,}/.test(p.trim()) || /^[-—=_*·+]{3,}/.test(p.trim());

/* ────────────────────────────────────────────────────────────────────────────
 * TOML (subconjunto suficiente para wrangler.toml)
 * ──────────────────────────────────────────────────────────────────────────── */

function parseToml(text) {
	const root = {};
	let cur = root;

	const value = (raw) => {
		raw = raw.trim();
		if (raw.startsWith("[")) {
			const inner = raw.slice(1, raw.lastIndexOf("]"));
			if (!inner.trim()) return [];
			return inner.split(",").map((s) => value(s)).filter((s) => s !== "");
		}
		if (/^"(.*)"$/s.test(raw)) return raw.slice(1, -1);
		if (/^'(.*)'$/s.test(raw)) return raw.slice(1, -1);
		if (raw === "true") return true;
		if (raw === "false") return false;
		if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
		return raw;
	};

	const descend = (path, arrayed) => {
		let node = root;
		for (let i = 0; i < path.length; i++) {
			const key = path[i];
			const last = i === path.length - 1;
			if (last && arrayed) {
				node[key] ??= [];
				const fresh = {};
				node[key].push(fresh);
				return fresh;
			}
			if (Array.isArray(node[key])) node = node[key][node[key].length - 1];
			else node = node[key] ??= {};
		}
		return node;
	};

	// Une líneas de un array multilínea antes de parsear.
	const lines = [];
	let buffer = null;
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.replace(/(^|\s)#.*$/, "").trim();
		if (!line) continue;
		if (buffer !== null) {
			buffer += " " + line;
			if (line.includes("]")) {
				lines.push(buffer);
				buffer = null;
			}
			continue;
		}
		if (/=\s*\[[^\]]*$/.test(line)) {
			buffer = line;
			continue;
		}
		lines.push(line);
	}

	for (const line of lines) {
		const arr = line.match(/^\[\[(.+?)\]\]$/);
		if (arr) {
			cur = descend(arr[1].split("."), true);
			continue;
		}
		const tbl = line.match(/^\[(.+?)\]$/);
		if (tbl) {
			cur = descend(tbl[1].split("."), false);
			continue;
		}
		const kv = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
		if (kv) cur[kv[1]] = value(kv[2]);
	}

	return root;
}

/* ────────────────────────────────────────────────────────────────────────────
 * lectura de código: comentarios, métodos, guards
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * El comentario de cabecera de un archivo.
 *
 * Primero busca un bloque `/** … *\/`. Si no lo hay, acepta un bloque de líneas
 * `//` seguidas: media docena de archivos de este repo documentan su ruta así,
 * con el mismo cuidado, y tratarlos como «sin comentar» era un hueco inventado.
 */
function leadingDocComment(src) {
	const block = src.match(/\/\*\*([\s\S]*?)\*\//);
	if (block) {
		return block[1]
			.split(/\r?\n/)
			.map((l) => l.replace(/^\s*\*\s?/, ""))
			.join("\n")
			.trim();
	}

	// El bloque `//` más largo del archivo, que en la práctica es el de cabecera:
	// los comentarios sueltos de dentro de un handler son de una o dos líneas.
	let best = [];
	let run = [];
	for (const raw of src.split(/\r?\n/)) {
		const line = raw.trim();
		if (line.startsWith("//")) {
			run.push(line.replace(/^\/\/\s?/, ""));
		} else {
			if (run.length > best.length) best = run;
			run = [];
		}
	}
	if (run.length > best.length) best = run;

	return best.length >= 2 ? best.join("\n").trim() : "";
}

/**
 * Primer párrafo de prosa de un comentario de cabecera.
 *
 * Salta la línea de ruta con la que abren los handlers (`GET /api/presence?…`)
 * y los títulos de sección `── Así ──`, que son rótulos y no explican nada por
 * sí solos.
 */
const ROUTE_LINE = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|ALL)\s+\//;

function firstProse(doc) {
	if (!doc) return "";

	const paragraphs = doc
		.split(/\n\s*\n/)
		.map((p) => p.trim())
		.filter(Boolean)
		// Las líneas de ruta se quitan DENTRO del párrafo, no descartándolo
		// entero: muchas cabeceras listan los métodos y siguen con la prosa sin
		// una línea en blanco en medio, y tirar el párrafo se llevaba las dos.
		.map((p) =>
			p
				.split("\n")
				.filter((l) => !ROUTE_LINE.test(l.trim()))
				.join("\n")
				.trim(),
		)
		.filter(Boolean)
		.filter((p) => !isRule(p));

	return firstSentence(paragraphs[0] || "");
}

const handlerSummary = (src) => firstProse(leadingDocComment(src));

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

/** Recorta el objeto literal que sigue a un índice, equilibrando llaves. */
function objectAfter(src, from) {
	const open = src.indexOf("{", from);
	if (open === -1) return "";
	let depth = 0;
	for (let i = open; i < src.length; i++) {
		const c = src[i];
		if (c === "{") depth++;
		else if (c === "}") {
			depth--;
			if (depth === 0) return src.slice(open, i + 1);
		}
	}
	return "";
}

/** Métodos HTTP que sirve un handler de Pages Functions. */
function methodsOf(src) {
	const found = new Set();

	for (const m of src.matchAll(/export\s+const\s+onRequest([A-Z][a-z]+)/g)) {
		const verb = m[1].toUpperCase();
		if (HTTP_METHODS.includes(verb)) found.add(verb);
	}

	// createMethodRouter(request.method, { GET: …, POST: … })
	for (const m of src.matchAll(/createMethodRouter\s*\(/g)) {
		const obj = objectAfter(src, m.index);
		// sólo las claves del primer nivel del objeto
		let depth = 0;
		for (let i = 0; i < obj.length; i++) {
			const c = obj[i];
			if (c === "{") depth++;
			else if (c === "}") depth--;
			else if (depth === 1) {
				const slice = obj.slice(i, i + 12);
				const k = slice.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*:/);
				if (k) found.add(k[1]);
			}
		}
	}

	if (found.size === 0 && /export\s+const\s+onRequest\b/.test(src)) return ["ALL"];
	return HTTP_METHODS.filter((m) => found.has(m));
}

/** El middleware que envuelve al handler exportado. */
function guardOf(src) {
	const m = src.match(/export\s+const\s+onRequest[A-Za-z]*\s*(?::[^=]+)?=\s*([A-Za-z_$][\w$]*)\s*[(<]/);
	if (!m) return "";
	const name = m[1];
	if (/^with[A-Z]/.test(name)) return name;
	if (name === "async" || name === "createMethodRouter") return "público";
	return name;
}

/* ────────────────────────────────────────────────────────────────────────────
 * rutas de Pages Functions
 * ──────────────────────────────────────────────────────────────────────────── */

function functionRoutes() {
	const base = join(ROOT, "functions");
	if (!exists(base)) return { routes: [], middlewares: [] };

	const routes = [];
	const middlewares = [];

	for (const file of walk(base)) {
		const relPath = relative(base, file).split(sep);
		if (relPath.some((s) => s.startsWith("_") && s !== "_middleware.ts")) continue;
		if (![".ts", ".tsx", ".js"].includes(extname(file))) continue;

		const src = read(file);
		const name = basename(file, extname(file));
		const dirs = relPath.slice(0, -1);

		if (name === "_middleware") {
			middlewares.push({
				scope: "/" + [...dirs].join("/"),
				file: rel(file),
				summary: firstProse(leadingDocComment(src)),
			});
			continue;
		}

		const segments = [...dirs];
		if (name !== "index") segments.push(name);

		const path =
			"/" +
			segments
				.map((s) =>
					s
						.replace(/^\[\[(.+)\]\]$/, "*$1")
						.replace(/^\[(.+)\]$/, ":$1"),
				)
				.join("/");

		routes.push({
			path: path === "/" ? "/" : path.replace(/\/$/, ""),
			methods: methodsOf(src),
			guard: guardOf(src),
			summary: handlerSummary(src),
			file: rel(file),
		});
	}

	routes.sort((a, b) => a.path.localeCompare(b.path));
	middlewares.sort((a, b) => a.scope.localeCompare(b.scope));
	return { routes, middlewares };
}

/* ────────────────────────────────────────────────────────────────────────────
 * rutas del SPA (TanStack Router, file-based)
 * ──────────────────────────────────────────────────────────────────────────── */

function spaRoutes() {
	const base = join(ROOT, "src", "routes");
	if (!exists(base)) return [];

	const out = [];
	for (const file of walk(base)) {
		if (![".tsx", ".ts"].includes(extname(file))) continue;
		const name = basename(file, extname(file));
		if (name === "__root") continue;

		const parts = relative(base, file).split(sep);
		parts[parts.length - 1] = name;

		// `a.b.tsx` es `a/b`; el `_` final escapa el layout del padre.
		const segments = parts
			.flatMap((p) => p.split("."))
			.map((p) => p.replace(/_$/, ""))
			.filter((p) => p && p !== "index" && p !== "route");

		const path =
			"/" +
			segments
				.map((s) => s.replace(/^\{-\$(.+)\}$/, "{-:$1}").replace(/^\$(.+)$/, ":$1"))
				.join("/");

		const src = read(file);
		out.push({
			path: path === "/" ? "/" : path.replace(/\/$/, "") || "/",
			kind: name === "route" ? "layout" : "página",
			summary: firstProse(leadingDocComment(src)),
			file: rel(file),
		});
	}

	out.sort((a, b) => a.path.localeCompare(b.path));
	return out;
}

/* ────────────────────────────────────────────────────────────────────────────
 * base de datos
 * ──────────────────────────────────────────────────────────────────────────── */

function migrations() {
	const dir = join(ROOT, "functions", "_db", "migrations");
	if (!exists(dir)) return [];
	return readdirSync(dir)
		.filter((f) => f.endsWith(".sql"))
		.sort()
		.map((f) => {
			const src = read(join(dir, f));
			const comment = src
				.split(/\r?\n/)
				.filter((l) => l.trim().startsWith("--"))
				.map((l) => l.replace(/^\s*--\s?/, "").trim())
				.filter((l) => l && !isRule(l))
				.join(" ");
			const tables = [...src.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)/gi)].map((m) => m[1]);
			const altered = [...src.matchAll(/ALTER\s+TABLE\s+[`"]?(\w+)/gi)].map((m) => m[1]);
			return {
				file: f,
				summary: firstSentence(comment),
				creates: [...new Set(tables)],
				alters: [...new Set(altered)].filter((t) => !tables.includes(t)),
			};
		});
}

function schemaTables() {
	const candidates = [
		join(ROOT, "functions", "_db", "schema.sql"),
		join(ROOT, "src", "schema.sql"),
	].filter(exists);
	if (candidates.length === 0) return [];

	const out = [];
	for (const file of candidates) {
		const src = read(file);
		for (const m of src.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)[`"]?\s*\(/gi)) {
			// Los comentarios `--` se quitan ANTES de partir por comas: si no, cada
			// línea de comentario dentro del CREATE TABLE se cuenta como columna.
			const body = objectLikeAfter(src, m.index + m[0].length - 1)
				.split(/\r?\n/)
				.map((l) => l.replace(/--.*$/, ""))
				.join("\n");

			const columns = body
				.split(/,\s*\n/)
				.map((l) => l.trim())
				.filter((l) => l && !/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)\b/i.test(l))
				.map((l) => l.split(/\s+/)[0].replace(/[`"(),]/g, ""))
				.filter((c) => /^\w+$/.test(c));

			// El comentario que precede al CREATE TABLE es la descripción de la tabla.
			const before = src.slice(0, m.index).split(/\r?\n/);
			const lead = [];
			for (let i = before.length - 1; i >= 0; i--) {
				const l = before[i].trim();
				if (l.startsWith("--")) lead.unshift(l.replace(/^--\s?/, ""));
				else if (l === "") { if (lead.length) break; }
				else break;
			}

			out.push({
				name: m[1],
				columns: [...new Set(columns)],
				summary: firstSentence(lead.filter((l) => !isRule(l)).join(" ")),
				file: rel(file),
			});
		}
	}
	out.sort((a, b) => a.name.localeCompare(b.name));
	return out;
}

/** Como objectAfter pero con paréntesis, para el cuerpo de un CREATE TABLE. */
function objectLikeAfter(src, from) {
	const open = src.indexOf("(", from);
	if (open === -1) return "";
	let depth = 0;
	for (let i = open; i < src.length; i++) {
		const c = src[i];
		if (c === "(") depth++;
		else if (c === ")") {
			depth--;
			if (depth === 0) return src.slice(open + 1, i);
		}
	}
	return "";
}

/* ────────────────────────────────────────────────────────────────────────────
 * módulos sueltos (Workers y librerías, que no tienen enrutado por archivos)
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Los módulos del proyecto, con su comentario de cabecera.
 *
 * Normalmente es `src/`. El paquete `shared` no tiene `src/`: publica sus
 * carpetas en la raíz (`ui/`, `worker/`, `lib/`…), así que cuando no hay `src/`
 * se recorren esas.
 */
const ROOT_SOURCE_DIRS = ["calls", "components", "hooks", "lib", "presence", "ui", "worker"];

function modules() {
	const bases = exists(join(ROOT, "src"))
		? [join(ROOT, "src")]
		: ROOT_SOURCE_DIRS.map((d) => join(ROOT, d)).filter(exists);

	return bases
		.flatMap((base) => walk(base))
		.filter((f) => [".ts", ".tsx"].includes(extname(f)))
		.filter((f) => !f.includes(`${sep}routes${sep}`))
		// Lo genera el plugin de TanStack Router en cada build: documentarlo sólo
		// añade una fila que nadie va a abrir.
		.filter((f) => basename(f) !== "routeTree.gen.ts")
		.map((f) => ({
			file: rel(f),
			summary: firstProse(leadingDocComment(read(f))),
		}))
		.sort((a, b) => a.file.localeCompare(b.file));
}

/**
 * La lógica compartida de `functions/_lib/`, que es donde está casi todo el
 * "por qué" de un proyecto con Functions: los handlers suelen ser diez líneas
 * que llaman aquí. Se lista aparte de `modules()` porque es el primer sitio al
 * que hay que mirar y no debería quedar enterrado entre los tipos.
 */
function libs() {
	const base = join(ROOT, "functions", "_lib");
	if (!exists(base)) return [];
	return walk(base)
		.filter((f) => extname(f) === ".ts")
		.map((f) => {
			const src = read(f);
			const exported = [
				...src.matchAll(/export\s+(?:async\s+)?function\s+([\w$]+)/g),
				...src.matchAll(/export\s+const\s+([\w$]+)\s*[=:]/g),
			].map((m) => m[1]);
			return {
				file: rel(f),
				summary: firstProse(leadingDocComment(src)),
				exports: [...new Set(exported)],
			};
		})
		.sort((a, b) => a.file.localeCompare(b.file));
}

/* ────────────────────────────────────────────────────────────────────────────
 * config: bindings, vars, crons, dependencias
 * ──────────────────────────────────────────────────────────────────────────── */

function config() {
	const wranglerPath = join(ROOT, "wrangler.toml");
	const pkgPath = join(ROOT, "package.json");
	const wrangler = exists(wranglerPath) ? parseToml(read(wranglerPath)) : null;
	const pkg = exists(pkgPath) ? JSON.parse(read(pkgPath)) : {};

	const bindings = [];
	const push = (kind, name, detail) => name && bindings.push({ kind, name, detail: detail || "" });

	if (wrangler) {
		for (const d of wrangler.d1_databases ?? []) push("D1", d.binding, d.database_name);
		for (const b of wrangler.r2_buckets ?? []) push("R2", b.binding, b.bucket_name);
		for (const k of wrangler.kv_namespaces ?? []) push("KV", k.binding, k.id);
		for (const q of wrangler.queues?.producers ?? []) push("Queue (productor)", q.binding, q.queue);
		for (const s of wrangler.services ?? []) push("Service", s.binding, s.service);
		for (const o of wrangler.durable_objects?.bindings ?? [])
			push("Durable Object", o.name, [o.class_name, o.script_name].filter(Boolean).join(" @ "));
		if (wrangler.ai?.binding) push("Workers AI", wrangler.ai.binding, "");
		for (const b of wrangler.browser ? [wrangler.browser] : []) push("Browser", b.binding, "");
	}

	const vars = Object.entries(wrangler?.vars ?? {}).map(([k, v]) => ({ name: k, value: String(v) }));
	const crons = wrangler?.triggers?.crons ?? [];

	// Secretos: los que el wrangler.toml documenta en sus comentarios.
	const secrets = new Set();
	if (exists(wranglerPath)) {
		for (const m of read(wranglerPath).matchAll(/secret\s+put\s+([A-Z0-9_]+)/g)) secrets.add(m[1]);
	}
	const devVars = join(ROOT, ".dev.vars.example");
	if (exists(devVars)) {
		for (const m of read(devVars).matchAll(/^([A-Z0-9_]+)\s*=/gm)) secrets.add(m[1]);
	}

	return {
		wrangler,
		pkg,
		bindings,
		vars,
		crons,
		secrets: [...secrets].sort(),
		sharedPin: pkg.dependencies?.["@ondesk/shared"] || pkg.devDependencies?.["@ondesk/shared"] || "",
		scripts: Object.entries(pkg.scripts ?? {}),
	};
}

/* ────────────────────────────────────────────────────────────────────────────
 * render de bloques
 * ──────────────────────────────────────────────────────────────────────────── */

function table(headers, rows) {
	if (rows.length === 0) return "_Nada que listar._";
	const head = `| ${headers.join(" | ")} |`;
	const sep_ = `| ${headers.map(() => "---").join(" | ")} |`;
	const body = rows.map((r) => `| ${r.map(cell).join(" | ")} |`).join("\n");
	return [head, sep_, body].join("\n");
}

function buildBlocks() {
	const cfg = config();
	const { routes, middlewares } = functionRoutes();
	const spa = spaRoutes();
	const migs = migrations();
	const tables = schemaTables();
	const blocks = {};

	// Las cabeceras vacías se quitan ANTES de unir: un proyecto sin wrangler.toml
	// dejaba media docena de líneas en blanco al principio del bloque.
	const configHeader = [
		cfg.wrangler?.name ? `**Proyecto Cloudflare:** \`${cfg.wrangler.name}\`` : "",
		cfg.wrangler?.main ? `**Entrada:** [\`${cfg.wrangler.main}\`](../${cfg.wrangler.main}) (Worker)` : "",
		cfg.wrangler?.pages_build_output_dir ? `**Salida de build:** \`${cfg.wrangler.pages_build_output_dir}\` (Pages)` : "",
		cfg.sharedPin ? `**\`@ondesk/shared\`:** \`${cfg.sharedPin}\`` : "",
	].filter(Boolean);

	blocks["config"] = [
		configHeader.length ? configHeader.join("\n") : "_Sin `wrangler.toml`: este proyecto no se despliega por su cuenta._",
		"",
		"### Bindings",
		"",
		table(["Binding", "Tipo", "Recurso"], cfg.bindings.map((b) => [`\`${b.name}\``, b.kind, b.detail ? `\`${b.detail}\`` : "—"])),
		"",
		"### Variables (`[vars]`, públicas)",
		"",
		table(["Nombre", "Valor"], cfg.vars.map((v) => [`\`${v.name}\``, `\`${v.value}\``])),
		"",
		"### Secretos",
		"",
		cfg.secrets.length
			? cfg.secrets.map((s) => `- \`${s}\``).join("\n")
			: "_Ninguno declarado en `wrangler.toml` ni en `.dev.vars.example`._",
		"",
		"### Cron",
		"",
		cfg.crons.length ? table(["Expresión"], cfg.crons.map((c) => [`\`${c}\``])) : "_Sin cron propio._",
		"",
		"### Scripts de npm",
		"",
		table(["Script", "Comando"], cfg.scripts.map(([k, v]) => [`\`npm run ${k}\``, `\`${v}\``])),
	]
		.filter((l) => l !== null)
		.join("\n");

	blocks["api"] = [
		`Rutas derivadas del árbol de \`functions/\` (${routes.length} endpoints).`,
		"",
		table(
			["Ruta", "Métodos", "Guard", "Qué hace", "Archivo"],
			routes.map((r) => [
				`\`${r.path}\``,
				r.methods.join(", ") || "—",
				r.guard ? `\`${r.guard}\`` : "—",
				r.summary || "—",
				`[\`${r.file.replace(/^functions\//, "")}\`](../${r.file})`,
			]),
		),
		"",
		"### Middleware",
		"",
		table(
			["Alcance", "Archivo", "Qué hace"],
			middlewares.map((m) => [`\`${m.scope}\``, `[\`${m.file}\`](../${m.file})`, m.summary || "—"]),
		),
	].join("\n");

	blocks["frontend"] = [
		`Rutas del SPA derivadas de \`src/routes/\` (${spa.length} archivos). \`{-:lang}\` es un segmento opcional.`,
		"",
		table(
			["Ruta", "Tipo", "Qué es", "Archivo"],
			spa.map((r) => [`\`${r.path}\``, r.kind, r.summary || "—", `[\`${r.file.replace(/^src\/routes\//, "")}\`](../${r.file})`]),
		),
	].join("\n");

	blocks["schema"] = [
		`${tables.length} tablas en el esquema.`,
		"",
		table(
			["Tabla", "Para qué", "Columnas"],
			tables.map((t) => [`\`${t.name}\``, t.summary || "—", t.columns.map((c) => `\`${c}\``).join(" ")]),
		),
	].join("\n");

	blocks["migrations"] = [
		`${migs.length} migraciones en \`functions/_db/migrations/\`, en orden de aplicación.`,
		"",
		table(
			["Migración", "Qué hace", "Crea", "Altera"],
			migs.map((m) => [
				`\`${m.file}\``,
				m.summary || "—",
				m.creates.map((t) => `\`${t}\``).join(" ") || "—",
				m.alters.map((t) => `\`${t}\``).join(" ") || "—",
			]),
		),
	].join("\n");

	const libraries = libs();
	blocks["libs"] = [
		`La lógica vive aquí: ${libraries.length} módulos en \`functions/_lib/\`. Los handlers casi siempre son una llamada a uno de estos.`,
		"",
		table(
			["Módulo", "Qué resuelve", "Exporta"],
			libraries.map((l) => [
				`[\`${l.file.replace(/^functions\/_lib\//, "")}\`](../${l.file})`,
				l.summary || "—",
				l.exports.slice(0, 8).map((e) => `\`${e}\``).join(" ") + (l.exports.length > 8 ? ` …+${l.exports.length - 8}` : ""),
			]),
		),
	].join("\n");

	const moduleList = modules();
	const moduleRoot = exists(join(ROOT, "src")) ? "`src/`" : "las carpetas publicadas";

	blocks["modules"] = [
		`Módulos de ${moduleRoot} (${moduleList.length}), con la primera línea de su comentario de cabecera.`,
		"",
		table(
			["Archivo", "Qué hace"],
			moduleList.map((m) => [`[\`${m.file}\`](../${m.file})`, m.summary || "—"]),
		),
	].join("\n");

	// Un bloque sin datos no es un hueco: un Worker no tiene rutas de SPA y un
	// SPA sin backend no tiene migraciones. Sólo avisamos de los que SÍ tienen
	// algo que contar y no encontraron dónde ponerlo.
	const empty = new Set(
		Object.entries({
			api: routes.length,
			libs: libraries.length,
			frontend: spa.length,
			schema: tables.length,
			migrations: migs.length,
			modules: modules().length,
			config: 1,
		})
			.filter(([, n]) => n === 0)
			.map(([k]) => k),
	);

	return {
		blocks,
		empty,
		stats: { routes: routes.length, spa: spa.length, migs: migs.length, tables: tables.length },
	};
}

/* ────────────────────────────────────────────────────────────────────────────
 * escritura
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Rellena los marcadores de un documento.
 *
 * Los bloques de código con ``` se dejan intactos: un doc que EXPLICA cómo
 * funcionan los marcadores enseña un marcador de ejemplo, y sin esta salvedad el
 * script se lo rellenaría con la tabla entera.
 */
function applyBlocks(text, blocks) {
	const used = new Set();

	// Partir por vallas de código deja los trozos impares dentro de un bloque.
	const parts = text.split(/(^```[\s\S]*?^```)/gm);

	const out = parts
		.map((part, i) => {
			if (i % 2 === 1) return part; // dentro de ```…```
			let piece = part;
			for (const [key, body] of Object.entries(blocks)) {
				const re = new RegExp(
					`(<!--\\s*BEGIN generated:${key}\\s*-->)[\\s\\S]*?(<!--\\s*END generated:${key}\\s*-->)`,
					"g",
				);
				if (!re.test(piece)) continue;
				re.lastIndex = 0;
				piece = piece.replace(re, `$1\n<!-- No edites aquí: lo reescribe \`npm run docs\`. -->\n\n${body}\n\n$2`);
				used.add(key);
			}
			return piece;
		})
		.join("");

	return { out, used: [...used] };
}

/**
 * Qué está sin comentar.
 *
 * Todo lo que en las tablas sale como «—» es un archivo sin comentario de
 * cabecera, así que el mismo parseo que llena los docs sirve para encontrar los
 * huecos. Esto es una lista de trabajo, no un error: `npm run docs:gaps`.
 */
/**
 * Los primitivos de shadcn son código de terceros copiado. Comentarlos no ayuda
 * a nadie y estorba al actualizarlos, así que no cuentan como hueco.
 */
const isVendoredUi = (file) => /(^|\/)(ui)\//.test(file) || /(^|\/)components\/ui\//.test(file);

function reportGaps() {
	const { routes } = functionRoutes();
	const spa = spaRoutes();
	const mods = modules().filter((m) => !isVendoredUi(m.file));

	const groups = [
		["Endpoints sin comentario de cabecera", routes.filter((r) => !r.summary).map((r) => `${r.path}  →  ${r.file}`)],
		["Rutas del SPA sin comentario", spa.filter((r) => !r.summary).map((r) => `${r.path}  →  ${r.file}`)],
		["Módulos sin comentario", mods.filter((m) => !m.summary).map((m) => m.file)],
	];

	let total = 0;
	for (const [title, items] of groups) {
		if (!items.length) continue;
		total += items.length;
		console.log(`\n${title} (${items.length})`);
		for (const i of items) console.log(`  · ${i}`);
	}
	console.log(total === 0 ? "\nTodo comentado." : `\n${total} archivo(s) sin cabecera.`);
}

function main() {
	if (argv.has("--gaps")) return reportGaps();

	const printKey = [...argv].find((a) => a.startsWith("--print="))?.slice(8);
	if (printKey) {
		const { blocks } = buildBlocks();
		console.log(blocks[printKey] ?? `sin bloque «${printKey}»`);
		return;
	}

	if (!exists(DOCS)) mkdirSync(DOCS, { recursive: true });
	const { blocks, empty, stats } = buildBlocks();

	const docFiles = readdirSync(DOCS).filter((f) => f.endsWith(".md"));
	let changed = 0;
	const placed = new Set();

	for (const f of docFiles) {
		const p = join(DOCS, f);
		const before = read(p);
		const { out, used } = applyBlocks(before, blocks);
		used.forEach((u) => placed.add(u));
		if (out !== before) {
			if (CHECK) {
				console.error(`✗ desincronizado: docs/${f}`);
				changed++;
			} else {
				writeFileSync(p, out);
				console.log(`· actualizado docs/${f} (${used.join(", ")})`);
				changed++;
			}
		}
	}

	const orphans = Object.keys(blocks).filter((k) => !placed.has(k) && !empty.has(k));
	if (orphans.length) {
		console.log(`· hay datos para estos bloques y ningún doc los pide: ${orphans.join(", ")}`);
	}

	console.log(
		`\n${stats.routes} endpoints · ${stats.spa} rutas SPA · ${stats.tables} tablas · ${stats.migs} migraciones`,
	);

	if (CHECK && changed > 0) {
		console.error(`\n${changed} doc(s) desincronizado(s). Corre \`npm run docs\`.`);
		process.exit(1);
	}
}

main();

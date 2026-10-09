/**
 * Nova central en el navegador (2026-10-07; el panel acoplado, 2026-10-08).
 *
 *   NovaConversation         una conversación de Nova, sin marco: el WebSocket con
 *                            `useAgent` a `{workspaceId}~{conversación}`, su
 *                            historial, las tarjetas de herramientas y acciones y
 *                            la línea de saldo, sobre `NovaThreadFrame`. No decide
 *                            qué conversación es: se la dan (`conversationId`) y
 *                            pide otra con `onStartOver` (New chat, o la guardada
 *                            era de otra persona u otro workspace).
 *   NovaConversationLoading  lo que se ve mientras llega el historial.
 *   NovaChatSheet            la hoja modal con su conversación guardada en
 *                            sessionStorage por producto, workspace y alcance. Desde
 *                            el 2026-10-08 sólo la usa el asistente de un ticket de
 *                            Pulse (`scope: ticket:<id>`); la Nova de la barra es el
 *                            panel (components/nova-panel.tsx).
 *
 * La cookie de sesión de .ondesk.cc viaja sola, y Nova sólo deja abrir una
 * conversación a quien la empezó. `scope` va en la conexión y en get-messages
 * (`?scope=`): Nova lo guarda al reclamarla y el historial del panel deja fuera
 * las de un ticket.
 *
 * Fase 2 (2026-10-08):
 *  - Encima del texto de cada respuesta van sus herramientas
 *    (components/nova-chat-tools.tsx): la línea de una lectura en curso y la
 *    tarjeta de cada acción.
 *  - Aprobar o cancelar llama a `addToolApprovalResponse` del SDK; Nova continúa
 *    el turno sola.
 *  - Desde el 80 % usado, una línea encima del campo dice cuántos créditos
 *    quedan. Sale de lo primero que haya: el último mensaje
 *    (`metadata.nova_usage`), `initialUsage` si se pasa, o lo que se pide al
 *    montar a `GET /api/me/usage`, siempre con la superficie.
 *
 * Nada se conecta hasta que alguien abre Nova: quien la monta decide cuándo.
 */
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import { RotateCcw, SquarePen } from "lucide-react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import type { NovaUsage } from "../worker/nova-contract";
import { NovaMessageRow, NovaSheetShell, NovaSuggestions, NovaThreadFrame, novaErrorMessage, type NovaMessage, type NovaSheetProps, type NovaSuggestion } from "./nova";
import { NovaToolCards } from "./nova-chat-tools";
import { textLinkClass } from "./console";
import {
	asUsage,
	chatErrorText,
	classifyHistoryStatus,
	collectPreviews,
	conversationKey,
	latestUsage,
	messageText,
	toolCards,
	usageLine,
	usageUrl,
	type NovaProduct,
	type NovaSurface,
} from "./nova-chat-parts";

export { messageText, conversationKey, type NovaProduct, type NovaSurface } from "./nova-chat-parts";
export type { NovaUsage } from "../worker/nova-contract";

/** Una pregunta que mandar en cuanto la conversación esté lista (el campo de la portada de la consola). */
export interface NovaPendingAsk {
	id: string;
	text: string;
}

export interface NovaConversationProps {
	conversationId: string;
	/** Empezar otra: «New chat», o la guardada resultó ser de otra persona u otro workspace. */
	onStartOver: () => void;
	/** `nova.ondesk.cc`, o `127.0.0.1:8787` en local: sin protocolo. */
	novaHost: string;
	workspaceId: string;
	surface: NovaSurface;
	/** Lo que la persona tiene abierto: `{ channel_id }`, `{ file_id }`, `{ ticket_id }`… */
	place?: Record<string, string>;
	/** Una conversación atada a un objeto: `ticket:<id>`. Sin él, la del panel. */
	scope?: string;
	greeting: string;
	suggestions: NovaSuggestion[];
	scopedSuggestion?: NovaSuggestion;
	placeholder: string;
	footnote: ReactNode;
	inputLabel?: string;
	/** Acciones bajo una respuesta terminada (el «Insert into reply» de un ticket). */
	messageActions?: (message: NovaMessage, close: () => void) => ReactNode;
	/** Cerrar lo que contiene la conversación (la hoja o el panel). */
	onClose?: () => void;
	/** El saldo al abrir. Sin él, se pide a `GET /api/me/usage`; después manda el de cada respuesta. */
	initialUsage?: NovaUsage | null;
	ask?: NovaPendingAsk | null;
	onAskSent?: (id: string) => void;
	/** Encima del saludo («Started in Atlas»). */
	lead?: ReactNode;
	/** Al terminar cada turno (para refrescar el historial del panel). */
	onTurnEnd?: () => void;
	inputRef?: Ref<HTMLTextAreaElement>;
	revealKey?: unknown;
}

type LoadingProps = Pick<NovaConversationProps, "greeting" | "placeholder" | "footnote" | "inputLabel" | "lead">;

/** La conversación mientras llega el historial: el saludo y una fila pendiente. */
export function NovaConversationLoading({ greeting, placeholder, footnote, inputLabel, lead }: LoadingProps) {
	return (
		<NovaThreadFrame busy scrollKey={null} composer={{ value: "", onChange: () => {}, onSubmit: () => {}, placeholder, label: inputLabel }} footnote={footnote}>
			{lead}
			<NovaMessageRow role="assistant" content={greeting} />
			<NovaMessageRow role="assistant" content="" pending />
		</NovaThreadFrame>
	);
}

/** Va dentro de un `Suspense`: `useAgentChat` suspende mientras llega el historial. */
export function NovaConversation({
	conversationId,
	onStartOver,
	novaHost,
	workspaceId,
	surface,
	place,
	scope,
	greeting,
	suggestions,
	scopedSuggestion,
	placeholder,
	footnote,
	inputLabel,
	messageActions,
	onClose,
	initialUsage,
	ask,
	onAskSent,
	lead,
	onTurnEnd,
	inputRef,
	revealKey,
}: NovaConversationProps) {
	const [draft, setDraft] = useState("");
	const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
	// Las aprobaciones ya contestadas desde aquí: un doble clic no manda dos.
	const [answered, setAnswered] = useState<ReadonlySet<string>>(() => new Set());
	// El saldo al abrir, si no lo pasaron: una sola vez por conversación montada.
	const [openingUsage, setOpeningUsage] = useState<NovaUsage | null>(null);
	useEffect(() => {
		if (initialUsage !== undefined) return;
		let alive = true;
		fetch(usageUrl(novaHost, workspaceId, surface), { credentials: "include" })
			.then((res) => (res.ok ? res.json() : null))
			.then((body: unknown) => {
				if (alive) setOpeningUsage(asUsage(body));
			})
			.catch(() => {
				/* sin saldo al abrir: llega con la primera respuesta */
			});
		return () => {
			alive = false;
		};
	}, [initialUsage, novaHost, workspaceId, surface]);

	const [sessionExpired, setSessionExpired] = useState(false);

	const agent = useAgent({ agent: "NovaChat", name: `${workspaceId}~${conversationId}`, host: novaHost, ...(scope ? { query: { scope } } : {}) });
	const { messages, sendMessage, status, error, regenerate, addToolApprovalResponse } = useAgentChat({
		agent,
		credentials: "include",
		body: () => ({ product: surface, place: place ?? {}, timezone }),
		// El historial lo pide esto y no el SDK, que convierte cualquier fallo en
		// «sin mensajes»: con la sesión caducada se dice, y una conversación guardada
		// que es de otra persona u otro workspace se cambia por una nueva.
		getInitialMessages: async ({ url }) => {
			if (!url) return [];
			const target = new URL(url);
			target.pathname += "/get-messages";
			if (scope) target.searchParams.set("scope", scope);
			const res = await fetch(target.toString(), { credentials: "include" }).catch(() => null);
			const verdict = res ? classifyHistoryStatus(res.status) : "error";
			if (verdict === "expired") setSessionExpired(true);
			if (verdict === "foreign") onStartOver();
			if (verdict !== "ok" || !res) return [];
			setSessionExpired(false);
			const text = await res.text();
			return text.trim() ? JSON.parse(text) : [];
		},
	});

	const busy = status === "submitted" || status === "streaming";
	const visible = messages.filter((m) => m.role === "user" || m.role === "assistant");
	const last = visible[visible.length - 1];
	const waiting = status === "submitted" && last?.role !== "assistant";
	const previews = useMemo(() => collectPreviews(messages), [messages]);
	const usageText = usageLine(latestUsage(messages, initialUsage ?? openingUsage, new Date()));

	// La pregunta del campo de la portada: se manda una vez, en cuanto se puede.
	const sentAsk = useRef<string | null>(null);
	useEffect(() => {
		if (!ask || sentAsk.current === ask.id || status !== "ready") return;
		sentAsk.current = ask.id;
		void sendMessage({ text: ask.text });
		onAskSent?.(ask.id);
	}, [ask, status, sendMessage, onAskSent]);

	// El final de cada turno, para quien quiera saberlo (el historial del panel).
	const wasBusy = useRef(false);
	useEffect(() => {
		if (busy) wasBusy.current = true;
		else if (wasBusy.current) {
			wasBusy.current = false;
			onTurnEnd?.();
		}
	}, [busy, onTurnEnd]);

	function send(text: string): boolean {
		const prompt = text.trim();
		if (!prompt || busy) return false;
		void sendMessage({ text: prompt });
		return true;
	}

	function answer(approvalId: string, approved: boolean) {
		if (busy || answered.has(approvalId)) return;
		setAnswered((prev) => new Set(prev).add(approvalId));
		// Nova continúa el turno sola (autoContinueAfterToolResult) y ejecuta cada aprobación una sola vez.
		void addToolApprovalResponse({ id: approvalId, approved });
	}

	const errorText = sessionExpired
		? "Your session expired. Reload the page to keep talking to Nova."
		: error
			? (chatErrorText(error.message) ?? novaErrorMessage(error))
			: null;

	return (
		<NovaThreadFrame
			busy={busy}
			scrollKey={messages}
			revealKey={revealKey}
			composer={{
				value: draft,
				onChange: setDraft,
				onSubmit: () => {
					if (send(draft)) setDraft("");
				},
				placeholder,
				label: inputLabel,
			}}
			footnote={footnote}
			notice={usageText}
			inputRef={inputRef}>
			{lead}
			<NovaMessageRow role="assistant" content={greeting} />

			{visible.map((message, i) => {
				const text = messageText(message);
				const isLast = i === visible.length - 1;
				const streaming = busy && isLast && message.role === "assistant";
				const cards = message.role === "assistant" ? toolCards(message, { previews, latest: isLast && !busy, live: streaming }) : [];
				const done = message.role === "assistant" && !streaming && text.trim() !== "";
				return (
					<NovaMessageRow
						key={message.id}
						role={message.role === "user" ? "user" : "assistant"}
						content={text}
						pending={streaming && text === "" && cards.length === 0}
						lead={cards.length > 0 ? <NovaToolCards cards={cards} answered={answered} disabled={busy} onAnswer={answer} /> : undefined}>
						{done && messageActions ? messageActions({ role: "assistant", content: text }, () => onClose?.()) : null}
					</NovaMessageRow>
				);
			})}

			{waiting && <NovaMessageRow role="assistant" content="" pending />}

			{errorText && !busy && (
				<NovaMessageRow role="assistant" content={errorText} failed>
					{!sessionExpired && (
						<>
							<button type="button" className={`${textLinkClass} text-[0.875rem]`} onClick={() => void regenerate()}>
								<RotateCcw className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
								Try again
							</button>
							{/* Una salida siempre a mano, aunque la conversación no tenga mensajes. */}
							<button type="button" className={`${textLinkClass} text-[0.875rem]`} onClick={onStartOver}>
								<SquarePen className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
								New chat
							</button>
						</>
					)}
				</NovaMessageRow>
			)}

			{visible.length === 0 && !busy && !ask && (
				<div className="sm:pl-11">
					<NovaSuggestions suggestions={suggestions} scoped={scopedSuggestion} onPick={(p) => send(p)} disabled={busy} />
				</div>
			)}
		</NovaThreadFrame>
	);
}

// ─── la hoja (el asistente de un ticket) ─────────────────────────────────────

export interface NovaChatSheetProps extends NovaSheetProps {
	/** `nova.ondesk.cc`, o `localhost:8787` en local: sin protocolo. */
	novaHost: string;
	workspaceId: string;
	product: NovaProduct;
	/** Lo que el usuario tiene abierto: `{ channel_id }`, `{ file_id }`, `{ ticket_id }`… */
	place?: Record<string, string>;
	/** Una conversación aparte, atada a un objeto: `ticket:<id>`. */
	scope?: string;
	/** El saldo al abrir la hoja. Sin él, la hoja lo pide sola a `GET /api/me/usage`. */
	initialUsage?: NovaUsage | null;
}

function storedConversation(key: string): string {
	try {
		const existing = sessionStorage.getItem(key);
		if (existing) return existing;
	} catch {
		/* sin sessionStorage (modo privado estricto): una conversación por montaje */
	}
	return freshConversation(key);
}

function freshConversation(key: string): string {
	const id = crypto.randomUUID();
	try {
		sessionStorage.setItem(key, id);
	} catch {
		/* ídem */
	}
	return id;
}

export function NovaChatSheet(props: NovaChatSheetProps) {
	const [activated, setActivated] = useState(props.open);
	useEffect(() => {
		if (props.open) setActivated(true);
	}, [props.open]);
	if (!activated) return null;
	// `key` por producto, workspace y alcance: cambiar de workspace sin recargar
	// monta otra conversación con su propio id guardado, en vez de abrir la del
	// workspace anterior bajo el nuevo (un 403 sin salida).
	const key = conversationKey(props.product, props.workspaceId, props.scope);
	return <SheetConversation key={key} storageKey={key} {...props} />;
}

function SheetConversation({ storageKey, open, onOpenChange, title = "Nova", description, product, ...rest }: NovaChatSheetProps & { storageKey: string }) {
	const [conversationId, setConversationId] = useState(() => storedConversation(storageKey));
	const startOver = () => setConversationId(freshConversation(storageKey));
	const input = useRef<HTMLTextAreaElement | null>(null);
	return (
		<NovaSheetShell
			open={open}
			onOpenChange={onOpenChange}
			title={title}
			description={description}
			onAutoFocus={() => input.current?.focus()}
			headerAction={
				<button type="button" className={`${textLinkClass} shrink-0 text-[0.875rem]`} onClick={startOver}>
					<SquarePen className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
					New chat
				</button>
			}>
			<Suspense fallback={<NovaConversationLoading greeting={rest.greeting} placeholder={rest.placeholder} footnote={rest.footnote} inputLabel={rest.inputLabel} />}>
				<NovaConversation
					key={conversationId}
					{...rest}
					conversationId={conversationId}
					onStartOver={startOver}
					surface={product}
					onClose={() => onOpenChange(false)}
					inputRef={input}
					revealKey={open}
				/>
			</Suspense>
		</NovaSheetShell>
	);
}

/**
 * Nova central en la hoja (2026-10-07, fase 1): la única hoja de Nova de la
 * plataforma, sobre el marco de components/nova.tsx. La conversación vive en un
 * Durable Object de nova.ondesk.cc (`NovaChat`), se guarda, sobrevive a
 * recargar y se puede borrar desde /account.
 *
 * El navegador abre un WebSocket con `useAgent` a `{workspaceId}~{conversación}`;
 * la cookie de sesión de .ondesk.cc viaja sola, y Nova sólo deja abrir una
 * conversación a quien la empezó. La conversación en curso se recuerda por
 * producto, workspace y, si lo hay, alcance (`scope`: el asistente de un ticket
 * lleva la suya por ticket) en sessionStorage; «New chat» empieza otra.
 * `messageActions` pone acciones bajo cada respuesta terminada (el «Insert into
 * reply» del ticket).
 *
 * Fase 2 (2026-10-08):
 *  - Encima del texto de cada respuesta van sus herramientas
 *    (components/nova-chat-tools.tsx): la línea de una lectura en curso y la
 *    tarjeta de cada acción.
 *  - Aprobar o cancelar llama a `addToolApprovalResponse` del SDK; Nova continúa
 *    el turno sola.
 *  - Desde el 80 % usado, una línea encima del campo dice cuántos créditos
 *    quedan. Sale de lo primero que haya:
 *    - el último mensaje (`metadata.nova_usage`);
 *    - `initialUsage`, si el producto lo pasa;
 *    - lo que la hoja pide al abrirse a `GET /api/me/usage`, siempre con
 *      `product`, porque sin él el tope por producto no cuenta.
 *
 * No conecta nada hasta que alguien abre la hoja por primera vez: montada en la
 * barra de cada app, abrir un WebSocket por cada página vista sería pagar por
 * nada.
 */
import { Suspense, useEffect, useMemo, useState } from "react";
import { RotateCcw, SquarePen } from "lucide-react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import type { NovaUsage } from "../worker/nova-contract";
import { NovaMessageRow, NovaSheetFrame, NovaSuggestions, novaErrorMessage, type NovaSheetProps } from "./nova";
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
} from "./nova-chat-parts";

export { messageText, conversationKey, type NovaProduct } from "./nova-chat-parts";
export type { NovaUsage } from "../worker/nova-contract";

export interface NovaChatSheetProps extends NovaSheetProps {
	/** `nova.ondesk.cc`, o `localhost:8787` en local: sin protocolo. */
	novaHost: string;
	workspaceId: string;
	product: NovaProduct;
	/** Lo que el usuario tiene abierto: `{ channel_id }`, `{ file_id }`, `{ ticket_id }`… */
	place?: Record<string, string>;
	/** Una conversación aparte, atada a un objeto: `ticket:<id>`. Sin él, la de la barra superior. */
	scope?: string;
	/** El saldo al abrir la hoja. Sin él, la hoja lo pide sola a `GET /api/me/usage`; después manda el de cada respuesta. */
	initialUsage?: NovaUsage | null;
}

function storedConversation(key: string): string {
	try {
		const existing = sessionStorage.getItem(key);
		if (existing) return existing;
	} catch {
		/* sin sessionStorage (modo privado estricto): una conversación por montaje */
	}
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
	// `key` por producto y workspace: cambiar de workspace sin recargar (TanStack no
	// vuelve a montar la barra) monta una conversación nueva, con su propio id
	// guardado, en vez de abrir la del workspace anterior bajo el nuevo (un 403 sin
	// salida). `Suspense` porque `useAgentChat` suspende mientras llega el historial.
	return (
		<Suspense fallback={<NovaChatLoading {...props} />}>
			<NovaChatConversation key={conversationKey(props.product, props.workspaceId, props.scope)} {...props} />
		</Suspense>
	);
}

/** La hoja mientras llega el historial: el marco, el saludo y una fila pendiente. */
function NovaChatLoading({ open, onOpenChange, title = "Nova", description, greeting, placeholder, footnote, inputLabel }: NovaChatSheetProps) {
	return (
		<NovaSheetFrame
			open={open}
			onOpenChange={onOpenChange}
			title={title}
			description={description}
			busy
			scrollKey={null}
			composer={{ value: "", onChange: () => {}, onSubmit: () => {}, placeholder, label: inputLabel }}
			footnote={footnote}>
			<NovaMessageRow role="assistant" content={greeting} />
			<NovaMessageRow role="assistant" content="" pending />
		</NovaSheetFrame>
	);
}

function NovaChatConversation({
	open,
	onOpenChange,
	title = "Nova",
	description,
	greeting,
	suggestions,
	scopedSuggestion,
	placeholder,
	footnote,
	inputLabel,
	novaHost,
	workspaceId,
	product,
	place,
	scope,
	messageActions,
	initialUsage,
}: NovaChatSheetProps) {
	const key = conversationKey(product, workspaceId, scope);
	const [conversationId, setConversationId] = useState(() => storedConversation(key));
	const [draft, setDraft] = useState("");
	const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
	// Las aprobaciones ya contestadas desde esta hoja: un doble clic no manda dos.
	const [answered, setAnswered] = useState<ReadonlySet<string>>(() => new Set());
	// El saldo al abrir, si el producto no lo pasó: una sola vez por conversación montada.
	const [openingUsage, setOpeningUsage] = useState<NovaUsage | null>(null);
	useEffect(() => {
		if (initialUsage !== undefined) return;
		let alive = true;
		fetch(usageUrl(novaHost, workspaceId, product), { credentials: "include" })
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
	}, [initialUsage, novaHost, workspaceId, product]);

	const [sessionExpired, setSessionExpired] = useState(false);

	function startOver() {
		const id = crypto.randomUUID();
		try {
			sessionStorage.setItem(key, id);
		} catch {
			/* ver storedConversation */
		}
		setConversationId(id);
	}

	const agent = useAgent({ agent: "NovaChat", name: `${workspaceId}~${conversationId}`, host: novaHost });
	const { messages, sendMessage, status, error, regenerate, addToolApprovalResponse } = useAgentChat({
		agent,
		credentials: "include",
		body: () => ({ product, place: place ?? {}, timezone }),
		// El historial lo pide la hoja y no el SDK, que convierte cualquier fallo en
		// «sin mensajes»: con la sesión caducada se dice, y una conversación guardada
		// que es de otra persona u otro workspace se cambia por una nueva.
		getInitialMessages: async ({ url }) => {
			if (!url) return [];
			const target = new URL(url);
			target.pathname += "/get-messages";
			const res = await fetch(target.toString(), { credentials: "include" }).catch(() => null);
			const verdict = res ? classifyHistoryStatus(res.status) : "error";
			if (verdict === "expired") setSessionExpired(true);
			if (verdict === "foreign") startOver();
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
		<NovaSheetFrame
			open={open}
			onOpenChange={onOpenChange}
			title={title}
			description={description}
			headerAction={
				visible.length > 0 ? (
					<button type="button" className={`${textLinkClass} shrink-0 text-[0.875rem]`} onClick={startOver} disabled={busy}>
						<SquarePen className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
						New chat
					</button>
				) : null
			}
			busy={busy}
			scrollKey={messages}
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
			notice={usageText}>
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
						{done && messageActions ? messageActions({ role: "assistant", content: text }, () => onOpenChange(false)) : null}
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
							<button type="button" className={`${textLinkClass} text-[0.875rem]`} onClick={startOver}>
								<SquarePen className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
								New chat
							</button>
						</>
					)}
				</NovaMessageRow>
			)}

			{visible.length === 0 && !busy && (
				<div className="sm:pl-11">
					<NovaSuggestions suggestions={suggestions} scoped={scopedSuggestion} onPick={(p) => send(p)} disabled={busy} />
				</div>
			)}
		</NovaSheetFrame>
	);
}

/**
 * Nova central en la hoja (2026-10-07, fase 1). La misma hoja que `NovaSheet`
 * (mismo marco, mismas filas, mismo campo), pero la conversación ya no es de la
 * pestaña: vive en un Durable Object de nova.ondesk.cc (`NovaChat`), se guarda,
 * sobrevive a recargar y se puede borrar desde /account.
 *
 * El navegador abre un WebSocket con `useAgent` a `{workspaceId}~{conversación}`;
 * la cookie de sesión de .ondesk.cc viaja sola, y Nova sólo deja abrir una
 * conversación a quien la empezó. La conversación en curso se recuerda por
 * producto y workspace en sessionStorage; «New chat» empieza otra.
 *
 * No conecta nada hasta que alguien abre la hoja por primera vez: montada en la
 * barra de cada app, abrir un WebSocket por cada página vista sería pagar por
 * nada.
 */
import { useEffect, useMemo, useState } from "react";
import { RotateCcw, SquarePen } from "lucide-react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { NovaMessageRow, NovaSheetFrame, NovaSuggestions, novaErrorMessage, type NovaSheetProps } from "./nova";
import { textLinkClass } from "./console";
import { conversationKey, messageText, type NovaProduct } from "./nova-chat-parts";

export { messageText, conversationKey, type NovaProduct } from "./nova-chat-parts";

export interface NovaChatSheetProps extends Omit<NovaSheetProps, "stream" | "messageActions"> {
	/** `nova.ondesk.cc`, o `localhost:8787` en local: sin protocolo. */
	novaHost: string;
	workspaceId: string;
	product: NovaProduct;
	/** Lo que el usuario tiene abierto: `{ channel_id }`, `{ file_id }`, `{ ticket_id }`… */
	place?: Record<string, string>;
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
	return <NovaChatConversation {...props} />;
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
}: NovaChatSheetProps) {
	const key = conversationKey(product, workspaceId);
	const [conversationId, setConversationId] = useState(() => storedConversation(key));
	const [draft, setDraft] = useState("");
	const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

	const agent = useAgent({ agent: "NovaChat", name: `${workspaceId}~${conversationId}`, host: novaHost });
	const { messages, sendMessage, status, error, regenerate } = useAgentChat({
		agent,
		credentials: "include",
		body: () => ({ product, place: place ?? {}, timezone }),
	});

	const busy = status === "submitted" || status === "streaming";
	const visible = messages.filter((m) => m.role === "user" || m.role === "assistant");
	const last = visible[visible.length - 1];
	const waiting = status === "submitted" && last?.role !== "assistant";

	function send(text: string): boolean {
		const prompt = text.trim();
		if (!prompt || busy) return false;
		void sendMessage({ text: prompt });
		return true;
	}

	function startOver() {
		const id = crypto.randomUUID();
		try {
			sessionStorage.setItem(key, id);
		} catch {
			/* ver storedConversation */
		}
		setConversationId(id);
	}

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
			footnote={footnote}>
			<NovaMessageRow role="assistant" content={greeting} />

			{visible.map((message, i) => {
				const text = messageText(message);
				const streaming = busy && i === visible.length - 1 && message.role === "assistant";
				return (
					<NovaMessageRow
						key={message.id}
						role={message.role === "user" ? "user" : "assistant"}
						content={text}
						pending={streaming && text === ""}
					/>
				);
			})}

			{waiting && <NovaMessageRow role="assistant" content="" pending />}

			{error && !busy && (
				<NovaMessageRow role="assistant" content={novaErrorMessage(error)} failed>
					<button type="button" className={`${textLinkClass} text-[0.875rem]`} onClick={() => void regenerate()}>
						<RotateCcw className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
						Try again
					</button>
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

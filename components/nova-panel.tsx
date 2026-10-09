/**
 * El panel de Nova (2026-10-08). Spec: ondesk/docs/specs/2026-10-08-nova-dock.md § 2.
 *
 * Cabecera de 64px (la altura de la barra superior): el glifo, «Nova» y el
 * alcance; a la derecha «New chat», «Conversations» y cerrar, siempre los tres
 * en su sitio para que nada se mueva al cambiar de vista. Debajo, la
 * conversación en curso de este workspace (guardada en la cookie del dock, así
 * que es la misma en las seis apps y en la consola) o el historial, que la
 * reemplaza en el cuerpo y no flota encima de nada.
 *
 * La conversación sigue montada mientras se mira el historial: volver no
 * reconecta. La monta `NovaDockHost`: en escritorio vive en la columna y por
 * debajo de 1280px en la hoja; el contenido es el mismo.
 */
import { Suspense, useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { ArrowLeft, History, SquarePen, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { NovaGlyph, type NovaMessage, type NovaSuggestion } from "./nova";
import { NovaConversation, NovaConversationLoading } from "./nova-chat";
import type { NovaSurface } from "./nova-chat-parts";
import { useNovaDock } from "./nova-dock";
import { asConversationList, historyUrl, startedInText } from "./nova-dock-state";
import { NovaHistory, NovaHistoryError, NovaOriginMark } from "./nova-history";
import { TopbarButton } from "./topbar";

export interface NovaPanelProps {
	/** `nova.ondesk.cc`, o `127.0.0.1:8787` en local: sin protocolo. */
	novaHost: string;
	workspaceId: string;
	surface: NovaSurface;
	title?: string;
	/** El alcance, dicho: «Scoped to what you can read in Harbour & Pine.» */
	description: ReactNode;
	greeting: string;
	suggestions: NovaSuggestion[];
	scopedSuggestion?: NovaSuggestion;
	placeholder: string;
	footnote: ReactNode;
	inputLabel?: string;
	place?: Record<string, string>;
	messageActions?: (message: NovaMessage, close: () => void) => ReactNode;
	/** El origen de ondesk.cc («» dentro de la propia consola): el historial enlaza a `/account/nova`. */
	ondeskHref: string;
}

async function fetchHistory(novaHost: string, workspaceId: string) {
	const res = await fetch(historyUrl(novaHost, workspaceId), { credentials: "include" });
	if (!res.ok) throw new NovaHistoryError(res.status);
	return asConversationList(await res.json());
}

export function NovaPanel({
	novaHost,
	workspaceId,
	surface,
	title = "Nova",
	description,
	greeting,
	suggestions,
	scopedSuggestion,
	placeholder,
	footnote,
	inputLabel,
	place,
	messageActions,
	ondeskHref,
}: NovaPanelProps) {
	const dock = useNovaDock();
	const { startNew, setConversation, setOpen, clearAsk } = dock;
	const queryClient = useQueryClient();
	const [view, setView] = useState<"chat" | "history">("chat");
	const input = useRef<HTMLTextAreaElement | null>(null);
	const conversationId = dock.conversationOf(workspaceId);

	// Sin conversación guardada para este workspace: una nueva.
	useEffect(() => {
		if (!conversationId) startNew(workspaceId);
	}, [conversationId, workspaceId, startNew]);

	// Otro workspace: de vuelta a la conversación.
	useEffect(() => {
		setView("chat");
	}, [workspaceId]);

	const history = useQuery({
		queryKey: ["nova", "history", novaHost, workspaceId],
		queryFn: () => fetchHistory(novaHost, workspaceId),
		staleTime: 30_000,
		retry: false,
	});
	const refreshHistory = useCallback(() => {
		void queryClient.invalidateQueries({ queryKey: ["nova", "history", novaHost, workspaceId] });
	}, [queryClient, novaHost, workspaceId]);

	const origin = history.data?.find((c) => c.id === conversationId)?.product ?? null;
	const started = startedInText(origin, surface);
	const ask = dock.ask && dock.ask.workspaceId === workspaceId && dock.ask.conversationId === conversationId ? dock.ask : null;

	// Abrir a mano enfoca el campo, una sola vez (`takeFocus`): volver a montar el
	// panel (navegar en la consola, cruzar los 1280px) no le roba el foco a la
	// página. Con la conversación aún cargando no hay campo de verdad: el foco
	// espera a `onReady`. En un teléfono no se enfoca (el teclado taparía las
	// sugerencias), pero la petición se gasta igual.
	const { takeFocus } = dock;
	const focusIfAsked = useCallback(() => {
		if (!input.current) return;
		if (takeFocus() && window.matchMedia("(pointer: fine)").matches) input.current.focus();
	}, [takeFocus]);
	useEffect(() => {
		if (dock.focusSignal === 0) return;
		setView("chat");
		const frame = requestAnimationFrame(focusIfAsked);
		return () => cancelAnimationFrame(frame);
	}, [dock.focusSignal, focusIfAsked]);

	const startOver = () => {
		startNew(workspaceId);
		setView("chat");
	};
	const showHistory = () => {
		if (view === "history") {
			setView("chat");
			return;
		}
		setView("history");
		void history.refetch();
	};

	// Escape devuelve el foco a la página (al botón Nova) sin cerrar el panel.
	const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
		if (e.key !== "Escape" || e.nativeEvent.isComposing || !dock.isDesktop) return;
		e.preventDefault();
		dock.buttonRef.current?.focus();
	};

	const loadingProps = { greeting, placeholder, footnote, inputLabel };

	return (
		<div className="flex h-full min-h-0 flex-1 flex-col" onKeyDown={onKeyDown}>
			<div className="flex h-16 shrink-0 items-center gap-3 border-b border-(--sk-hair) pl-5 pr-3">
				{view === "history" ? (
					<button
						type="button"
						onClick={() => setView("chat")}
						className="-ml-2 inline-flex h-9 min-w-0 items-center gap-1.5 rounded-full px-2 text-[0.9375rem] font-semibold text-(--sk-ink) transition-colors duration-150 hover:bg-[rgba(14,27,46,0.05)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--sk-accent)">
						<ArrowLeft className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
						Conversations
					</button>
				) : (
					<>
						<NovaGlyph />
						<div className="min-w-0 flex-1">
							<h2 className="text-[0.9375rem] font-semibold leading-tight text-(--sk-ink)">{title}</h2>
							<p className="sk-small truncate leading-snug">{description}</p>
						</div>
					</>
				)}
				<div className="ml-auto flex shrink-0 items-center gap-0.5">
					<TopbarButton aria-label="New chat" title="New chat" onClick={startOver}>
						<SquarePen className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
					</TopbarButton>
					<TopbarButton
						aria-label="Conversations"
						title="Conversations"
						aria-pressed={view === "history"}
						className="aria-pressed:bg-[rgba(14,27,46,0.06)] aria-pressed:text-(--sk-ink)"
						onClick={showHistory}>
						<History className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
					</TopbarButton>
					<TopbarButton aria-label="Close Nova" title="Close" onClick={() => setOpen(false)}>
						<X className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
					</TopbarButton>
				</div>
			</div>

			{view === "history" && (
				<NovaHistory
					status={history.status}
					items={history.data ?? []}
					error={history.error}
					currentId={conversationId}
					onPick={(id) => {
						setConversation(workspaceId, id);
						setView("chat");
					}}
					onRetry={() => void history.refetch()}
					onAsk={() => {
						setView("chat");
						requestAnimationFrame(() => input.current?.focus());
					}}
					accountHref={`${ondeskHref}/account/nova`}
				/>
			)}

			{/* Sigue montada con el historial delante: volver no reconecta. */}
			<div hidden={view === "history"} className="flex min-h-0 flex-1 flex-col">
				{conversationId ? (
					<Suspense fallback={<NovaConversationLoading {...loadingProps} />}>
						<NovaConversation
							key={conversationId}
							conversationId={conversationId}
							onStartOver={startOver}
							novaHost={novaHost}
							workspaceId={workspaceId}
							surface={surface}
							place={place}
							greeting={greeting}
							suggestions={suggestions}
							scopedSuggestion={scopedSuggestion}
							placeholder={placeholder}
							footnote={footnote}
							inputLabel={inputLabel}
							messageActions={messageActions}
							onClose={() => setOpen(false)}
							ask={ask}
							onAskSent={clearAsk}
							lead={
								started ? (
									<p className="sk-small flex items-center gap-2">
										<NovaOriginMark product={origin} />
										{started}
									</p>
								) : undefined
							}
							onTurnEnd={refreshHistory}
							inputRef={input}
							revealKey={`${view}:${dock.attachCount}`}
							onReady={focusIfAsked}
						/>
					</Suspense>
				) : (
					<NovaConversationLoading {...loadingProps} />
				)}
			</div>
		</div>
	);
}

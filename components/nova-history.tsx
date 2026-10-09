/**
 * El historial del panel de Nova (2026-10-08): las conversaciones de esta
 * persona en este workspace, de cualquier app o de la consola, por día. Pulsar
 * una la abre en el panel, con las herramientas de donde estás ahora. Borrar
 * está en ondesk.cc/account/nova (purga los mensajes y no se deshace).
 *
 *   NovaHistory     la lista y sus estados: cargando (tres filas con la forma de
 *                   una real), vacío, fallo y la lista agrupada.
 *   NovaOriginMark  la baldosa de la app donde empezó, o la marca de OnDesk si
 *                   fue en la consola.
 */
import { RotateCcw } from "lucide-react";
import { isProductId } from "../lib/lines";
import { LinkArrow, textLinkClass } from "./console";
import { novaErrorMessage } from "./nova";
import { groupConversations, historyTime, type NovaConversationSummary } from "./nova-dock-state";
import { AppTile, Mark } from "./sky";

/** Un fallo de `GET /api/me/conversations` con su código, para decir cuál fue. */
export class NovaHistoryError extends Error {
	readonly status: number;
	constructor(status: number) {
		super(`Nova answered ${status}`);
		this.status = status;
	}
}

export function NovaOriginMark({ product }: { product: string | null }) {
	if (product === "console") return <Mark className="size-[22px] shrink-0" />;
	if (product && isProductId(product)) return <AppTile id={product} size="xs" />;
	return <span className="size-[22px] shrink-0" aria-hidden="true" />;
}

function failureText(error: unknown): string {
	if (error instanceof NovaHistoryError) {
		return error.status === 401 ? "Your session expired. Reload the page to keep talking to Nova." : "Couldn't load your conversations. Try again.";
	}
	return novaErrorMessage(error);
}

export function NovaHistory({
	status,
	items,
	error,
	currentId,
	onPick,
	onRetry,
	onAsk,
	accountHref,
}: {
	status: "pending" | "error" | "success";
	items: NovaConversationSummary[];
	error: unknown;
	currentId: string | null;
	onPick: (id: string) => void;
	onRetry: () => void;
	/** El vacío: volver a la conversación y enfocar el campo. */
	onAsk: () => void;
	/** `{ondesk}/account/nova`. */
	accountHref: string;
}) {
	if (status === "pending") {
		return (
			<div className="flex flex-col gap-0.5 px-3 py-3" aria-busy="true" aria-label="Loading conversations">
				{[0, 1, 2].map((i) => (
					<div key={i} className="flex h-10 items-center gap-3 px-3">
						<span className="size-[22px] shrink-0 rounded-[6px] bg-(--sk-mist)" />
						<span className="h-3 flex-1 rounded-full bg-(--sk-mist)" style={{ maxWidth: `${70 - i * 12}%` }} />
						<span className="h-3 w-10 rounded-full bg-(--sk-mist)" />
					</div>
				))}
			</div>
		);
	}

	if (status === "error") {
		return (
			<div className="flex flex-col items-start gap-2 px-6 py-6">
				<p className="text-[0.9375rem] leading-relaxed text-(--sk-ink-2)">{failureText(error)}</p>
				{!(error instanceof NovaHistoryError && error.status === 401) && (
					<button type="button" className={`${textLinkClass} text-[0.875rem]`} onClick={onRetry}>
						<RotateCcw className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
						Try again
					</button>
				)}
			</div>
		);
	}

	if (items.length === 0) {
		return (
			<div className="flex flex-col items-start gap-3 px-6 py-6">
				<p className="text-[0.9375rem] leading-relaxed text-(--sk-ink-2)">No conversations in this workspace yet.</p>
				<button
					type="button"
					className="inline-flex h-9 items-center rounded-full px-4 text-[0.875rem] font-medium text-(--sk-ink) shadow-[inset_0_0_0_1px_var(--sk-hair-2)] transition-colors duration-150 hover:bg-(--sk-ground) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--sk-accent)"
					onClick={onAsk}>
					Ask Nova
				</button>
			</div>
		);
	}

	const now = new Date();
	return (
		<div className="sk-nova-log flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 pb-4 pt-2">
			{groupConversations(items, now).map((group) => (
				<section key={group.label} aria-label={group.label}>
					<h3 className="sk-small px-3 pb-1.5 pt-3 font-medium">{group.label}</h3>
					<ul className="flex flex-col gap-0.5">
						{group.items.map((c) => {
							const current = c.id === currentId;
							return (
								<li key={c.id}>
									<button
										type="button"
										onClick={() => onPick(c.id)}
										aria-current={current ? "true" : undefined}
										title={c.title ?? undefined}
										className={`flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[0.875rem] transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--sk-accent) ${
											current ? "bg-(--sk-ground) font-medium text-(--sk-ink)" : "text-(--sk-ink-2) hover:bg-(--sk-ground) hover:text-(--sk-ink)"
										}`}>
										<NovaOriginMark product={c.product} />
										<span className="min-w-0 flex-1 truncate">{c.title ?? "Untitled"}</span>
										<span className="shrink-0 text-[0.8125rem] tabular-nums text-(--sk-ink-3)">{historyTime(c.updated_at, now)}</span>
									</button>
								</li>
							);
						})}
					</ul>
				</section>
			))}
			<p className="px-3 pt-5">
				<a href={accountHref} className={`${textLinkClass} text-[0.875rem]`}>
					See all in your account
					<LinkArrow />
				</a>
			</p>
		</div>
	);
}

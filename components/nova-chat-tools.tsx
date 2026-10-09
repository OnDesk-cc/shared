/**
 * Las llamadas a herramientas en la hoja de Nova (fase 2, 2026-10-08). Spec:
 * ondesk/docs/specs/2026-10-07-nova-central.md § 2c «La tarjeta».
 *
 *   NovaToolCards   lo que va encima del texto de una respuesta: una línea
 *                   discreta por lectura en curso («Checking Orbit…») y una
 *                   tarjeta por acción
 *   NovaActionCard  la tarjeta de aprobación: el producto, la frase y los campos
 *                   del `preview`, con Approve · Cancel. Una destructiva va en
 *                   rojo, con su verbo en el botón («Delete task»). Después
 *                   queda como Done (con su enlace), Cancelled, Not done o Not
 *                   approved
 *
 * Qué se pinta lo decide `toolCards` (nova-chat-parts.ts) con los estados de las
 * partes del AI SDK; aquí sólo se dibuja. El texto del `preview` lo escribe el
 * producto y va como texto de React, nunca como HTML. Contestar dos veces no
 * hace nada: la hoja desactiva los botones al primer clic y Nova ejecuta cada
 * aprobación una sola vez (nova/src/actions.ts).
 */
import { Fragment } from "react";
import { CircleAlert } from "lucide-react";
import { Button } from "../ui/button";
import { LinkArrow, textLinkClass } from "./console";
import { Tag } from "./tag";
import { actionVerb, NOVA_PRODUCT_NAMES, type NovaToolCard } from "./nova-chat-parts";

type ActionCard = Extract<NovaToolCard, { kind: "action" }>;
type Answer = (approvalId: string, approved: boolean) => void;

export function NovaToolCards({ cards, answered, disabled, onAnswer }: { cards: NovaToolCard[]; answered: ReadonlySet<string>; disabled: boolean; onAnswer: Answer }) {
	return (
		<div className="flex flex-col gap-2.5">
			{cards.map((card) =>
				card.kind === "running" ? (
					<p key={card.toolCallId} className="sk-nova-writing text-[0.875rem] leading-snug">
						{card.label}
					</p>
				) : (
					<NovaActionCard
						key={card.toolCallId}
						card={card}
						disabled={disabled || (card.approvalId !== null && answered.has(card.approvalId))}
						onAnswer={onAnswer}
					/>
				),
			)}
		</div>
	);
}

const STATUS_TAG = {
	done: { tone: "success", label: "Done" },
	cancelled: { tone: "neutral", label: "Cancelled" },
	failed: { tone: "danger", label: "Not done" },
	expired: { tone: "neutral", label: "Not approved" },
} as const;

export function NovaActionCard({ card, disabled, onAnswer }: { card: ActionCard; disabled: boolean; onAnswer: Answer }) {
	const productName = card.product ? NOVA_PRODUCT_NAMES[card.product] : "OnDesk";
	const verb = actionVerb(card.tool);
	const summary = card.preview?.summary || `${verb} in ${productName}`;
	const fields = card.preview?.fields ?? [];
	const approvalId = card.status === "awaiting" ? card.approvalId : null;
	const tag = card.status === "done" || card.status === "cancelled" || card.status === "failed" || card.status === "expired" ? STATUS_TAG[card.status] : null;
	const ring = approvalId && card.destructive ? "shadow-[inset_0_0_0_1px_#e3aaa4]" : "shadow-[inset_0_0_0_1px_var(--sk-hair)]";
	const quiet = card.status === "cancelled" || card.status === "expired";

	return (
		<section aria-label={`${verb} in ${productName}`} className={`sk-nova-card max-w-[62ch] rounded-[16px] bg-(--sk-surface) p-4 ${ring} ${quiet ? "opacity-75" : ""}`}>
			<div className="flex flex-wrap items-center gap-1.5">
				<Tag>{productName}</Tag>
				{tag && <Tag tone={tag.tone}>{tag.label}</Tag>}
			</div>
			<p className="mt-2.5 text-[0.9375rem] font-medium leading-snug text-(--sk-ink) [overflow-wrap:anywhere]">{summary}</p>
			{fields.length > 0 && (
				<dl className="mt-2 grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-3 gap-y-1 text-[0.875rem] leading-snug">
					{fields.map((field, i) => (
						<Fragment key={`${i}:${field.label}`}>
							<dt className="text-(--sk-ink-3) [overflow-wrap:anywhere]">{field.label}</dt>
							<dd className="whitespace-pre-wrap text-(--sk-ink) [overflow-wrap:anywhere]">{field.value}</dd>
						</Fragment>
					))}
				</dl>
			)}

			{approvalId && (
				<div className="mt-3.5 flex flex-wrap gap-2">
					<Button size="sm" variant={card.destructive ? "destructive" : "default"} disabled={disabled} onClick={() => onAnswer(approvalId, true)}>
						{card.destructive ? verb : "Approve"}
					</Button>
					<Button size="sm" variant="outline" disabled={disabled} onClick={() => onAnswer(approvalId, false)}>
						Cancel
					</Button>
				</div>
			)}
			{card.status === "approving" && <p className="sk-nova-writing mt-3 text-[0.875rem]">Working…</p>}
			{card.status === "done" && card.link && (
				<a href={card.link} className={`${textLinkClass} mt-3 text-[0.875rem]`}>
					Open in {productName}
					<LinkArrow />
				</a>
			)}
			{card.status === "failed" && card.error && (
				<p className="mt-2.5 flex items-start gap-1.5 text-[0.875rem] leading-snug text-[#a1221a]">
					<CircleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
					{card.error}
				</p>
			)}
		</section>
	);
}

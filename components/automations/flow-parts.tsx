/**
 * Las piezas pequeñas de las automatizaciones (2026-10-21):
 *
 *   FlowRoute     la ruta de una automatización como baldosas: la app donde
 *                 empieza, una flecha y las apps donde actúa. Es la firma de la
 *                 fila y el único sitio donde aparece el color de una app (la
 *                 regla «la baldosa lleva el color»)
 *   StatusTag     Active / Paused con su tono; el porqué va en el texto de la
 *                 fila, nunca sólo en el color
 *   OutcomeTag    el resultado de una ejecución
 *   BackLink      «← Automations», para salir del editor
 */
import { ArrowLeft, ArrowRight } from "lucide-react";
import { AppTile } from "../sky";
import { Tag } from "../tag";
import { flowProducts, outcomeLine, PRODUCT_LABELS, statusLine, type AutomationProduct, type Catalog, type FlowOutcome, type FlowStatus, type PausedReason } from "./automations-model";

export function FlowRoute({ catalog, flow, size = "sm" }: { catalog: Catalog; flow: { trigger_product: AutomationProduct; steps: { tool: string }[] }; size?: "sm" | "xs" }) {
	const { from, to } = flowProducts(catalog, flow);
	const names = `${PRODUCT_LABELS[from]} to ${to.map((p) => PRODUCT_LABELS[p]).join(" and ") || "nothing yet"}`;
	return (
		<span className="inline-flex shrink-0 items-center gap-1.5" role="img" aria-label={names}>
			<AppTile id={from} size={size} />
			<ArrowRight className="size-3.5 text-(--sk-ink-3)" strokeWidth={1.75} aria-hidden="true" />
			<span className="inline-flex items-center -space-x-1">
				{to.map((p) => (
					<AppTile key={p} id={p} size={size} className="ring-2 ring-(--sk-surface)" />
				))}
			</span>
		</span>
	);
}

export function StatusTag({ flow }: { flow: { status: FlowStatus; paused_reason: PausedReason | null } }) {
	const line = statusLine(flow);
	return <Tag tone={line.tone}>{line.label}</Tag>;
}

export function OutcomeTag({ outcome }: { outcome: FlowOutcome | "running" }) {
	const line = outcomeLine(outcome);
	return <Tag tone={line.tone}>{line.label}</Tag>;
}

export function BackLink({ onClick, children = "Automations" }: { onClick: () => void; children?: string }) {
	return (
		<button type="button" onClick={onClick} className="ticket ticket--sm ticket--ghost self-start">
			<ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
			{children}
		</button>
	);
}

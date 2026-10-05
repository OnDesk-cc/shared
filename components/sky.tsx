/**
 * La marca y la baldosa de app del mundo «Clear Sky», para los seis productos.
 *
 * Copia para `shared` de `ondesk/src/features/frontend/sky/kit.tsx` (Mark y
 * AppTile) sin catálogo ni i18n: los nombres y los glifos de las apps son fijos.
 * El color de cada baldosa lo lee el CSS de `--sk-{id}` en `styles/sky.css`; el
 * color de una app sólo vive en su baldosa.
 */
import { useId } from "react";
import { FolderTree, KeyRound, MessagesSquare, SquareKanban, Ticket, Video, type LucideIcon } from "lucide-react";
import type { ProductId } from "../lib/lines";

/** El glifo de cada app: el mismo de su baldosa en ondesk.cc y de su icono de marca. */
export const APP_ICON: Record<ProductId, LucideIcon> = {
	pulse: Ticket,
	vault: KeyRound,
	orbit: SquareKanban,
	nexus: MessagesSquare,
	halo: Video,
	atlas: FolderTree,
};

/** La variable CSS del color de una app, para `--tile`. */
export function appVar(id: ProductId): string {
	return `var(--sk-${id})`;
}

/** La marca de OnDesk: un planeta y su luna. Geometría pura, la misma de ondesk.cc. */
export function Mark({ className = "size-6" }: { className?: string }) {
	// useId trae caracteres que una referencia url(#…) de SVG no admite.
	const id = `mk${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
	return (
		<svg viewBox="0 0 28 28" className={className} aria-hidden="true">
			<defs>
				<radialGradient id={`${id}-p`} cx="0.36" cy="0.32" r="0.8">
					<stop offset="0" stopColor="#9cc3ff" />
					<stop offset="0.55" stopColor="#3f7cec" />
					<stop offset="1" stopColor="#1f4fb6" />
				</radialGradient>
				<mask id={`${id}-m`}>
					<rect width="28" height="28" fill="#fff" />
					<circle cx="22" cy="7" r="5.4" fill="#000" />
				</mask>
			</defs>
			<circle cx="12" cy="15" r="10" fill={`url(#${id}-p)`} mask={`url(#${id}-m)`} />
			<circle cx="22" cy="7" r="3.6" fill="#1f4fb6" />
		</svg>
	);
}

/** La baldosa de una app: su glifo en su color, sobre su tinte. */
export function AppTile({ id, size = "md", className = "" }: { id: ProductId; size?: "lg" | "md" | "sm" | "xs"; className?: string }) {
	const Icon = APP_ICON[id];
	const icon = size === "lg" ? "size-[22px]" : size === "md" ? "size-[18px]" : size === "sm" ? "size-[14px]" : "size-3";
	return (
		<span
			className={`sk-tile ${size === "lg" ? "sk-tile--lg" : size === "sm" ? "sk-tile--sm" : size === "xs" ? "sk-tile--xs" : ""} ${className}`}
			style={{ "--tile": appVar(id) } as React.CSSProperties}
			aria-hidden="true">
			<Icon className={icon} strokeWidth={1.75} />
		</span>
	);
}

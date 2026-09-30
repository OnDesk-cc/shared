/**
 * La presencia como anillo del intercambiador, con el mismo significado en las
 * siete apps que la pintan: relleno es Online, con punto Busy, vacío Away, y
 * apagado al 45 % Offline o Invisible. El color del mapa es de las líneas; el
 * estado es la forma del anillo y la palabra que lo acompaña (`title`, o el
 * texto que quien lo usa pone al lado).
 *
 * Conserva la API del punto de color que sustituye (`PresenceDot`, `size`,
 * `ring`) para que las seis apps sigan compilando; `ring` dibuja el borde de
 * papel que lo separa de la cara sobre la que va clavado.
 */
import { cn } from "../lib/utils";
import { STATUS_META, type EffectiveStatus, type PresenceStatus } from "./status";

const sizeStyles = {
	xs: "0.6rem",
	sm: "0.75rem",
	md: "0.85rem",
};

interface PresenceDotProps {
	status: EffectiveStatus | PresenceStatus;
	size?: keyof typeof sizeStyles;
	/** Dibuja el borde de papel que lo separa de aquello sobre lo que va clavado. */
	ring?: boolean;
	className?: string;
}

export function PresenceDot({ status, size = "sm", ring = false, className }: PresenceDotProps) {
	const meta = STATUS_META[status];
	return (
		<span
			aria-hidden
			title={meta.label}
			className={cn("presence-ring", meta.dot, ring && "outline-2 outline-(--paper)", className)}
			style={{ width: sizeStyles[size], height: sizeStyles[size] }}
		/>
	);
}

/** El anillo con su palabra al lado, para donde hay sitio; si no, la palabra va para el lector de pantalla. */
export function PresenceRing({
	status,
	label,
	showLabel = false,
	className = "",
}: {
	status: EffectiveStatus | PresenceStatus;
	/** La palabra entera cuando la hay («Busy · In meeting»); si no, la del estado. */
	label?: string;
	showLabel?: boolean;
	className?: string;
}) {
	const word = label ?? STATUS_META[status].label;
	return (
		<span className={`inline-flex items-center gap-2 ${className}`}>
			<PresenceDot status={status} size="md" />
			{showLabel ? <span>{word}</span> : <span className="sr-only">{word}</span>}
		</span>
	);
}

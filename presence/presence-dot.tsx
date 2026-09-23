/**
 * `PresenceDot`: el punto de color que dice el estado de alguien, con el mismo
 * significado en las siete apps que lo pintan.
 *
 * Va aquí y no en cada producto para que un color signifique lo mismo en todas
 * partes; el vocabulario de estados vive al lado, en `status.ts`.
 */
import { cn } from "../lib/utils";
import { STATUS_META, type EffectiveStatus, type PresenceStatus } from "./status";

const sizeStyles = {
	xs: "size-1.5",
	sm: "size-2",
	md: "size-2.5",
};

interface PresenceDotProps {
	status: EffectiveStatus | PresenceStatus;
	size?: keyof typeof sizeStyles;
	/** Dibuja el aro que lo separa de aquello sobre lo que va clavado. */
	ring?: boolean;
	className?: string;
}

/**
 * Un punto, un significado, en toda la plataforma.
 *
 * `title` en lugar de una primitiva de tooltip para que funcione en los sitios
 * donde estos acaban — dentro de un elemento de menú, sobre un avatar en una
 * lista densa — sin que cada uno tenga que montar un provider.
 */
export function PresenceDot({ status, size = "sm", ring = false, className }: PresenceDotProps) {
	const meta = STATUS_META[status];
	return (
		<span
			aria-hidden
			title={meta.label}
			className={cn(
				"inline-block shrink-0 rounded-full",
				sizeStyles[size],
				meta.dot,
				ring && "ring-2 ring-background",
				className,
			)}
		/>
	);
}

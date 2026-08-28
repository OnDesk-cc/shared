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
	/** Draws the ring that separates it from whatever it is pinned to. */
	ring?: boolean;
	className?: string;
}

/**
 * One dot, one meaning, everywhere on the platform.
 *
 * `title` rather than a tooltip primitive so it works in the places these end up
 * — inside a menu item, on an avatar in a dense list — without each of them
 * having to mount a provider.
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

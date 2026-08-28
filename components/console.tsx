/**
 * Console primitives — hard corners, hairline grids, mono telemetry labels,
 * lime scan-lines. The shared dashboard language of Halo, Nexus, Orbit, Pulse
 * and Vault; the marketing counterpart it used to point at lives in ondesk now.
 *
 * Use these instead of ad-hoc Card headers so every dashboard page reads
 * as the same instrument panel.
 */
import type { ReactNode, ElementType } from "react";

/** Mono telemetry micro-label, e.g. `02 — TICKETS`. */
export function ConsoleTag({ children, className = "" }: { children: ReactNode; className?: string }) {
	return <span className={`console-label ${className}`}>{children}</span>;
}

/**
 * Standard dashboard page header: mono eyebrow with blinking cursor,
 * heavy tracked-tight title, optional description and actions, closed
 * by a hairline rule.
 */
export function PageHeader({
	tag,
	title,
	description,
	actions,
}: {
	/** Mono eyebrow, e.g. "TICKETS" or "02 — ANALYTICS" */
	tag: string;
	title: ReactNode;
	description?: string;
	actions?: ReactNode;
}) {
	return (
		<div className="border-b border-border pb-4">
			<div className="flex items-center gap-2 mb-1.5">
				<span className="size-1.5 rounded-full bg-accent dot-live text-accent" />
				<ConsoleTag className="text-primary dark:text-accent">
					{tag}
					<span className="blink-cursor text-accent">_</span>
				</ConsoleTag>
			</div>
			<div className="flex items-end justify-between gap-4 flex-wrap">
				<div>
					<h1 className="text-2xl font-black tracking-tight text-balance">{title}</h1>
					{description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
				</div>
				{actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
			</div>
		</div>
	);
}

/**
 * Hairline stat grid — tiles separated by 1px border lines, editorial style.
 * Wrap StatTile children. Columns via className, e.g. "sm:grid-cols-2 lg:grid-cols-4".
 */
export function StatGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
	return <div className={`grid gap-px border border-border bg-border ${className}`}>{children}</div>;
}

/** One cell of a StatGrid: mono label, big tabular number, optional delta/hint. */
export function StatTile({
	label,
	value,
	hint,
	icon: Icon,
	tone = "default",
}: {
	label: string;
	value: ReactNode;
	hint?: ReactNode;
	icon?: ElementType;
	tone?: "default" | "accent" | "warning" | "destructive";
}) {
	const valueTone =
		tone === "accent"
			? "text-accent"
			: tone === "warning"
				? "text-warning"
				: tone === "destructive"
					? "text-destructive"
					: "text-foreground";
	return (
		<div className="group relative bg-card p-4">
			<div className="flex items-center justify-between gap-2">
				<ConsoleTag>{label}</ConsoleTag>
				{Icon && <Icon className="size-3.5 text-muted-foreground/60" />}
			</div>
			<div className={`mt-2 text-3xl font-black tracking-tight tabular-nums ${valueTone}`}>{value}</div>
			{hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>}
			<span className="scan-line" />
		</div>
	);
}

/** Hairline panel header row: mono label left, optional meta right. */
export function PanelHeader({ label, right, className = "" }: { label: string; right?: ReactNode; className?: string }) {
	return (
		<div className={`flex items-center justify-between border-b border-border px-4 py-2.5 ${className}`}>
			<ConsoleTag className="text-primary dark:text-accent">{label}</ConsoleTag>
			{right && <div className="flex items-center gap-2">{right}</div>}
		</div>
	);
}

/**
 * Squared empty state with mono caption.
 *
 * The icon is optional. An empty state inside a panel that already carries a
 * labelled header is one glyph explaining what the header just said, and a column
 * of those down a page reads as decoration rather than as meaning. Pass one where
 * the empty state IS the page.
 */
export function EmptyState({
	icon: Icon,
	title,
	description,
	action,
	className = "",
}: {
	icon?: ElementType;
	title: string;
	description?: string;
	action?: ReactNode;
	className?: string;
}) {
	return (
		<div className={`flex flex-col items-center justify-center gap-2 py-10 text-center ${className}`}>
			{Icon && (
				<div className="flex size-10 items-center justify-center border border-border bg-secondary/60 mb-1">
					<Icon className="size-4.5 text-muted-foreground" />
				</div>
			)}
			<p className="font-mono text-xs uppercase tracking-[0.12em] font-semibold">{title}</p>
			{description && <p className="text-xs text-muted-foreground max-w-xs">{description}</p>}
			{action && <div className="mt-2">{action}</div>}
		</div>
	);
}

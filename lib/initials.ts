/**
 * Two letters standing in for somebody who has no avatar yet.
 *
 * Falls through name → email → "?", and splits on dots and the @ as well as on
 * spaces, because plenty of accounts are `ana.perez@…` with a name field nobody
 * filled in — and "AN" from an email beats "?" from an empty name.
 *
 * A copy of OnDesk's `initialsOf`, deliberately: nothing is shared between these
 * repositories.
 */
export function initialsOf(name: string | undefined | null, email?: string | undefined | null): string {
	const source = (name ?? "").trim() || email || "?";
	return source
		.split(/[\s@.]+/)
		.filter(Boolean)
		.map((word) => word[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
}

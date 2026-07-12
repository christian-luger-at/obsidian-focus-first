/**
 * Calendar-date helpers that are free of timezone and DST pitfalls (issues #25,
 * #26). Task dates are written as plain `YYYY-MM-DD` calendar days with no time
 * or zone, so they must be parsed and compared as calendar days — not through
 * `new Date("YYYY-MM-DD")` (which is parsed as UTC midnight and then drifts a day
 * when compared against local midnight) nor by subtracting local `Date` instances
 * (whose day length is 23/25 h across a DST change).
 */

/** Parses `YYYY-MM-DD` into a local-midnight Date. Returns undefined if malformed. */
export function parseIsoDate(iso: string): Date | undefined {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
	if (!m) return undefined;
	return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * Whole calendar days from `from` to `to` (`to - from`), using each date's local
 * calendar day. Computed via `Date.UTC`, which has no offset or DST, so the
 * result is always an exact integer number of days.
 */
export function daysBetween(from: Date, to: Date): number {
	const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
	const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
	return Math.round((b - a) / 86_400_000);
}

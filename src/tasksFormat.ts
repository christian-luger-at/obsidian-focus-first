/**
 * Reorders the emoji metadata on a Tasks-plugin task line into the canonical
 * order the Tasks plugin itself renders — description (with tags) first, then
 * priority, recurrence, and the dates. Our `show-focus` renderer emits the raw
 * line through the Markdown renderer, which keeps the metadata wherever the user
 * happened to type it; normalizing it here makes the output match a native
 * ```tasks``` query.
 */

// Priority signifiers, highest to lowest.
const PRIORITY_RE = /[🔺⏫🔼🔽⏬]/u;
// Date signifiers with their ISO value: created, start, scheduled, due, cancelled, done.
const DATE_RE = /([➕🛫⏳📅❌✅])\s*(\d{4}-\d{2}-\d{2})/gu;
// Recurrence rule: 🔁 followed by its text, up to the next signifier or a tag.
const RECURRENCE_RE = /🔁\s*([^🔺⏫🔼🔽⏬➕🛫⏳📅❌✅🔁#]+)/u;
// Canonical output order of the date signifiers.
const DATE_ORDER = ['➕', '🛫', '⏳', '📅', '❌', '✅'];

/**
 * Canonicalizes a single task line. Returns the line with its checkbox preserved
 * and its metadata reordered. Non-task lines are returned unchanged.
 */
export function canonicalizeTaskLine(line: string): string {
	const match = /^(\s*)[-*+]\s+\[(.)\]\s*(.*)$/.exec(line);
	if (!match) return line;

	const status = match[2] ?? ' ';
	let body = match[3] ?? '';

	let priority = '';
	const dates: Record<string, string> = {};
	let recurrence = '';

	const priorityMatch = PRIORITY_RE.exec(body);
	if (priorityMatch) {
		priority = priorityMatch[0];
		body = body.replace(priorityMatch[0], '');
	}

	body = body.replace(DATE_RE, (_full, signifier: string, date: string) => {
		dates[signifier] = `${signifier} ${date}`;
		return '';
	});

	const recurrenceMatch = RECURRENCE_RE.exec(body);
	if (recurrenceMatch?.[1]) {
		recurrence = `🔁 ${recurrenceMatch[1].trim()}`;
		body = body.replace(recurrenceMatch[0], '');
	}

	// The description keeps its tags; only collapse the gaps left by removals.
	const description = body.replace(/\s{2,}/g, ' ').trim();

	const parts = [description];
	if (priority) parts.push(priority);
	if (recurrence) parts.push(recurrence);
	for (const signifier of DATE_ORDER) {
		if (dates[signifier]) parts.push(dates[signifier]);
	}

	return `- [${status}] ${parts.filter(Boolean).join(' ')}`;
}

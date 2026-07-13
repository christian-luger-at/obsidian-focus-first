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

// Matches a task line, splitting off its `- [ ] ` prefix (with indentation) from
// the body, so edits can rewrite the body while preserving indentation exactly.
const TASK_LINE_RE = /^(\s*[-*+]\s+\[.\]\s*)(.*)$/u;
// A due date token and its ISO value.
const DUE_RE = /📅\s*(\d{4}-\d{2}-\d{2})/u;
const START_RE = /🛫\s*(\d{4}-\d{2}-\d{2})/u;
// The first metadata signifier a priority sorts before (recurrence or any date).
const FIRST_META_RE = /🔁|[➕🛫⏳📅❌✅]/u;

/** Adds `days` to an ISO date (YYYY-MM-DD), returning the shifted ISO date. */
export function addDaysToIso(iso: string, days: number): string {
	const [y, m, d] = iso.split('-').map(Number);
	const date = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
	date.setDate(date.getDate() + days);
	const yy = date.getFullYear();
	const mm = String(date.getMonth() + 1).padStart(2, '0');
	const dd = String(date.getDate()).padStart(2, '0');
	return `${yy}-${mm}-${dd}`;
}

/**
 * Sets the due date (📅) on a task line to `iso`, replacing an existing due date
 * or appending one. Indentation and all other tokens are preserved. Non-task
 * lines are returned unchanged.
 */
export function setDueDate(line: string, iso: string): string {
	if (!TASK_LINE_RE.test(line)) return line;
	if (DUE_RE.test(line)) {
		return line.replace(DUE_RE, `📅 ${iso}`);
	}
	return `${line.replace(/[ \t]+$/, '')} 📅 ${iso}`;
}

/**
 * Sets the start date (🛫) on a task line to `iso`, replacing an existing start
 * date or appending one. Used by "hide until" to give a hidden task a return
 * date. Indentation and other tokens are preserved; non-task lines are unchanged.
 */
export function setStartDate(line: string, iso: string): string {
	if (!TASK_LINE_RE.test(line)) return line;
	if (START_RE.test(line)) {
		return line.replace(START_RE, `🛫 ${iso}`);
	}
	return `${line.replace(/[ \t]+$/, '')} 🛫 ${iso}`;
}

/**
 * Shifts an existing due date (📅) by `days`. If the line has no due date it is
 * returned unchanged (callers use setDueDate for the "no date yet" case).
 */
export function shiftDueDate(line: string, days: number): string {
	const match = DUE_RE.exec(line);
	if (!match?.[1]) return line;
	return line.replace(DUE_RE, `📅 ${addDaysToIso(match[1], days)}`);
}

/**
 * Sets (or clears, when `tag` is null) a task's size tag on a line: every
 * configured size tag is removed first, then the chosen one is appended — so a
 * task never carries more than one size. Matching is case-insensitive;
 * indentation and other tokens are preserved. Non-task lines pass through.
 */
export function setSize(line: string, tag: string | null, allSizeTags: string[]): string {
	if (!TASK_LINE_RE.test(line)) return line;
	let out = line;
	for (const existing of allSizeTags) {
		if (!existing) continue;
		const escaped = existing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		out = out.replace(new RegExp(`\\s*${escaped}(?=\\s|$)`, 'gi'), '');
	}
	if (tag) {
		const has = out.split(/\s+/).some((token) => token.toLowerCase() === tag.toLowerCase());
		if (!has) out = `${out.replace(/[ \t]+$/, '')} ${tag}`;
	}
	return out;
}

/**
 * Sets (or clears, when `priority` is null) the priority signifier on a task
 * line. Any existing priority is removed first; a new one is inserted in
 * canonical position (before recurrence and dates). Indentation and other tokens
 * are preserved. Non-task lines are returned unchanged.
 */
export function setPriority(line: string, priority: string | null): string {
	const match = TASK_LINE_RE.exec(line);
	if (!match) return line;
	const prefix = match[1] ?? '';
	let body = (match[2] ?? '')
		.replace(/[🔺⏫🔼🔽⏬]/gu, '')
		.replace(/\s{2,}/g, ' ')
		.replace(/[ \t]+$/, '');

	if (priority) {
		const meta = FIRST_META_RE.exec(body);
		if (meta) {
			const head = body.slice(0, meta.index).replace(/[ \t]+$/, '');
			body = `${head} ${priority} ${body.slice(meta.index)}`.replace(/\s{2,}/g, ' ');
		} else {
			body = `${body} ${priority}`.replace(/^\s+/, '');
		}
	}

	return prefix + body;
}

import { App, TFile } from 'obsidian';
import { Quadrant } from './matrixClassifier';
import { FocusFirstSettings, TaskSize, sizeTagList } from './settings';
import { removeTagFromLine } from './taskRenderer';
import { setExclusiveTag, setSize } from './tasksFormat';
import { EditSnapshot, showUndoNotice } from './undo';
import { t } from './i18n';

const QUADRANT_KEYS = ['do', 'schedule', 'delegate', 'eliminate'] as const;

// The value/effort each positional slot represents (mirrors slotFor in the
// classifier): vertical = value, horizontal = low effort.
const SLOT_TARGET: Record<Quadrant, { highValue: boolean; lowEffort: boolean }> = {
	do:        { highValue: true,  lowEffort: true },
	schedule:  { highValue: true,  lowEffort: false },
	delegate:  { highValue: false, lowEffort: true },
	eliminate: { highValue: false, lowEffort: false },
};

const SIZE_ORDER: TaskSize[] = ['small', 'medium', 'large'];

/**
 * The pure line transform for an Eisenhower target: strips every configured
 * quadrant tag and appends the target's. Kept separate from the file I/O so the
 * batched triage writer can apply it to many lines in one read/write.
 */
export function quadrantTagLine(
	line: string,
	targetQuadrant: Quadrant,
	settings: FocusFirstSettings,
): string {
	const quadrantTags = QUADRANT_KEYS
		.map((key) => settings.quadrants[key].tag.trim())
		.filter(Boolean);

	let newLine = line;
	for (const tag of quadrantTags) {
		newLine = removeTagFromLine(newLine, tag);
	}

	const targetTag = settings.quadrants[targetQuadrant].tag.trim();
	if (targetTag) {
		newLine = newLine.trimEnd() + ' ' + targetTag;
	}
	return newLine;
}

/**
 * Reads a file, applies `transform` to the line at `lineNumber`, and writes it
 * back. Shared by both single-task drop handlers. Returns the revert snapshot,
 * or undefined when nothing was written (missing file, out-of-range line, stale
 * line, or a no-op transform).
 */
async function editSingleLine(
	app: App,
	filePath: string,
	lineNumber: number,
	expectedLine: string | undefined,
	transform: (line: string) => string,
): Promise<EditSnapshot | undefined> {
	const file = app.vault.getAbstractFileByPath(filePath);
	if (!(file instanceof TFile)) return;

	const content = await app.vault.read(file);
	const lines = content.split('\n');
	const line = lines[lineNumber];
	if (line === undefined) return;
	// Stale-line guard (#27): the note may have shifted since the drag started.
	if (expectedLine !== undefined && line !== expectedLine) return;

	const newLine = transform(line);
	if (newLine === line) return;
	lines[lineNumber] = newLine;
	await app.vault.modify(file, lines.join('\n'));
	return { filePath, startLine: lineNumber, before: [line], after: [newLine] };
}

/**
 * Re-tags a task line to a target quadrant: strips every configured quadrant tag
 * and appends the target's. The view auto-refreshes on the resulting file change.
 */
export async function moveTaskToQuadrant(
	app: App,
	settings: FocusFirstSettings,
	filePath: string,
	lineNumber: number,
	targetQuadrant: Quadrant,
	expectedLine?: string,
): Promise<EditSnapshot | undefined> {
	return editSingleLine(app, filePath, lineNumber, expectedLine,
		(line) => quadrantTagLine(line, targetQuadrant, settings));
}

interface DropPayload {
	filePath: string;
	lineNumber: number;
	sourceQuadrant: unknown;
	expectedLine?: string;
}

/** Defensively parses a drag payload — a drop can carry foreign/malformed JSON. */
function parseDropPayload(e: DragEvent): DropPayload | null {
	const raw = e.dataTransfer?.getData('application/json');
	if (!raw) return null;
	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch {
		return null;
	}
	if (typeof data !== 'object' || data === null) return null;
	const { filePath, lineNumber, quadrant, line } = data as {
		filePath?: unknown; lineNumber?: unknown; quadrant?: unknown; line?: unknown;
	};
	if (typeof filePath !== 'string' || typeof lineNumber !== 'number') return null;
	return { filePath, lineNumber, sourceQuadrant: quadrant, expectedLine: typeof line === 'string' ? line : undefined };
}

/** Wires the shared drop-target plumbing (hover highlight + payload parsing). */
function wireCellDrop(cell: HTMLElement, onDrop: (payload: DropPayload) => void): void {
	cell.addEventListener('dragover', (e) => {
		e.preventDefault();
		cell.classList.add('is-drag-over');
	});
	cell.addEventListener('dragleave', (e) => {
		if (!cell.contains(e.relatedTarget as Node)) {
			cell.classList.remove('is-drag-over');
		}
	});
	cell.addEventListener('drop', (e) => {
		e.preventDefault();
		cell.classList.remove('is-drag-over');
		const payload = parseDropPayload(e);
		if (payload) onDrop(payload);
	});
}

/** Wires a quadrant cell as a drop target that re-tags dropped tasks (Eisenhower). */
export function makeDropTarget(
	cell: HTMLElement,
	targetQuadrant: Quadrant,
	app: App,
	settings: FocusFirstSettings,
): void {
	wireCellDrop(cell, (p) => {
		if (p.sourceQuadrant === targetQuadrant) return;
		void moveTaskToQuadrant(app, settings, p.filePath, p.lineNumber, targetQuadrant, p.expectedLine)
			.then((snap) => showUndoNotice(app, String(t().view.undoLabels.moved), snap));
	});
}

/** The size tag that represents a slot's effort, or null to clear (un-sized = high effort). */
function effortSizeTag(settings: FocusFirstSettings, lowEffort: boolean): string | null {
	const low = settings.lowEffortSizes;
	// Low effort → first configured low-effort size; high effort → the largest
	// size that is not low-effort (so it reads as clearly "big").
	const pick = lowEffort
		? SIZE_ORDER.find((s) => low.includes(s))
		: [...SIZE_ORDER].reverse().find((s) => !low.includes(s));
	return pick ? (settings.sizeTags[pick].trim() || null) : null;
}

/**
 * The pure line transform for a Value/Effort target: writes both axes, the value
 * override tag (#highvalue / #lowvalue, which always wins over the value source)
 * and the size tag for the target effort.
 */
export function valueEffortLine(
	line: string,
	targetSlot: Quadrant,
	settings: FocusFirstSettings,
): string {
	const target = SLOT_TARGET[targetSlot];
	const highTag = settings.highValueTag.trim();
	const lowTag = settings.lowValueTag.trim();
	const valueGroup = [highTag, lowTag].filter(Boolean);
	const valueTag = target.highValue ? (highTag || null) : (lowTag || null);

	let newLine = setExclusiveTag(line, valueTag, valueGroup);
	newLine = setSize(newLine, effortSizeTag(settings, target.lowEffort), sizeTagList(settings));
	return newLine;
}

/**
 * Re-classifies a task to a Value/Effort slot by writing both axes. The view
 * auto-refreshes on the change.
 */
export async function moveTaskToValueEffort(
	app: App,
	settings: FocusFirstSettings,
	filePath: string,
	lineNumber: number,
	targetSlot: Quadrant,
	expectedLine?: string,
): Promise<EditSnapshot | undefined> {
	return editSingleLine(app, filePath, lineNumber, expectedLine,
		(line) => valueEffortLine(line, targetSlot, settings));
}

/** One task to assign in a batch: its location and the line the view last saw. */
export interface TriageTarget {
	filePath: string;
	lineNumber: number;
	expectedLine: string;
}

/**
 * Assigns many tasks to one slot in a single pass per file. Reads each file
 * once, applies the transform to every target line, and writes once, so twenty
 * tasks in one note can't clobber each other through interleaved read/writes,
 * the way twenty separate move calls would.
 *
 * Returns one snapshot per line actually changed, most-recent order preserved,
 * so the caller can offer a single Undo that reverts the whole batch. Lines that
 * no longer match what the view saw are skipped (the same #27 guard, per line).
 */
export async function assignTasksToSlot(
	app: App,
	settings: FocusFirstSettings,
	targets: TriageTarget[],
	system: 'eisenhower' | 'valueEffort',
	targetSlot: Quadrant,
): Promise<EditSnapshot[]> {
	const transform = (line: string): string =>
		system === 'eisenhower'
			? quadrantTagLine(line, targetSlot, settings)
			: valueEffortLine(line, targetSlot, settings);

	// Group by file so each note is read and written exactly once.
	const byFile = new Map<string, TriageTarget[]>();
	for (const target of targets) {
		const list = byFile.get(target.filePath) ?? [];
		list.push(target);
		byFile.set(target.filePath, list);
	}

	const snapshots: EditSnapshot[] = [];
	for (const [filePath, fileTargets] of byFile) {
		const file = app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) continue;

		const lines = (await app.vault.read(file)).split('\n');
		const fileSnapshots: EditSnapshot[] = [];
		for (const { lineNumber, expectedLine } of fileTargets) {
			const line = lines[lineNumber];
			if (line === undefined || line !== expectedLine) continue;
			const newLine = transform(line);
			if (newLine === line) continue;
			lines[lineNumber] = newLine;
			fileSnapshots.push({ filePath, startLine: lineNumber, before: [line], after: [newLine] });
		}
		if (fileSnapshots.length === 0) continue;
		await app.vault.modify(file, lines.join('\n'));
		snapshots.push(...fileSnapshots);
	}
	return snapshots;
}

/** Wires a quadrant cell as a drop target for the Value/Effort matrix. */
export function makeValueEffortDropTarget(
	cell: HTMLElement,
	targetSlot: Quadrant,
	app: App,
	settings: FocusFirstSettings,
): void {
	wireCellDrop(cell, (p) => {
		if (p.sourceQuadrant === targetSlot) return;
		void moveTaskToValueEffort(app, settings, p.filePath, p.lineNumber, targetSlot, p.expectedLine)
			.then((snap) => showUndoNotice(app, String(t().view.undoLabels.moved), snap));
	});
}

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
	const file = app.vault.getAbstractFileByPath(filePath);
	if (!(file instanceof TFile)) return;

	const content = await app.vault.read(file);
	const lines = content.split('\n');
	const line = lines[lineNumber];
	if (line === undefined) return;
	// Stale-line guard (#27): the note may have shifted since the drag started.
	if (expectedLine !== undefined && line !== expectedLine) return;

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

	if (newLine === line) return;
	lines[lineNumber] = newLine;
	await app.vault.modify(file, lines.join('\n'));
	return { filePath, startLine: lineNumber, before: [line], after: [newLine] };
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
 * Re-classifies a task to a Value/Effort slot by writing both axes: the value
 * override tag (#highvalue / #lowvalue, which always wins over the value source)
 * and the size tag for the target effort. The view auto-refreshes on the change.
 */
export async function moveTaskToValueEffort(
	app: App,
	settings: FocusFirstSettings,
	filePath: string,
	lineNumber: number,
	targetSlot: Quadrant,
	expectedLine?: string,
): Promise<EditSnapshot | undefined> {
	const file = app.vault.getAbstractFileByPath(filePath);
	if (!(file instanceof TFile)) return;

	const content = await app.vault.read(file);
	const lines = content.split('\n');
	const line = lines[lineNumber];
	if (line === undefined) return;
	if (expectedLine !== undefined && line !== expectedLine) return;

	const target = SLOT_TARGET[targetSlot];
	const highTag = settings.highValueTag.trim();
	const lowTag = settings.lowValueTag.trim();
	const valueGroup = [highTag, lowTag].filter(Boolean);
	const valueTag = target.highValue ? (highTag || null) : (lowTag || null);

	let newLine = setExclusiveTag(line, valueTag, valueGroup);
	newLine = setSize(newLine, effortSizeTag(settings, target.lowEffort), sizeTagList(settings));

	if (newLine === line) return;
	lines[lineNumber] = newLine;
	await app.vault.modify(file, lines.join('\n'));
	return { filePath, startLine: lineNumber, before: [line], after: [newLine] };
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

import { App, TFile } from 'obsidian';
import { Quadrant } from './matrixClassifier';
import { FocusFirstSettings } from './settings';
import { removeTagFromLine } from './taskRenderer';
import { EditSnapshot, showUndoNotice } from './undo';
import { t } from './i18n';

const QUADRANT_KEYS = ['do', 'schedule', 'delegate', 'eliminate'] as const;

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

/** Wires a quadrant cell as a drop target that re-tags dropped tasks. */
export function makeDropTarget(
	cell: HTMLElement,
	targetQuadrant: Quadrant,
	app: App,
	settings: FocusFirstSettings,
): void {
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
		const raw = e.dataTransfer?.getData('application/json');
		if (!raw) return;

		// Defensively parse — a drop can carry foreign or malformed payloads.
		let data: unknown;
		try {
			data = JSON.parse(raw);
		} catch {
			return;
		}
		if (typeof data !== 'object' || data === null) return;
		const { filePath, lineNumber, quadrant: sourceQuadrant, line } = data as {
			filePath?: unknown;
			lineNumber?: unknown;
			quadrant?: unknown;
			line?: unknown;
		};
		if (typeof filePath !== 'string' || typeof lineNumber !== 'number') return;
		if (sourceQuadrant === targetQuadrant) return;
		const expectedLine = typeof line === 'string' ? line : undefined;
		void moveTaskToQuadrant(app, settings, filePath, lineNumber, targetQuadrant, expectedLine)
			.then((snap) => showUndoNotice(app, String(t().view.undoLabels.moved), snap));
	});
}

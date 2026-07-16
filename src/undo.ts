import { App, TFile, Notice } from 'obsidian';
import { t } from './i18n';

/**
 * A revertible line-level edit (#32): the lines that occupied `startLine` before
 * the action and the lines that replaced them. Row actions return one of these so
 * the caller can offer a one-click undo.
 */
export interface EditSnapshot {
	filePath: string;
	startLine: number;
	before: string[];
	after: string[];
}

/**
 * Reverts an EditSnapshot, guarded like the row actions themselves (#27): it only
 * rewrites when the lines at the position still match what the edit wrote, so a
 * note that has since moved on is left untouched.
 */
export async function applyUndoSnapshot(app: App, snap: EditSnapshot): Promise<void> {
	const file = app.vault.getAbstractFileByPath(snap.filePath);
	if (!(file instanceof TFile)) return;
	const content = await app.vault.read(file);
	const lines = content.split('\n');
	const current = lines.slice(snap.startLine, snap.startLine + snap.after.length);
	if (current.length !== snap.after.length || current.some((l, i) => l !== snap.after[i])) return;
	lines.splice(snap.startLine, snap.after.length, ...snap.before);
	await app.vault.modify(file, lines.join('\n'));
}

/** Shows a short-lived toast with an Undo link that reverts `snap` (no-op if snap is undefined). */
export function showUndoNotice(app: App, label: string, snap: EditSnapshot | undefined): void {
	if (!snap) return;
	const notice = new Notice('', 5000);
	const el = notice.messageEl;
	el.empty();
	el.createEl('span', { text: `${label}  ` });
	const undo = el.createEl('a', { text: String(t().view.undo), cls: 'focus-first-undo' });
	undo.addEventListener('click', (e) => {
		(e as Event).preventDefault();
		void applyUndoSnapshot(app, snap);
		notice.hide();
	});
}

/** Reverts a batch of edits (each independently guarded). Order does not matter:
 * every snapshot rewrites the same number of lines it wrote, so positions hold. */
export async function applyUndoSnapshots(app: App, snaps: EditSnapshot[]): Promise<void> {
	for (const snap of snaps) {
		await applyUndoSnapshot(app, snap);
	}
}

/**
 * Undo toast for a batch assignment: shows how many tasks were changed and, on
 * Undo, reverts all of them. No-op when the batch is empty (nothing changed).
 */
export function showBatchUndoNotice(app: App, label: string, snaps: EditSnapshot[]): void {
	if (snaps.length === 0) return;
	const notice = new Notice('', 5000);
	const el = notice.messageEl;
	el.empty();
	el.createEl('span', { text: `${label}  ` });
	const undo = el.createEl('a', { text: String(t().view.undo), cls: 'focus-first-undo' });
	undo.addEventListener('click', (e) => {
		(e as Event).preventDefault();
		void applyUndoSnapshots(app, snaps);
		notice.hide();
	});
}

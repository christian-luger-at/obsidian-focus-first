/**
 * Tests for undo.ts (#32) — the revertible edit snapshot and its guarded apply,
 * plus that the row-action mutators return a snapshot describing their change.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('obsidian', () => import('./__mocks__/obsidian'));

const { applyUndoSnapshot, showUndoNotice } = await import('../undo');
const { updateTaskLine, completeTaskLine } = await import('../taskRenderer');
const { moveTaskToQuadrant } = await import('../taskDragDrop');
const { DEFAULT_SETTINGS } = await import('../settings');
const { TFile, createdNotices, clearCreatedNotices } = await import('./__mocks__/obsidian');

import type { App } from 'obsidian';

async function flush() { for (let i = 0; i < 6; i++) await Promise.resolve(); }

function makeApp(files: Record<string, string>) {
	const store = { ...files };
	const vault = {
		getAbstractFileByPath: (p: string) => (p in store ? new TFile(p) : null),
		read: vi.fn(async (file: { path: string }) => store[file.path] ?? ''),
		modify: vi.fn(async (file: { path: string }, content: string) => { store[file.path] = content; }),
	};
	return { app: { vault } as unknown as App, store, vault };
}

describe('applyUndoSnapshot', () => {
	it('restores a single-line edit', async () => {
		const { app, store } = makeApp({ 'a.md': '- [ ] Task #do' });
		await applyUndoSnapshot(app, { filePath: 'a.md', startLine: 0, before: ['- [ ] Task #schedule'], after: ['- [ ] Task #do'] });
		expect(store['a.md']).toBe('- [ ] Task #schedule');
	});

	it('does nothing when the current line no longer matches what was written', async () => {
		const { app, vault } = makeApp({ 'a.md': '- [ ] Something else' });
		await applyUndoSnapshot(app, { filePath: 'a.md', startLine: 0, before: ['- [ ] Before'], after: ['- [ ] After'] });
		expect(vault.modify).not.toHaveBeenCalled();
	});

	it('collapses a multi-line splice (recurring completion) back to one line', async () => {
		const { app, store } = makeApp({
			'a.md': 'intro\n- [ ] Next 🔁 every day 📅 2026-07-12\n- [x] Done 🔁 every day 📅 2026-07-11 ✅ 2026-07-11\noutro',
		});
		await applyUndoSnapshot(app, {
			filePath: 'a.md',
			startLine: 1,
			before: ['- [ ] Water 🔁 every day 📅 2026-07-11'],
			after: [
				'- [ ] Next 🔁 every day 📅 2026-07-12',
				'- [x] Done 🔁 every day 📅 2026-07-11 ✅ 2026-07-11',
			],
		});
		expect(store['a.md']).toBe('intro\n- [ ] Water 🔁 every day 📅 2026-07-11\noutro');
	});
});

describe('mutators return an undo snapshot', () => {
	it('updateTaskLine returns before/after and round-trips via undo', async () => {
		const { app, store } = makeApp({ 'a.md': '- [ ] Task' });
		const snap = await updateTaskLine(app, 'a.md', 0, (l) => `${l} #do`);
		expect(snap).toEqual({ filePath: 'a.md', startLine: 0, before: ['- [ ] Task'], after: ['- [ ] Task #do'] });
		expect(store['a.md']).toBe('- [ ] Task #do');

		await applyUndoSnapshot(app, snap!);
		expect(store['a.md']).toBe('- [ ] Task');
	});

	it('updateTaskLine returns undefined when nothing changed', async () => {
		const { app } = makeApp({ 'a.md': '- [ ] Task' });
		expect(await updateTaskLine(app, 'a.md', 0, (l) => l)).toBeUndefined();
	});

	it('completeTaskLine (no Tasks plugin) returns the checkbox-flip snapshot', async () => {
		const { app } = makeApp({ 'a.md': '- [ ] Task' });
		const snap = await completeTaskLine(app, 'a.md', 0);
		expect(snap).toEqual({ filePath: 'a.md', startLine: 0, before: ['- [ ] Task'], after: ['- [x] Task'] });
	});

	it('moveTaskToQuadrant returns the re-tag snapshot', async () => {
		const { app } = makeApp({ 'a.md': '- [ ] Task #schedule' });
		const snap = await moveTaskToQuadrant(app, { ...DEFAULT_SETTINGS }, 'a.md', 0, 'do', '- [ ] Task #schedule');
		expect(snap?.before).toEqual(['- [ ] Task #schedule']);
		expect(snap?.after).toEqual(['- [ ] Task #do']);
	});
});

describe('showUndoNotice', () => {
	it('offers an Undo link that reverts the edit', async () => {
		clearCreatedNotices();
		const { app, store } = makeApp({ 'a.md': '- [ ] Task #do' });
		showUndoNotice(app, 'Task moved', {
			filePath: 'a.md', startLine: 0, before: ['- [ ] Task #schedule'], after: ['- [ ] Task #do'],
		});

		const notice = createdNotices[createdNotices.length - 1]!;
		const link = (notice.messageEl as unknown as { findByClass(c: string): { dispatch(e: string, ev?: unknown): void } | undefined })
			.findByClass('focus-first-undo');
		link!.dispatch('click', { preventDefault: () => {} });
		await flush();

		expect(store['a.md']).toBe('- [ ] Task #schedule');
		expect(notice.hidden).toBe(true);
	});

	it('is a no-op for an undefined snapshot (nothing changed)', () => {
		clearCreatedNotices();
		const { app } = makeApp({});
		expect(() => showUndoNotice(app, 'x', undefined)).not.toThrow();
		expect(createdNotices).toHaveLength(0);
	});
});

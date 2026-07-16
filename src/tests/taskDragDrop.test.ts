/**
 * Tests for taskDragDrop.ts — moving a task between quadrants by re-tagging,
 * and the drop-target wiring on a quadrant cell.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('obsidian', () => import('./__mocks__/obsidian'));

const { moveTaskToQuadrant, makeDropTarget, moveTaskToValueEffort, assignTasksToSlot } = await import('../taskDragDrop');
const { DEFAULT_SETTINGS } = await import('../settings');
const { TFile } = await import('./__mocks__/obsidian');

import type { App } from 'obsidian';
import type { FocusFirstSettings } from '../settings';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const settings: FocusFirstSettings = { ...DEFAULT_SETTINGS };

function makeApp(files: Record<string, string>) {
	const store = { ...files };
	const vault = {
		getAbstractFileByPath: (p: string) => (p in store ? new TFile(p) : null),
		read: vi.fn(async (file: { path: string }) => store[file.path] ?? ''),
		modify: vi.fn(async (file: { path: string }, content: string) => { store[file.path] = content; }),
	};
	return { app: { vault } as unknown as App, store, vault };
}

async function flush() { for (let i = 0; i < 8; i++) await Promise.resolve(); }

/** Minimal cell supporting the events, classList and contains() the code uses. */
class FakeCell {
	listeners: Record<string, ((e: unknown) => void)[]> = {};
	cls = new Set<string>();
	parent: FakeCell | null = null;
	classList = {
		add: (c: string) => this.cls.add(c),
		remove: (c: string) => this.cls.delete(c),
		contains: (c: string) => this.cls.has(c),
	};
	addEventListener(type: string, h: (e: unknown) => void) { (this.listeners[type] ??= []).push(h); }
	dispatch(type: string, e: unknown = {}) { for (const h of this.listeners[type] ?? []) h(e); }
	contains(node: unknown): boolean {
		let n = node as FakeCell | null;
		while (n) { if (n === this) return true; n = n.parent; }
		return false;
	}
}

function cellFor(app: App, quadrant: 'do' | 'schedule' | 'delegate' | 'eliminate') {
	const cell = new FakeCell();
	makeDropTarget(cell as unknown as HTMLElement, quadrant, app, settings);
	return cell;
}

function dropEvent(payload: unknown) {
	return {
		preventDefault: () => {},
		dataTransfer: { getData: () => (typeof payload === 'string' ? payload : JSON.stringify(payload)) },
	};
}

// ---------------------------------------------------------------------------
// moveTaskToQuadrant
// ---------------------------------------------------------------------------

describe('moveTaskToQuadrant', () => {
	it('strips an existing quadrant tag and appends the target tag', async () => {
		const { app, store } = makeApp({ 'a.md': '- [ ] Task #schedule' });
		await moveTaskToQuadrant(app, settings, 'a.md', 0, 'do');
		expect(store['a.md']).toBe('- [ ] Task #do');
	});

	it('adds the target tag when there is none', async () => {
		const { app, store } = makeApp({ 'a.md': '- [ ] Task' });
		await moveTaskToQuadrant(app, settings, 'a.md', 0, 'eliminate');
		expect(store['a.md']).toBe('- [ ] Task #eliminate');
	});

	it('does nothing when the file is not found', async () => {
		const { app } = makeApp({});
		await expect(moveTaskToQuadrant(app, settings, 'missing.md', 0, 'do')).resolves.toBeUndefined();
	});

	it('does nothing when the line number is out of range', async () => {
		const { app, vault } = makeApp({ 'a.md': '- [ ] Task' });
		await moveTaskToQuadrant(app, settings, 'a.md', 99, 'do');
		expect(vault.modify).not.toHaveBeenCalled();
	});

	it('does nothing when the line no longer matches the expected task (#27)', async () => {
		const { app, vault } = makeApp({ 'a.md': '- [ ] A different task now' });
		await moveTaskToQuadrant(app, settings, 'a.md', 0, 'do', '- [ ] The task I dragged');
		expect(vault.modify).not.toHaveBeenCalled();
	});

	it('moves when the expected line still matches', async () => {
		const { app, store } = makeApp({ 'a.md': '- [ ] Task #schedule' });
		await moveTaskToQuadrant(app, settings, 'a.md', 0, 'do', '- [ ] Task #schedule');
		expect(store['a.md']).toBe('- [ ] Task #do');
	});
});

// ---------------------------------------------------------------------------
// makeDropTarget
// ---------------------------------------------------------------------------

describe('makeDropTarget', () => {
	it('highlights on dragover and moves a dropped task to the target quadrant', async () => {
		const { app, store } = makeApp({ 'a.md': '- [ ] Task #schedule' });
		const cell = cellFor(app, 'delegate');
		cell.dispatch('dragover', { preventDefault: () => {} });
		expect(cell.classList.contains('is-drag-over')).toBe(true);
		cell.dispatch('drop', dropEvent({ filePath: 'a.md', lineNumber: 0, quadrant: 'schedule' }));
		await flush();
		expect(store['a.md']).toBe('- [ ] Task #delegate');
	});

	it('dragleave removes the highlight only when the pointer leaves the cell', () => {
		const { app } = makeApp({});
		const cell = cellFor(app, 'do');
		cell.dispatch('dragover', { preventDefault: () => {} });
		const inside = new FakeCell();
		inside.parent = cell;
		cell.dispatch('dragleave', { relatedTarget: inside });
		expect(cell.classList.contains('is-drag-over')).toBe(true);
		cell.dispatch('dragleave', { relatedTarget: new FakeCell() });
		expect(cell.classList.contains('is-drag-over')).toBe(false);
	});

	it('a drop onto the same quadrant does nothing', async () => {
		const { app, vault } = makeApp({ 'a.md': '- [ ] A #do' });
		const cell = cellFor(app, 'do');
		cell.dispatch('drop', dropEvent({ filePath: 'a.md', lineNumber: 0, quadrant: 'do' }));
		await flush();
		expect(vault.modify).not.toHaveBeenCalled();
	});

	it('ignores empty, non-object, or wrongly-typed payloads', () => {
		const { app } = makeApp({});
		const cell = cellFor(app, 'do');
		expect(() => cell.dispatch('drop', dropEvent(''))).not.toThrow();
		expect(() => cell.dispatch('drop', dropEvent('not json'))).not.toThrow();
		expect(() => cell.dispatch('drop', dropEvent('42'))).not.toThrow();
		expect(() => cell.dispatch('drop', dropEvent({ filePath: 5, lineNumber: 'x' }))).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// moveTaskToValueEffort (#36)
// ---------------------------------------------------------------------------

describe('moveTaskToValueEffort', () => {
	// Defaults: highValueTag #highvalue, lowValueTag #lowvalue, lowEffortSizes ['small'],
	// so low effort → #s and high effort → #l (largest size that isn't low-effort).
	it('Quick Wins (do) → high value + low effort', async () => {
		const { app, store } = makeApp({ 'a.md': '- [ ] Task' });
		await moveTaskToValueEffort(app, settings, 'a.md', 0, 'do');
		expect(store['a.md']).toBe('- [ ] Task #highvalue #s');
	});

	it('Big Bets (schedule) → high value + high effort', async () => {
		const { app, store } = makeApp({ 'a.md': '- [ ] Task' });
		await moveTaskToValueEffort(app, settings, 'a.md', 0, 'schedule');
		expect(store['a.md']).toBe('- [ ] Task #highvalue #l');
	});

	it('Fill-ins (delegate) → low value + low effort', async () => {
		const { app, store } = makeApp({ 'a.md': '- [ ] Task' });
		await moveTaskToValueEffort(app, settings, 'a.md', 0, 'delegate');
		expect(store['a.md']).toBe('- [ ] Task #lowvalue #s');
	});

	it('Time Sinks (eliminate) → low value + high effort', async () => {
		const { app, store } = makeApp({ 'a.md': '- [ ] Task' });
		await moveTaskToValueEffort(app, settings, 'a.md', 0, 'eliminate');
		expect(store['a.md']).toBe('- [ ] Task #lowvalue #l');
	});

	it('replaces any existing value + size tags (never stacks)', async () => {
		const { app, store } = makeApp({ 'a.md': '- [ ] Task #lowvalue #l' });
		await moveTaskToValueEffort(app, settings, 'a.md', 0, 'do');
		expect(store['a.md']).toBe('- [ ] Task #highvalue #s');
	});

	it('clears the size (un-sized = high effort) when every size counts as low effort', async () => {
		const allLow: FocusFirstSettings = { ...settings, lowEffortSizes: ['small', 'medium', 'large'] };
		const { app, store } = makeApp({ 'a.md': '- [ ] Task #s' });
		await moveTaskToValueEffort(app, allLow, 'a.md', 0, 'schedule'); // high effort
		expect(store['a.md']).toBe('- [ ] Task #highvalue');
	});

	it('does nothing when the line already matches the target slot', async () => {
		const { app, vault } = makeApp({ 'a.md': '- [ ] Task #highvalue #s' });
		await moveTaskToValueEffort(app, settings, 'a.md', 0, 'do');
		expect(vault.modify).not.toHaveBeenCalled();
	});

	it('honours the stale-line guard', async () => {
		const { app, vault } = makeApp({ 'a.md': '- [ ] Changed since drag' });
		await moveTaskToValueEffort(app, settings, 'a.md', 0, 'do', '- [ ] What I dragged');
		expect(vault.modify).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// assignTasksToSlot — batched, one read/write per file
// ---------------------------------------------------------------------------

describe('assignTasksToSlot', () => {
	it('assigns several tasks in one file with a single write (no clobber)', async () => {
		const { app, vault } = makeApp({
			'a.md': '- [ ] One\n- [ ] Two\n- [ ] Three',
		});
		const targets = [
			{ filePath: 'a.md', lineNumber: 0, expectedLine: '- [ ] One' },
			{ filePath: 'a.md', lineNumber: 2, expectedLine: '- [ ] Three' },
		];
		const snaps = await assignTasksToSlot(app, settings, targets, 'eisenhower', 'do');

		// Both target lines got the #do tag; the untouched middle line is intact.
		expect(snaps).toHaveLength(2);
		// One write for the whole file, not one per task.
		expect(vault.modify).toHaveBeenCalledTimes(1);
		const written = vault.modify.mock.calls[0]![1];
		expect(written).toBe('- [ ] One #do\n- [ ] Two\n- [ ] Three #do');
	});

	it('writes value + size tags in value/effort mode', async () => {
		const { app, vault } = makeApp({ 'a.md': '- [ ] One' });
		await assignTasksToSlot(app, settings, [{ filePath: 'a.md', lineNumber: 0, expectedLine: '- [ ] One' }], 'valueEffort', 'do');
		const written = vault.modify.mock.calls[0]![1];
		expect(written).toContain('#highvalue');
		expect(written).toContain(settings.sizeTags.small);
	});

	it('skips a stale target but still applies the others in the same file', async () => {
		const { app, vault } = makeApp({ 'a.md': '- [ ] One\n- [ ] Two' });
		const snaps = await assignTasksToSlot(app, settings, [
			{ filePath: 'a.md', lineNumber: 0, expectedLine: '- [ ] STALE' },
			{ filePath: 'a.md', lineNumber: 1, expectedLine: '- [ ] Two' },
		], 'eisenhower', 'do');
		expect(snaps).toHaveLength(1);
		expect(vault.modify.mock.calls[0]![1]).toBe('- [ ] One\n- [ ] Two #do');
	});

	it('spans multiple files, one write each', async () => {
		const { app, vault } = makeApp({ 'a.md': '- [ ] A', 'b.md': '- [ ] B' });
		const snaps = await assignTasksToSlot(app, settings, [
			{ filePath: 'a.md', lineNumber: 0, expectedLine: '- [ ] A' },
			{ filePath: 'b.md', lineNumber: 0, expectedLine: '- [ ] B' },
		], 'eisenhower', 'eliminate');
		expect(snaps).toHaveLength(2);
		expect(vault.modify).toHaveBeenCalledTimes(2);
	});

	it('does not write a file when nothing in it changed', async () => {
		const { app, vault } = makeApp({ 'a.md': '- [ ] Only #do' });
		// Assigning to the slot it already has is a no-op.
		const snaps = await assignTasksToSlot(app, settings, [
			{ filePath: 'a.md', lineNumber: 0, expectedLine: '- [ ] Only #do' },
		], 'eisenhower', 'do');
		expect(snaps).toHaveLength(0);
		expect(vault.modify).not.toHaveBeenCalled();
	});

	it('ignores targets in a missing file', async () => {
		const { app } = makeApp({});
		const snaps = await assignTasksToSlot(app, settings, [
			{ filePath: 'gone.md', lineNumber: 0, expectedLine: '- [ ] x' },
		], 'eisenhower', 'do');
		expect(snaps).toHaveLength(0);
	});
});

/**
 * Tests for TaskView.ts — the view's own date filtering plus the tag-mutating
 * helpers behind the row actions (toggleFocusTag, toggleHideTag, completeTask).
 * Sorting/grouping/date-bucketing live in taskSorting.test.ts and drag-and-drop
 * in taskDragDrop.test.ts; DOM rendering is covered in TaskView.render.test.ts.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('obsidian', () => import('./__mocks__/obsidian'));

const { FocusFirstView } = await import('../TaskView');
const { DEFAULT_SETTINGS } = await import('../settings');
const { TFile } = await import('./__mocks__/obsidian');
const { removeTagFromLine, toggleFocusTagLine, completeTaskLine } = await import('../taskRenderer');

import type { MatrixTask } from '../matrixClassifier';
import type { FocusFirstSettings } from '../settings';
import type { TaskItem } from '../taskScanner';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysFromToday(offset: number): Date {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	d.setDate(d.getDate() + offset);
	return d;
}

function makeMatrixTask(overrides: Partial<MatrixTask> = {}): MatrixTask {
	return {
		file: new TFile('Notes/test.md') as never,
		line: '- [ ] Sample task',
		lineNumber: 0,
		completed: false,
		tags: [],
		quadrant: 'do',
		manual: false,
		...overrides,
	};
}

function makeFakeVault(files: Record<string, string>) {
	const store = { ...files };
	return {
		getAbstractFileByPath: (path: string) => (path in store ? new TFile(path) : null),
		read: vi.fn(async (file: { path: string }) => store[file.path] ?? ''),
		modify: vi.fn(async (file: { path: string }, content: string) => {
			store[file.path] = content;
		}),
		_store: store,
	};
}

function makeView(settings: Partial<FocusFirstSettings> = {}, vault?: ReturnType<typeof makeFakeVault>) {
	const app = { vault: vault ?? makeFakeVault({}) };
	const leaf = { app };
	const plugin = { settings: { ...DEFAULT_SETTINGS, ...settings } };
	// @ts-expect-error — stub leaf/plugin, not real Obsidian types
	const view = new FocusFirstView(leaf, plugin);
	return { view, plugin, app };
}

// Typed view into FocusFirstView's private members, used only by tests.
// TypeScript `private` is compile-time only — this gives test access without `any`.
interface TestableView {
	activeDateFilters: Set<string>;
	passesDateFilter(task: TaskItem): boolean;
}

function priv(view: unknown): TestableView {
	return view as TestableView;
}

// ---------------------------------------------------------------------------
// View metadata
// ---------------------------------------------------------------------------

describe('view metadata', () => {
	it('exposes the view type, display text, and icon', () => {
		const { view } = makeView();
		expect(view.getViewType()).toBe('focus-first-view');
		expect(view.getDisplayText()).toBeTruthy();
		expect(view.getIcon()).toBe('list-checks');
	});
});

// ---------------------------------------------------------------------------
// passesDateFilter
// ---------------------------------------------------------------------------

describe('passesDateFilter', () => {
	it('passes everything when no filters are active', () => {
		const { view } = makeView();
		const task = makeMatrixTask({ dueDate: daysFromToday(-5) });
		expect(priv(view).passesDateFilter(task)).toBe(true);
	});

	it('filters out tasks not matching the active bucket', () => {
		const { view } = makeView();
		priv(view).activeDateFilters = new Set(['__overdue__']);
		const futureTask = makeMatrixTask({ dueDate: daysFromToday(10) });
		expect(priv(view).passesDateFilter(futureTask)).toBe(false);
	});

	it('keeps tasks matching the active bucket', () => {
		const { view } = makeView();
		priv(view).activeDateFilters = new Set(['__overdue__']);
		const overdueTask = makeMatrixTask({ dueDate: daysFromToday(-2) });
		expect(priv(view).passesDateFilter(overdueTask)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// removeTagFromLine — targeted tag removal that preserves whitespace
// ---------------------------------------------------------------------------

describe('removeTagFromLine', () => {
	it('removes the tag and its leading space, keeping the rest', () => {
		expect(removeTagFromLine('- [ ] Task one #focus', '#focus')).toBe('- [ ] Task one');
	});

	it('preserves leading indentation of nested tasks', () => {
		expect(removeTagFromLine('\t- [ ] Nested #focus', '#focus')).toBe('\t- [ ] Nested');
		expect(removeTagFromLine('    - [ ] Nested #hide', '#hide')).toBe('    - [ ] Nested');
	});

	it('is case-insensitive', () => {
		expect(removeTagFromLine('- [ ] Task #Focus', '#focus')).toBe('- [ ] Task');
	});

	it('does not touch a longer tag that starts the same', () => {
		expect(removeTagFromLine('- [ ] Task #done', '#do')).toBe('- [ ] Task #done');
	});

	it('leaves the line unchanged when the tag is absent', () => {
		expect(removeTagFromLine('- [ ] Task one', '#focus')).toBe('- [ ] Task one');
	});
});

// ---------------------------------------------------------------------------
// toggleFocusTag / toggleHideTag / completeTask
// ---------------------------------------------------------------------------

describe('toggleFocusTagLine', () => {
	it('appends the focus tag to the task line', async () => {
		const vault = makeFakeVault({ 'a.md': '- [ ] Task one\n- [ ] Task two' });
		const { plugin, app } = makeView({ focusTag: '#focus' }, vault);
		await toggleFocusTagLine(app as never, plugin.settings, 'a.md', 0, '#focus', true);
		expect(vault._store['a.md']).toBe('- [ ] Task one #focus\n- [ ] Task two');
	});

	it('removes the focus tag from the task line', async () => {
		const vault = makeFakeVault({ 'a.md': '- [ ] Task one #focus' });
		const { plugin, app } = makeView({ focusTag: '#focus' }, vault);
		await toggleFocusTagLine(app as never, plugin.settings, 'a.md', 0, '#focus', false);
		expect(vault._store['a.md']).toBe('- [ ] Task one');
	});

	it('keeps indentation of a nested task when removing the tag', async () => {
		const vault = makeFakeVault({ 'a.md': '\t- [ ] Nested #focus' });
		const { plugin, app } = makeView({ focusTag: '#focus' }, vault);
		await toggleFocusTagLine(app as never, plugin.settings, 'a.md', 0, '#focus', false);
		expect(vault._store['a.md']).toBe('\t- [ ] Nested');
	});

	it('does nothing when the file does not exist', async () => {
		const vault = makeFakeVault({});
		const { plugin, app } = makeView({}, vault);
		await toggleFocusTagLine(app as never, plugin.settings, 'missing.md', 0, '#focus', true);
		expect(vault.modify).not.toHaveBeenCalled();
	});
});

describe('completeTaskLine', () => {
	it('marks the task checkbox as done', async () => {
		const vault = makeFakeVault({ 'a.md': '- [ ] Task one' });
		const { app } = makeView({}, vault);
		await completeTaskLine(app as never, 'a.md', 0);
		expect(vault._store['a.md']).toBe('- [x] Task one');
	});
});

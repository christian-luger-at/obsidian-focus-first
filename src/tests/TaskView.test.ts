/**
 * Tests for TaskView.ts — focused on the pure sorting/grouping/filtering logic
 * and the vault-mutating helpers (toggleFocusTag, toggleHideTag, completeTask,
 * moveTaskToQuadrant). DOM rendering (render/renderMatrix/...) is intentionally
 * not exercised here since it requires a full Obsidian DOM environment; the
 * logic that is most likely to regress on refactors — sorting, grouping,
 * date bucketing, and tag mutation — is covered instead.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('obsidian', () => import('./__mocks__/obsidian'));

const { FocusFirstView } = await import('../TaskView');
const { DEFAULT_SETTINGS } = await import('../settings');
const { TFile } = await import('./__mocks__/obsidian');

import type { MatrixTask, Quadrant } from '../matrixClassifier';
import type { FokusFirstSettings, SortField } from '../settings';
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

function makeView(settings: Partial<FokusFirstSettings> = {}, vault?: ReturnType<typeof makeFakeVault>) {
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
	compareFn(field: SortField): (a: MatrixTask, b: MatrixTask) => number;
	sortTasks(tasks: MatrixTask[], quadrant: Quadrant): MatrixTask[];
	groupKey(task: MatrixTask, field: SortField): string;
	groupLabel(key: string, field: SortField): string;
	groupOrder(field: SortField): (a: string, b: string) => number;
	dueBucket(task: TaskItem): string;
	passesDateFilter(task: TaskItem): boolean;
	toggleFocusTag(filePath: string, lineNumber: number, focusTag: string, add: boolean): Promise<void>;
	toggleHideTag(filePath: string, lineNumber: number, hideTag: string): Promise<void>;
	completeTask(filePath: string, lineNumber: number): Promise<void>;
	moveTaskToQuadrant(filePath: string, lineNumber: number, targetQuadrant: Quadrant): Promise<void>;
}

function priv(view: unknown): TestableView {
	return view as TestableView;
}

// ---------------------------------------------------------------------------
// compareFn / sortTasks
// ---------------------------------------------------------------------------

describe('compareFn — priority', () => {
	const { view } = makeView();
	const cmp = priv(view).compareFn('priority');

	it('orders Highest before High', () => {
		const a = makeMatrixTask({ priority: '🔺' });
		const b = makeMatrixTask({ priority: '⏫' });
		expect(cmp(a, b)).toBeLessThan(0);
	});

	it('orders any priority before no priority', () => {
		const a = makeMatrixTask({ priority: '⏬' });
		const b = makeMatrixTask({ priority: undefined });
		expect(cmp(a, b)).toBeLessThan(0);
	});

	it('treats equal priorities as equal', () => {
		const a = makeMatrixTask({ priority: '🔼' });
		const b = makeMatrixTask({ priority: '🔼' });
		expect(cmp(a, b)).toBe(0);
	});
});

describe('compareFn — dueDate', () => {
	const { view } = makeView();
	const cmp = priv(view).compareFn('dueDate');

	it('orders earlier date before later date', () => {
		const a = makeMatrixTask({ dueDate: daysFromToday(0) });
		const b = makeMatrixTask({ dueDate: daysFromToday(5) });
		expect(cmp(a, b)).toBeLessThan(0);
	});

	it('orders any date before no date', () => {
		const a = makeMatrixTask({ dueDate: daysFromToday(10) });
		const b = makeMatrixTask({ dueDate: undefined });
		expect(cmp(a, b)).toBeLessThan(0);
	});

	it('treats two undated tasks as equal', () => {
		const a = makeMatrixTask({ dueDate: undefined });
		const b = makeMatrixTask({ dueDate: undefined });
		expect(cmp(a, b)).toBe(0);
	});
});

describe('compareFn — alpha', () => {
	const { view } = makeView();
	const cmp = priv(view).compareFn('alpha');

	it('orders alphabetically, ignoring the checkbox prefix', () => {
		const a = makeMatrixTask({ line: '- [ ] Apple task' });
		const b = makeMatrixTask({ line: '- [ ] Banana task' });
		expect(cmp(a, b)).toBeLessThan(0);
	});

	it('is case-insensitive', () => {
		const a = makeMatrixTask({ line: '- [ ] apple' });
		const b = makeMatrixTask({ line: '- [ ] Banana' });
		expect(cmp(a, b)).toBeLessThan(0);
	});
});

describe('sortTasks', () => {
	it('sorts by primary field, falling back to secondary on ties', () => {
		const { view, plugin } = makeView();
		plugin.settings.quadrants.do.sort = { primary: 'priority', secondary: 'dueDate' };

		const tasks = [
			makeMatrixTask({ priority: '🔺', dueDate: daysFromToday(5), line: '- [ ] later' }),
			makeMatrixTask({ priority: '🔺', dueDate: daysFromToday(1), line: '- [ ] sooner' }),
			makeMatrixTask({ priority: '⏬', dueDate: daysFromToday(0), line: '- [ ] low prio' }),
		];

		const sorted: MatrixTask[] = priv(view).sortTasks(tasks, 'do');
		expect(sorted.map((t: MatrixTask) => t.line)).toEqual([
			'- [ ] sooner',
			'- [ ] later',
			'- [ ] low prio',
		]);
	});

	it('does not mutate the input array', () => {
		const { view } = makeView();
		const tasks = [makeMatrixTask({ line: '- [ ] b' }), makeMatrixTask({ line: '- [ ] a' })];
		const original = [...tasks];
		priv(view).sortTasks(tasks, 'eliminate');
		expect(tasks).toEqual(original);
	});
});

// ---------------------------------------------------------------------------
// groupKey / groupLabel / groupOrder
// ---------------------------------------------------------------------------

describe('groupKey — priority field', () => {
	const { view } = makeView();

	it('returns the priority emoji when present', () => {
		const task = makeMatrixTask({ priority: '🔺' });
		expect(priv(view).groupKey(task, 'priority')).toBe('🔺');
	});

	it('returns "__none__" when no priority', () => {
		const task = makeMatrixTask({ priority: undefined });
		expect(priv(view).groupKey(task, 'priority')).toBe('__none__');
	});
});

describe('groupKey — dueDate field', () => {
	const { view } = makeView();

	it('buckets overdue tasks', () => {
		const task = makeMatrixTask({ dueDate: daysFromToday(-1) });
		expect(priv(view).groupKey(task, 'dueDate')).toBe('__overdue__');
	});

	it('buckets tasks due today', () => {
		const task = makeMatrixTask({ dueDate: daysFromToday(0) });
		expect(priv(view).groupKey(task, 'dueDate')).toBe('__today__');
	});

	it('buckets tasks due later than 14 days as __later__', () => {
		const task = makeMatrixTask({ dueDate: daysFromToday(30) });
		expect(priv(view).groupKey(task, 'dueDate')).toBe('__later__');
	});

	it('buckets undated tasks as __nodate__', () => {
		const task = makeMatrixTask({ dueDate: undefined });
		expect(priv(view).groupKey(task, 'dueDate')).toBe('__nodate__');
	});
});

describe('groupKey — alpha field', () => {
	const { view } = makeView();

	it('returns the uppercased first letter, ignoring the checkbox prefix', () => {
		const task = makeMatrixTask({ line: '- [ ] zebra task' });
		expect(priv(view).groupKey(task, 'alpha')).toBe('Z');
	});
});

describe('groupLabel', () => {
	const { view } = makeView();

	it('maps "__none__" priority key to the no-priority label', () => {
		expect(priv(view).groupLabel('__none__', 'priority')).toBeTruthy();
	});

	it('returns the priority emoji unchanged otherwise', () => {
		expect(priv(view).groupLabel('🔺', 'priority')).toBe('🔺');
	});

	it('maps known dueDate bucket keys to labels', () => {
		expect(priv(view).groupLabel('__overdue__', 'dueDate')).toBeTruthy();
		expect(priv(view).groupLabel('__today__', 'dueDate')).toBeTruthy();
	});

	it('falls back to the raw key for alpha grouping', () => {
		expect(priv(view).groupLabel('Z', 'alpha')).toBe('Z');
	});
});

describe('groupOrder', () => {
	const { view } = makeView();

	it('orders priority groups by severity, with "__none__" last', () => {
		const order = priv(view).groupOrder('priority');
		const keys = ['__none__', '🔺', '🔽'];
		const sorted = [...keys].sort(order);
		expect(sorted).toEqual(['🔺', '🔽', '__none__']);
	});

	it('orders dueDate buckets chronologically', () => {
		const order = priv(view).groupOrder('dueDate');
		const keys = ['__nodate__', '__today__', '__overdue__'];
		const sorted = [...keys].sort(order);
		expect(sorted).toEqual(['__overdue__', '__today__', '__nodate__']);
	});

	it('orders alpha groups alphabetically', () => {
		const order = priv(view).groupOrder('alpha');
		const keys = ['B', 'A', 'C'];
		expect([...keys].sort(order)).toEqual(['A', 'B', 'C']);
	});
});

// ---------------------------------------------------------------------------
// dueBucket / passesDateFilter
// ---------------------------------------------------------------------------

describe('dueBucket', () => {
	const { view } = makeView();

	// "This week" runs through the upcoming Sunday — compute that boundary the
	// same way the source does, so the test is valid regardless of which day it runs.
	function daysUntilSunday(): number {
		const dow = new Date().getDay();
		return dow === 0 ? 0 : 7 - dow;
	}

	it('returns "__nodate__" when there is no due date', () => {
		const task = makeMatrixTask({ dueDate: undefined });
		expect(priv(view).dueBucket(task)).toBe('__nodate__');
	});

	it('returns "__overdue__" for a date in the past', () => {
		const task = makeMatrixTask({ dueDate: daysFromToday(-3) });
		expect(priv(view).dueBucket(task)).toBe('__overdue__');
	});

	it('returns "__today__" for the current date', () => {
		const task = makeMatrixTask({ dueDate: daysFromToday(0) });
		expect(priv(view).dueBucket(task)).toBe('__today__');
	});

	it('returns "__thisweek__" for a date up to and including the coming Sunday', () => {
		const sunday = daysUntilSunday();
		if (sunday > 0) {
			const task = makeMatrixTask({ dueDate: daysFromToday(sunday) });
			expect(priv(view).dueBucket(task)).toBe('__thisweek__');
		}
	});

	it('returns "__upcoming__" for a date within 14 days but after this week', () => {
		// daysUntilSunday() is at most 6, so +1 day is always past Sunday and within 14 days.
		const offset = daysUntilSunday() + 1;
		const task = makeMatrixTask({ dueDate: daysFromToday(offset) });
		expect(priv(view).dueBucket(task)).toBe('__upcoming__');
	});

	it('returns "__later__" for a date more than 14 days out', () => {
		const task = makeMatrixTask({ dueDate: daysFromToday(30) });
		expect(priv(view).dueBucket(task)).toBe('__later__');
	});
});

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
// toggleFocusTag / toggleHideTag / completeTask / moveTaskToQuadrant
// ---------------------------------------------------------------------------

describe('toggleFocusTag', () => {
	it('appends the focus tag to the task line', async () => {
		const vault = makeFakeVault({ 'a.md': '- [ ] Task one\n- [ ] Task two' });
		const { view } = makeView({ focusTag: '#focus' }, vault);
		await priv(view).toggleFocusTag('a.md', 0, '#focus', true);
		expect(vault._store['a.md']).toBe('- [ ] Task one #focus\n- [ ] Task two');
	});

	it('removes the focus tag from the task line', async () => {
		const vault = makeFakeVault({ 'a.md': '- [ ] Task one #focus' });
		const { view } = makeView({ focusTag: '#focus' }, vault);
		await priv(view).toggleFocusTag('a.md', 0, '#focus', false);
		expect(vault._store['a.md']).toBe('- [ ] Task one');
	});

	it('does nothing when the file does not exist', async () => {
		const vault = makeFakeVault({});
		const { view } = makeView({}, vault);
		await priv(view).toggleFocusTag('missing.md', 0, '#focus', true);
		expect(vault.modify).not.toHaveBeenCalled();
	});
});

describe('toggleHideTag', () => {
	it('adds the hide tag when not already present', async () => {
		const vault = makeFakeVault({ 'a.md': '- [ ] Task one' });
		const { view } = makeView({ hideTag: '#hide' }, vault);
		await priv(view).toggleHideTag('a.md', 0, '#hide');
		expect(vault._store['a.md']).toBe('- [ ] Task one #hide');
	});

	it('removes the hide tag when already present', async () => {
		const vault = makeFakeVault({ 'a.md': '- [ ] Task one #hide' });
		const { view } = makeView({ hideTag: '#hide' }, vault);
		await priv(view).toggleHideTag('a.md', 0, '#hide');
		expect(vault._store['a.md']).toBe('- [ ] Task one');
	});
});

describe('completeTask', () => {
	it('marks the task checkbox as done', async () => {
		const vault = makeFakeVault({ 'a.md': '- [ ] Task one' });
		const { view } = makeView({}, vault);
		await priv(view).completeTask('a.md', 0);
		expect(vault._store['a.md']).toBe('- [x] Task one');
	});
});

describe('moveTaskToQuadrant', () => {
	it('strips existing quadrant tags and appends the target tag', async () => {
		const vault = makeFakeVault({ 'a.md': '- [ ] Task #do' });
		const { view } = makeView({}, vault);
		await priv(view).moveTaskToQuadrant('a.md', 0, 'schedule');
		expect(vault._store['a.md']).toBe('- [ ] Task #schedule');
	});

	it('does not duplicate the target tag if already present elsewhere', async () => {
		const vault = makeFakeVault({ 'a.md': '- [ ] Task #eliminate' });
		const { view } = makeView({}, vault);
		await priv(view).moveTaskToQuadrant('a.md', 0, 'delegate');
		expect(vault._store['a.md']).toBe('- [ ] Task #delegate');
	});
});

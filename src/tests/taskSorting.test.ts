/**
 * Tests for taskSorting.ts — the pure sorting / grouping / date-bucketing logic
 * extracted from the view. No DOM or Obsidian runtime needed.
 */

import { describe, it, expect } from 'vitest';
import {
	compareFn, sortTasks, dueBucket, groupKey, groupLabel, groupOrder,
} from '../taskSorting';

import type { MatrixTask } from '../matrixClassifier';
import type { QuadrantSort } from '../settings';
import { parseIsoDate } from '../dateUtils';

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
		file: { path: 'Notes/test.md', basename: 'test' } as never,
		line: '- [ ] Sample task',
		lineNumber: 0,
		completed: false,
		tags: [],
		quadrant: 'do',
		manual: false,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// compareFn
// ---------------------------------------------------------------------------

describe('compareFn — priority', () => {
	const cmp = compareFn('priority');

	it('orders Highest before High', () => {
		expect(cmp(makeMatrixTask({ priority: '🔺' }), makeMatrixTask({ priority: '⏫' }))).toBeLessThan(0);
	});

	it('orders any priority before no priority', () => {
		expect(cmp(makeMatrixTask({ priority: '⏬' }), makeMatrixTask({ priority: undefined }))).toBeLessThan(0);
	});

	it('treats equal priorities as equal', () => {
		expect(cmp(makeMatrixTask({ priority: '🔼' }), makeMatrixTask({ priority: '🔼' }))).toBe(0);
	});
});

describe('compareFn — dueDate', () => {
	const cmp = compareFn('dueDate');

	it('orders earlier date before later date', () => {
		expect(cmp(makeMatrixTask({ dueDate: daysFromToday(0) }), makeMatrixTask({ dueDate: daysFromToday(5) }))).toBeLessThan(0);
	});

	it('orders any date before no date', () => {
		expect(cmp(makeMatrixTask({ dueDate: daysFromToday(10) }), makeMatrixTask({ dueDate: undefined }))).toBeLessThan(0);
	});

	it('treats two undated tasks as equal', () => {
		expect(cmp(makeMatrixTask({ dueDate: undefined }), makeMatrixTask({ dueDate: undefined }))).toBe(0);
	});
});

describe('compareFn — alpha', () => {
	const cmp = compareFn('alpha');

	it('orders alphabetically, ignoring the checkbox prefix', () => {
		expect(cmp(makeMatrixTask({ line: '- [ ] Apple task' }), makeMatrixTask({ line: '- [ ] Banana task' }))).toBeLessThan(0);
	});

	it('is case-insensitive', () => {
		expect(cmp(makeMatrixTask({ line: '- [ ] apple' }), makeMatrixTask({ line: '- [ ] Banana' }))).toBeLessThan(0);
	});
});

// ---------------------------------------------------------------------------
// sortTasks
// ---------------------------------------------------------------------------

describe('sortTasks', () => {
	it('sorts by primary field, falling back to secondary on ties', () => {
		const sort: QuadrantSort = { primary: 'priority', secondary: 'dueDate' };
		const tasks = [
			makeMatrixTask({ priority: '🔺', dueDate: daysFromToday(5), line: '- [ ] later' }),
			makeMatrixTask({ priority: '🔺', dueDate: daysFromToday(1), line: '- [ ] sooner' }),
			makeMatrixTask({ priority: '⏬', dueDate: daysFromToday(0), line: '- [ ] low prio' }),
		];
		expect(sortTasks(tasks, sort).map((t) => t.line)).toEqual([
			'- [ ] sooner', '- [ ] later', '- [ ] low prio',
		]);
	});

	it('does not mutate the input array', () => {
		const tasks = [makeMatrixTask({ line: '- [ ] b' }), makeMatrixTask({ line: '- [ ] a' })];
		const original = [...tasks];
		sortTasks(tasks, { primary: 'alpha', secondary: 'priority' });
		expect(tasks).toEqual(original);
	});
});

// ---------------------------------------------------------------------------
// groupKey / groupLabel / groupOrder
// ---------------------------------------------------------------------------

describe('groupKey — priority field', () => {
	it('returns the priority emoji when present', () => {
		expect(groupKey(makeMatrixTask({ priority: '🔺' }), 'priority')).toBe('🔺');
	});

	it('returns "__none__" when no priority', () => {
		expect(groupKey(makeMatrixTask({ priority: undefined }), 'priority')).toBe('__none__');
	});
});

describe('groupKey — dueDate field', () => {
	it('buckets overdue tasks', () => {
		expect(groupKey(makeMatrixTask({ dueDate: daysFromToday(-1) }), 'dueDate')).toBe('__overdue__');
	});

	it('buckets tasks due today', () => {
		expect(groupKey(makeMatrixTask({ dueDate: daysFromToday(0) }), 'dueDate')).toBe('__today__');
	});

	it('buckets tasks due later than 14 days as __later__', () => {
		expect(groupKey(makeMatrixTask({ dueDate: daysFromToday(30) }), 'dueDate')).toBe('__later__');
	});

	it('buckets undated tasks as __nodate__', () => {
		expect(groupKey(makeMatrixTask({ dueDate: undefined }), 'dueDate')).toBe('__nodate__');
	});
});

describe('groupKey — alpha field', () => {
	it('returns the uppercased first letter, ignoring the checkbox prefix', () => {
		expect(groupKey(makeMatrixTask({ line: '- [ ] zebra task' }), 'alpha')).toBe('Z');
	});
});

describe('groupLabel', () => {
	it('maps "__none__" priority key to the no-priority label', () => {
		expect(groupLabel('__none__', 'priority')).toBeTruthy();
	});

	it('returns the priority emoji unchanged otherwise', () => {
		expect(groupLabel('🔺', 'priority')).toBe('🔺');
	});

	it('maps known dueDate bucket keys to labels', () => {
		expect(groupLabel('__overdue__', 'dueDate')).toBeTruthy();
		expect(groupLabel('__today__', 'dueDate')).toBeTruthy();
	});

	it('falls back to the raw key for alpha grouping', () => {
		expect(groupLabel('Z', 'alpha')).toBe('Z');
	});
});

describe('groupOrder', () => {
	it('orders priority groups by severity, with "__none__" last', () => {
		expect(['__none__', '🔺', '🔽'].sort(groupOrder('priority'))).toEqual(['🔺', '🔽', '__none__']);
	});

	it('orders dueDate buckets chronologically', () => {
		expect(['__nodate__', '__today__', '__overdue__'].sort(groupOrder('dueDate')))
			.toEqual(['__overdue__', '__today__', '__nodate__']);
	});

	it('orders alpha groups alphabetically', () => {
		expect(['B', 'A', 'C'].sort(groupOrder('alpha'))).toEqual(['A', 'B', 'C']);
	});
});

// ---------------------------------------------------------------------------
// dueBucket
// ---------------------------------------------------------------------------

describe('dueBucket', () => {
	it('returns "__nodate__" when there is no due date', () => {
		expect(dueBucket(makeMatrixTask({ dueDate: undefined }))).toBe('__nodate__');
	});

	it('returns "__overdue__" for a date in the past', () => {
		expect(dueBucket(makeMatrixTask({ dueDate: daysFromToday(-3) }))).toBe('__overdue__');
	});

	it('returns "__today__" for the current date', () => {
		expect(dueBucket(makeMatrixTask({ dueDate: daysFromToday(0) }))).toBe('__today__');
	});

	it('returns "__thisweek__" for the next 7 days', () => {
		for (const d of [1, 4, 7]) {
			expect(dueBucket(makeMatrixTask({ dueDate: daysFromToday(d) }))).toBe('__thisweek__');
		}
	});

	it('returns "__upcoming__" from 8 to 14 days out', () => {
		for (const d of [8, 14]) {
			expect(dueBucket(makeMatrixTask({ dueDate: daysFromToday(d) }))).toBe('__upcoming__');
		}
	});

	it('returns "__later__" for a date more than 14 days out', () => {
		expect(dueBucket(makeMatrixTask({ dueDate: daysFromToday(15) }))).toBe('__later__');
		expect(dueBucket(makeMatrixTask({ dueDate: daysFromToday(30) }))).toBe('__later__');
	});

	it('does not depend on the weekday: a task due tomorrow is always "__thisweek__"', () => {
		// Regression: the horizon used to end at the coming Sunday, which made the
		// bucket unreachable on Sundays (daysToSunday was 0), so "this week" was
		// always empty that day. The window is rolling now, so this holds any day.
		expect(dueBucket(makeMatrixTask({ dueDate: daysFromToday(1) }))).toBe('__thisweek__');
	});
});

// ---------------------------------------------------------------------------
// Timezone regression (issue #25) — a date parsed from a string is bucketed by
// its calendar day, not shifted by the UTC/local mismatch.
// ---------------------------------------------------------------------------

describe('dueBucket — timezone regression (#25)', () => {
	const localToday = (): string => {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	};

	it("buckets a task due today (parsed from its string date) as '__today__'", () => {
		const task = makeMatrixTask({ dueDate: parseIsoDate(localToday()) });
		expect(dueBucket(task)).toBe('__today__');
	});
});

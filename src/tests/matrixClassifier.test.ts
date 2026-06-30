import { describe, it, expect, beforeEach } from 'vitest';
import { classifyTasks, Quadrant } from '../matrixClassifier';
import { FokusFirstSettings, DEFAULT_SETTINGS } from '../settings';
import { TaskItem } from '../taskScanner';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysFromToday(offset: number): Date {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	d.setDate(d.getDate() + offset);
	return d;
}

function makeTask(overrides: Partial<TaskItem> = {}): TaskItem {
	return {
		file: { path: 'test.md', basename: 'test' } as never,
		line: '- [ ] Task',
		lineNumber: 0,
		completed: false,
		tags: [],
		...overrides,
	};
}

function makeSettings(overrides: Partial<FokusFirstSettings> = {}): FokusFirstSettings {
	return { ...DEFAULT_SETTINGS, ...overrides };
}

// ---------------------------------------------------------------------------
// Unit — isUrgent logic (via classify output)
// ---------------------------------------------------------------------------

describe('urgency classification', () => {
	const settings = makeSettings({ urgencyDays: 3, importantPriorities: [] });

	it('is urgent when due today', () => {
		const task = makeTask({ dueDate: daysFromToday(0) });
		const result = classifyTasks([task], settings);
		expect(result.delegate).toHaveLength(1); // urgent, not important
	});

	it('is urgent when overdue (past due)', () => {
		const task = makeTask({ dueDate: daysFromToday(-5) });
		const result = classifyTasks([task], settings);
		expect(result.delegate).toHaveLength(1);
	});

	it('is urgent when due within threshold', () => {
		const task = makeTask({ dueDate: daysFromToday(3) });
		const result = classifyTasks([task], settings);
		expect(result.delegate).toHaveLength(1);
	});

	it('is NOT urgent when due just beyond threshold', () => {
		const task = makeTask({ dueDate: daysFromToday(4) });
		const result = classifyTasks([task], settings);
		expect(result.eliminate).toHaveLength(1);
	});

	it('is NOT urgent when no due date', () => {
		const task = makeTask();
		const result = classifyTasks([task], settings);
		expect(result.eliminate).toHaveLength(1);
	});

	it('respects urgencyDays = 0 (only overdue tasks are urgent)', () => {
		const s = makeSettings({ urgencyDays: 0, importantPriorities: [] });
		const overdue = makeTask({ dueDate: daysFromToday(-1) });
		const dueToday = makeTask({ dueDate: daysFromToday(0) });
		const future = makeTask({ dueDate: daysFromToday(1) });
		const result = classifyTasks([overdue, dueToday, future], s);
		expect(result.delegate).toHaveLength(2); // overdue + today (diff = 0 <= 0)
		expect(result.eliminate).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// Unit — isImportant logic
// ---------------------------------------------------------------------------

describe('importance classification', () => {
	const settings = makeSettings({ urgencyDays: 0, importantPriorities: ['🔺', '⏫'] });

	it('is important when priority is in importantPriorities', () => {
		const task = makeTask({ priority: '🔺' });
		const result = classifyTasks([task], settings);
		expect(result.schedule).toHaveLength(1); // not urgent, important
	});

	it('is important for all configured priorities', () => {
		const high = makeTask({ priority: '⏫' });
		const result = classifyTasks([high], settings);
		expect(result.schedule).toHaveLength(1);
	});

	it('is NOT important when priority not in list', () => {
		const task = makeTask({ priority: '🔽' });
		const result = classifyTasks([task], settings);
		expect(result.eliminate).toHaveLength(1);
	});

	it('is NOT important when no priority', () => {
		const task = makeTask();
		const result = classifyTasks([task], settings);
		expect(result.eliminate).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// Unit — all four quadrant combinations
// ---------------------------------------------------------------------------

describe('quadrant assignment', () => {
	const settings = makeSettings({ urgencyDays: 3, importantPriorities: ['🔺', '⏫'] });

	it('Q1 Do — urgent + important', () => {
		const task = makeTask({ dueDate: daysFromToday(1), priority: '🔺' });
		const result = classifyTasks([task], settings);
		expect(result.do).toHaveLength(1);
		expect(result.do[0]?.quadrant).toBe('do');
	});

	it('Q2 Schedule — not urgent + important', () => {
		const task = makeTask({ dueDate: daysFromToday(10), priority: '⏫' });
		const result = classifyTasks([task], settings);
		expect(result.schedule).toHaveLength(1);
		expect(result.schedule[0]?.quadrant).toBe('schedule');
	});

	it('Q3 Delegate — urgent + not important', () => {
		const task = makeTask({ dueDate: daysFromToday(2), priority: '🔽' });
		const result = classifyTasks([task], settings);
		expect(result.delegate).toHaveLength(1);
		expect(result.delegate[0]?.quadrant).toBe('delegate');
	});

	it('Q4 Eliminate — not urgent + not important', () => {
		const task = makeTask({ dueDate: daysFromToday(30) });
		const result = classifyTasks([task], settings);
		expect(result.eliminate).toHaveLength(1);
		expect(result.eliminate[0]?.quadrant).toBe('eliminate');
	});
});

// ---------------------------------------------------------------------------
// Unit — tag override
// ---------------------------------------------------------------------------

describe('manual tag override', () => {
	const settings = makeSettings({
		urgencyDays: 3,
		importantPriorities: ['🔺'],
	});

	it('tag overrides auto-classification to "do"', () => {
		// Without tag this would be eliminate (no date, no priority)
		const task = makeTask({ tags: ['#do'] });
		const result = classifyTasks([task], settings);
		expect(result.do).toHaveLength(1);
		expect(result.do[0]?.manual).toBe(true);
	});

	it('tag overrides auto-classification to "schedule"', () => {
		const task = makeTask({ tags: ['#schedule'] });
		const result = classifyTasks([task], settings);
		expect(result.schedule).toHaveLength(1);
		expect(result.schedule[0]?.manual).toBe(true);
	});

	it('tag overrides auto-classification to "delegate"', () => {
		const task = makeTask({ tags: ['#delegate'] });
		const result = classifyTasks([task], settings);
		expect(result.delegate).toHaveLength(1);
		expect(result.delegate[0]?.manual).toBe(true);
	});

	it('tag overrides auto-classification to "eliminate"', () => {
		const task = makeTask({ tags: ['#eliminate'] });
		const result = classifyTasks([task], settings);
		expect(result.eliminate).toHaveLength(1);
		expect(result.eliminate[0]?.manual).toBe(true);
	});

	it('tag takes precedence over matching priority + date', () => {
		// This would auto-classify as "do" but tag says "eliminate"
		const task = makeTask({ dueDate: daysFromToday(1), priority: '🔺', tags: ['#eliminate'] });
		const result = classifyTasks([task], settings);
		expect(result.eliminate).toHaveLength(1);
		expect(result.do).toHaveLength(0);
	});

	it('tag matching is case-insensitive', () => {
		const task = makeTask({ tags: ['#DO'] });
		const result = classifyTasks([task], settings);
		expect(result.do).toHaveLength(1);
	});

	it('unknown tag does not override — falls back to auto', () => {
		const task = makeTask({ tags: ['#someothertag'] });
		const result = classifyTasks([task], settings);
		expect(result.eliminate).toHaveLength(1);
		expect(result.eliminate[0]?.manual).toBe(false);
	});

	it('first matching tag wins when task has multiple tags', () => {
		const task = makeTask({ tags: ['#do', '#schedule'] });
		const result = classifyTasks([task], settings);
		expect(result.do).toHaveLength(1);
		expect(result.schedule).toHaveLength(0);
	});

	it('manual flag is false for auto-classified tasks', () => {
		const task = makeTask({ dueDate: daysFromToday(1), priority: '🔺' });
		const result = classifyTasks([task], settings);
		expect(result.do[0]?.manual).toBe(false);
	});

	it('empty tag string in settings does not match untagged tasks', () => {
		const s = makeSettings({ quadrants: { ...DEFAULT_SETTINGS.quadrants, do: { ...DEFAULT_SETTINGS.quadrants.do, tag: '' } } });
		const task = makeTask({ tags: [] });
		const result = classifyTasks([task], s);
		expect(result.eliminate).toHaveLength(1);
		expect(result.eliminate[0]?.manual).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Integration — completed tasks are excluded
// ---------------------------------------------------------------------------

describe('completed task handling', () => {
	const settings = makeSettings();

	it('excludes completed tasks from all quadrants', () => {
		const done = makeTask({ completed: true, dueDate: daysFromToday(0), priority: '🔺' });
		const result = classifyTasks([done], settings);
		const total = result.do.length + result.schedule.length + result.delegate.length + result.eliminate.length;
		expect(total).toBe(0);
	});

	it('includes open tasks and excludes completed ones', () => {
		const open = makeTask({ dueDate: daysFromToday(0), priority: '🔺' });
		const done = makeTask({ completed: true, dueDate: daysFromToday(0), priority: '🔺' });
		const result = classifyTasks([open, done], settings);
		expect(result.do).toHaveLength(1);
	});

	it('excludes cancelled tasks (completed: true covers all non-open states)', () => {
		// The scanner sets completed=true for any non-space checkbox char (x, X, -, /, etc.)
		const cancelled = makeTask({ completed: true });
		const result = classifyTasks([cancelled], settings);
		const total = result.do.length + result.schedule.length + result.delegate.length + result.eliminate.length;
		expect(total).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Integration — mixed task list
// ---------------------------------------------------------------------------

describe('mixed task list', () => {
	let settings: FokusFirstSettings;

	beforeEach(() => {
		settings = makeSettings({
			urgencyDays: 3,
			importantPriorities: ['🔺', '⏫'],
		});
	});

	it('distributes tasks across all four quadrants', () => {
		const tasks: TaskItem[] = [
			makeTask({ dueDate: daysFromToday(1), priority: '🔺' }),           // do
			makeTask({ dueDate: daysFromToday(10), priority: '⏫' }),           // schedule
			makeTask({ dueDate: daysFromToday(2) }),                            // delegate
			makeTask({ dueDate: daysFromToday(20) }),                           // eliminate
		];
		const result = classifyTasks(tasks, settings);
		expect(result.do).toHaveLength(1);
		expect(result.schedule).toHaveLength(1);
		expect(result.delegate).toHaveLength(1);
		expect(result.eliminate).toHaveLength(1);
	});

	it('total task count matches input (minus completed)', () => {
		const tasks: TaskItem[] = [
			makeTask({ dueDate: daysFromToday(1), priority: '🔺' }),
			makeTask({ dueDate: daysFromToday(10), priority: '⏫' }),
			makeTask({ tags: ['#delegate'] }),
			makeTask({ completed: true }),
		];
		const result = classifyTasks(tasks, settings);
		const total = result.do.length + result.schedule.length + result.delegate.length + result.eliminate.length;
		expect(total).toBe(3);
	});

	it('empty input returns empty quadrants', () => {
		const result = classifyTasks([], settings);
		expect(result.do).toHaveLength(0);
		expect(result.schedule).toHaveLength(0);
		expect(result.delegate).toHaveLength(0);
		expect(result.eliminate).toHaveLength(0);
	});

	it('tasks with custom tag configuration use the configured tag values', () => {
		const s = makeSettings({
			quadrants: {
				do:       { ...DEFAULT_SETTINGS.quadrants.do,       tag: '#jetzt' },
				schedule: { ...DEFAULT_SETTINGS.quadrants.schedule, tag: '#bald' },
				delegate: { ...DEFAULT_SETTINGS.quadrants.delegate, tag: '#delegieren' },
				eliminate:{ ...DEFAULT_SETTINGS.quadrants.eliminate,tag: '#irgendwann' },
			},
		});
		const task = makeTask({ tags: ['#jetzt'] });
		const result = classifyTasks([task], s);
		expect(result.do).toHaveLength(1);
		expect(result.do[0]?.manual).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Unit — quadrant label on MatrixTask
// ---------------------------------------------------------------------------

describe('MatrixTask shape', () => {
	const settings = makeSettings({ urgencyDays: 3, importantPriorities: ['🔺'] });

	it('preserves all original TaskItem fields', () => {
		const task = makeTask({ dueDate: daysFromToday(1), priority: '🔺', tags: ['#work'] });
		const result = classifyTasks([task], settings);
		const mt = result.do[0];
		expect(mt?.dueDate).toEqual(task.dueDate);
		expect(mt?.priority).toBe('🔺');
		expect(mt?.tags).toContain('#work');
		expect(mt?.line).toBe(task.line);
	});

	it('each quadrant key matches the Quadrant type', () => {
		const quadrantKeys: Quadrant[] = ['do', 'schedule', 'delegate', 'eliminate'];
		for (const key of quadrantKeys) {
			const task = makeTask({ tags: [`#${key}`] });
			const result = classifyTasks([task], settings);
			expect(result[key][0]?.quadrant).toBe(key);
		}
	});
});

import { describe, it, expect, beforeEach } from 'vitest';
import { classifyTasks, explainTask, Quadrant, isUnclassified, matchesTriageFilter } from '../matrixClassifier';
import { FocusFirstSettings, DEFAULT_SETTINGS } from '../settings';
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

function makeSettings(overrides: Partial<FocusFirstSettings> = {}): FocusFirstSettings {
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
	let settings: FocusFirstSettings;

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

// ---------------------------------------------------------------------------
// explainTask() — the "why here" reason
// ---------------------------------------------------------------------------

describe('explainTask()', () => {
	const settings = makeSettings({ urgencyDays: 3, importantPriorities: ['🔺', '⏫'] });

	it('reports no due date and no priority', () => {
		const r = explainTask(makeTask(), settings);
		expect(r.urgent).toBe(false);
		expect(r.urgencyCause).toBe('no-due');
		expect(r.important).toBe(false);
		expect(r.priority).toBeUndefined();
		expect(r.override).toBeUndefined();
	});

	it('reports overdue with a negative day count and an important priority', () => {
		const r = explainTask(makeTask({ dueDate: daysFromToday(-5), priority: '🔺' }), settings);
		expect(r.urgent).toBe(true);
		expect(r.urgencyCause).toBe('overdue');
		expect(r.daysUntilDue).toBe(-5);
		expect(r.important).toBe(true);
	});

	it('reports due today', () => {
		const r = explainTask(makeTask({ dueDate: daysFromToday(0) }), settings);
		expect(r.urgencyCause).toBe('due-today');
		expect(r.urgent).toBe(true);
	});

	it('reports within-threshold for a due date inside the urgency window', () => {
		const r = explainTask(makeTask({ dueDate: daysFromToday(2) }), settings);
		expect(r.urgencyCause).toBe('within-threshold');
		expect(r.daysUntilDue).toBe(2);
		expect(r.urgent).toBe(true);
	});

	it('reports beyond-threshold (not urgent) for a due date past the window', () => {
		const r = explainTask(makeTask({ dueDate: daysFromToday(10) }), settings);
		expect(r.urgencyCause).toBe('beyond-threshold');
		expect(r.urgent).toBe(false);
	});

	it('reports a priority that is not in the important list', () => {
		const r = explainTask(makeTask({ priority: '🔽' }), settings);
		expect(r.important).toBe(false);
		expect(r.priority).toBe('🔽');
	});

	it('reports a manual override tag', () => {
		const r = explainTask(makeTask({ tags: ['#do'] }), settings);
		expect(r.override).toBe('do');
	});
});

// ---------------------------------------------------------------------------
// Value/Effort matrix (#36)
// ---------------------------------------------------------------------------

describe('value/effort classification', () => {
	const ve = (overrides: Partial<FocusFirstSettings> = {}): FocusFirstSettings =>
		makeSettings({ axisMode: 'valueEffort', importantPriorities: ['🔺', '⏫'], lowEffortSizes: ['small'], ...overrides });

	it('high value (priority source) + low effort (small) → Quick Wins (do slot)', () => {
		const task = makeTask({ priority: '🔺', size: 'small' });
		const result = classifyTasks([task], ve());
		expect(result.do).toHaveLength(1);
		expect(result.do[0]?.manual).toBe(false);
	});

	it('high value + high effort → Big Bets (schedule slot)', () => {
		const task = makeTask({ priority: '🔺', size: 'large' });
		expect(classifyTasks([task], ve()).schedule).toHaveLength(1);
	});

	it('low value + low effort → Fill-ins (delegate slot)', () => {
		const task = makeTask({ priority: '🔽', size: 'small' });
		expect(classifyTasks([task], ve()).delegate).toHaveLength(1);
	});

	it('low value + high effort → Time Sinks (eliminate slot)', () => {
		const task = makeTask({ priority: '🔽', size: 'large' });
		expect(classifyTasks([task], ve()).eliminate).toHaveLength(1);
	});

	it('un-sized tasks count as high effort (never Quick Wins)', () => {
		const task = makeTask({ priority: '🔺' }); // no size
		const result = classifyTasks([task], ve());
		expect(result.do).toHaveLength(0);
		expect(result.schedule).toHaveLength(1); // high value, high effort
	});

	it('#highvalue overrides the value source', () => {
		const task = makeTask({ priority: '🔽', size: 'small', tags: ['#highvalue'] });
		expect(classifyTasks([task], ve()).do).toHaveLength(1); // high value + low effort
	});

	it('#lowvalue overrides the value source', () => {
		const task = makeTask({ priority: '🔺', size: 'small', tags: ['#lowvalue'] });
		expect(classifyTasks([task], ve()).delegate).toHaveLength(1); // low value + low effort
	});

	it('manualTag source: value comes only from #highvalue, not priority', () => {
		const s = ve({ valueSource: 'manualTag' });
		expect(classifyTasks([makeTask({ priority: '🔺', size: 'small' })], s).delegate).toHaveLength(1); // low value
		expect(classifyTasks([makeTask({ size: 'small', tags: ['#highvalue'] })], s).do).toHaveLength(1);
	});

	it('the low-effort threshold is configurable (small + medium)', () => {
		const s = ve({ lowEffortSizes: ['small', 'medium'] });
		expect(classifyTasks([makeTask({ priority: '🔺', size: 'medium' })], s).do).toHaveLength(1);
	});

	it('Eisenhower quadrant tags do NOT override in value/effort mode', () => {
		// #do would pin to "do" under Eisenhower; here it is just an ignored tag.
		const task = makeTask({ priority: '🔽', size: 'large', tags: ['#do'] });
		expect(classifyTasks([task], ve()).eliminate).toHaveLength(1);
	});

	it('explainTask reports value/effort reasons in value/effort mode', () => {
		const r = explainTask(makeTask({ priority: '🔺', size: 'small' }), ve());
		expect(r.mode).toBe('valueEffort');
		expect(r.highValue).toBe(true);
		expect(r.valueCause).toBe('priority');
		expect(r.lowEffort).toBe(true);
		expect(r.override).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// isUnclassified / matchesTriageFilter (triage view)
// ---------------------------------------------------------------------------

describe('isUnclassified', () => {
	it('Eisenhower: a task with neither a date nor a priority is unclassified', () => {
		expect(isUnclassified(makeTask(), makeSettings(), 'eisenhower')).toBe(true);
	});

	it('Eisenhower: a due date alone is not enough, importance is still missing', () => {
		expect(isUnclassified(makeTask({ dueDate: daysFromToday(30) }), makeSettings(), 'eisenhower')).toBe(true);
	});

	it('Eisenhower: a priority alone is not enough, urgency is still missing', () => {
		expect(isUnclassified(makeTask({ priority: '⏬' }), makeSettings(), 'eisenhower')).toBe(true);
	});

	it('Eisenhower: a due date AND a priority together are classified', () => {
		expect(isUnclassified(makeTask({ dueDate: daysFromToday(3), priority: '🔺' }), makeSettings(), 'eisenhower')).toBe(false);
	});

	it('Eisenhower: a quadrant override tag fills both axes at once', () => {
		expect(isUnclassified(makeTask({ tags: ['#do'] }), makeSettings(), 'eisenhower')).toBe(false);
	});

	it('Value/Effort: no value and no size is unclassified', () => {
		expect(isUnclassified(makeTask(), makeSettings(), 'valueEffort')).toBe(true);
	});

	it('Value/Effort: a size alone is not enough, value is still missing', () => {
		expect(isUnclassified(makeTask({ size: 'small' }), makeSettings(), 'valueEffort')).toBe(true);
	});

	it('Value/Effort: a value tag alone is not enough, effort is still missing', () => {
		expect(isUnclassified(makeTask({ tags: ['#highvalue'] }), makeSettings(), 'valueEffort')).toBe(true);
	});

	it('Value/Effort: a value (or priority-as-value) plus a size is classified', () => {
		expect(isUnclassified(makeTask({ tags: ['#highvalue'], size: 'small' }), makeSettings(), 'valueEffort')).toBe(false);
		expect(isUnclassified(makeTask({ priority: '🔺', size: 'large' }), makeSettings({ valueSource: 'priority' }), 'valueEffort')).toBe(false);
	});

	it('Value/Effort: with manualTag as the value source, a priority does not fill the value axis', () => {
		expect(isUnclassified(makeTask({ priority: '🔺', size: 'small' }), makeSettings({ valueSource: 'manualTag' }), 'valueEffort')).toBe(true);
	});
});

describe('matchesTriageFilter', () => {
	const s = makeSettings();

	it('"both" is the union: a task appears until all four axes are filled', () => {
		// Dated + prioritised: complete for Eisenhower, but has no value or size, so it is
		// still incomplete for Value/Effort and therefore still in the Unclassified list.
		const halfDone = makeTask({ dueDate: daysFromToday(3), priority: '🔺' });
		expect(matchesTriageFilter(halfDone, s, 'eisenhower')).toBe(false);
		expect(matchesTriageFilter(halfDone, s, 'valueEffort')).toBe(true);
		expect(matchesTriageFilter(halfDone, s, 'both')).toBe(true);
	});

	it('"both" excludes a task once every axis has a signal', () => {
		// Priority fills importance AND (as value source) value; date fills urgency;
		// size fills effort, all four covered.
		const complete = makeTask({ dueDate: daysFromToday(3), priority: '🔺', size: 'small' });
		expect(matchesTriageFilter(complete, s, 'both')).toBe(false);
	});

	it('"both" matches a task no system knows anything about', () => {
		expect(matchesTriageFilter(makeTask(), s, 'both')).toBe(true);
	});
});

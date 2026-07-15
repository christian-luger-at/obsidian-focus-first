import { MatrixTask } from './matrixClassifier';
import { TaskItem } from './taskScanner';
import { QuadrantSort, SortField } from './settings';
import { daysBetween } from './dateUtils';
import { t } from './i18n';

/** Priority signifiers from most to least important; anything else sorts last. */
export const PRIORITY_ORDER = ['🔺', '⏫', '🔼', '🔽', '⏬'];

/** Strips the checkbox prefix so titles compare/group on their actual text. */
function taskText(task: TaskItem): string {
	return task.line.replace(/^[\s\-*]*\[.\]\s*/, '');
}

/** A comparator for a single sort field (used as primary or secondary key). */
export function compareFn(field: SortField): (a: MatrixTask, b: MatrixTask) => number {
	switch (field) {
		case 'priority':
			return (a, b) => {
				const ai = a.priority ? PRIORITY_ORDER.indexOf(a.priority) : 99;
				const bi = b.priority ? PRIORITY_ORDER.indexOf(b.priority) : 99;
				return ai - bi;
			};
		case 'dueDate':
			return (a, b) => {
				if (!a.dueDate && !b.dueDate) return 0;
				if (!a.dueDate) return 1;
				if (!b.dueDate) return -1;
				return a.dueDate.getTime() - b.dueDate.getTime();
			};
		case 'alpha':
			return (a, b) => taskText(a).toLowerCase().localeCompare(taskText(b).toLowerCase());
	}
}

/** Sorts by the primary field, breaking ties with the secondary. Pure (copies input). */
export function sortTasks(tasks: MatrixTask[], sort: QuadrantSort): MatrixTask[] {
	const fns = [compareFn(sort.primary), compareFn(sort.secondary)];
	return [...tasks].sort((a, b) => {
		for (const fn of fns) {
			const r = fn(a, b);
			if (r !== 0) return r;
		}
		return 0;
	});
}

/**
 * Every bucket `dueBucket` can return. Exported so the date filter is forced to
 * cover all of them: typing this as a plain string once let `__later__` fall
 * through the filter, hiding those tasks with no way to get them back.
 */
export type DueBucket =
	| '__overdue__'
	| '__today__'
	| '__thisweek__'
	| '__upcoming__'
	| '__later__'
	| '__nodate__';

/**
 * The due-date bucket a task falls into. Shared by the date filter and the
 * dueDate grouping, so both stay in sync.
 *
 * The horizons are rolling, not calendar-based: an earlier version ended
 * "this week" at the coming Sunday, which made the bucket unreachable on
 * Sundays (nothing can be due after today but before the end of the day).
 * Rolling windows also match the sibling bucket, which has always been
 * "next 14 days".
 */
export function dueBucket(task: TaskItem): DueBucket {
	if (!task.dueDate) return '__nodate__';
	const diff = daysBetween(new Date(), task.dueDate);
	if (diff < 0) return '__overdue__';
	if (diff === 0) return '__today__';
	if (diff <= 7) return '__thisweek__';
	if (diff <= 14) return '__upcoming__';
	return '__later__';
}

/** The grouping key for a task under a given field. */
export function groupKey(task: MatrixTask, field: SortField): string {
	switch (field) {
		case 'priority':
			return task.priority ?? '__none__';
		case 'dueDate':
			return dueBucket(task);
		case 'alpha':
			return taskText(task).trim().charAt(0).toUpperCase() || '#';
	}
}

/** The human-readable label for a group key. */
export function groupLabel(key: string, field: SortField): string {
	const g = t().groups;
	if (field === 'priority') {
		return key === '__none__' ? String(g.noPriority) : key;
	}
	if (field === 'dueDate') {
		const map: Record<string, string> = {
			'__overdue__':  String(g.overdue),
			'__today__':    String(g.today),
			'__thisweek__': String(g.thisWeek),
			'__upcoming__': String(g.upcoming),
			'__later__':    String(g.later),
			'__nodate__':   String(g.noDate),
		};
		return map[key] ?? key;
	}
	return key;
}

/** A comparator that orders group keys sensibly for the given field. */
export function groupOrder(field: SortField): (a: string, b: string) => number {
	if (field === 'priority') {
		const order = [...PRIORITY_ORDER, '__none__'];
		return (a, b) => order.indexOf(a) - order.indexOf(b);
	}
	if (field === 'dueDate') {
		const order = ['__overdue__', '__today__', '__thisweek__', '__upcoming__', '__later__', '__nodate__'];
		return (a, b) => order.indexOf(a) - order.indexOf(b);
	}
	return (a, b) => a.localeCompare(b);
}

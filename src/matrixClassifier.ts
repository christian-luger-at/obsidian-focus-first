import { FocusFirstSettings, QuadrantConfig } from './settings';
import { TaskItem } from './taskScanner';
import { daysBetween } from './dateUtils';

export type Quadrant = 'do' | 'schedule' | 'delegate' | 'eliminate';

export interface MatrixTask extends TaskItem {
	quadrant: Quadrant;
	manual: boolean; // true = placed by tag, false = auto-classified
}

export interface MatrixQuadrants {
	do: MatrixTask[];        // urgent + important
	schedule: MatrixTask[];  // not urgent + important
	delegate: MatrixTask[];  // urgent + not important
	eliminate: MatrixTask[]; // not urgent + not important
}

export type UrgencyCause = 'no-due' | 'overdue' | 'due-today' | 'within-threshold' | 'beyond-threshold';

/** The reason a task lands where it does — derived from the same logic that classifies. */
export interface ClassificationReason {
	override?: Quadrant;          // set when a manual quadrant tag placed it
	urgent: boolean;
	urgencyCause: UrgencyCause;
	daysUntilDue?: number;        // present when the task has a due date (negative = overdue)
	important: boolean;
	priority?: string;            // the task's priority signifier, if any
}

/** Urgency plus the reason for it, computed once and reused everywhere. */
function urgency(task: TaskItem, urgencyDays: number): { urgent: boolean; cause: UrgencyCause; days?: number } {
	if (!task.dueDate) return { urgent: false, cause: 'no-due' };
	const days = daysBetween(new Date(), task.dueDate);
	if (days < 0)             return { urgent: true, cause: 'overdue', days };
	if (days === 0)           return { urgent: true, cause: 'due-today', days };
	if (days <= urgencyDays)  return { urgent: true, cause: 'within-threshold', days };
	return { urgent: false, cause: 'beyond-threshold', days };
}

function isImportant(task: TaskItem, settings: FocusFirstSettings): boolean {
	if (!task.priority) return false;
	return settings.importantPriorities.includes(task.priority);
}

/** Explains why a task is (or would be) placed where it is. Reuses the classify logic. */
export function explainTask(task: TaskItem, settings: FocusFirstSettings): ClassificationReason {
	const override = tagOverride(task, settings.quadrants);
	const u = urgency(task, settings.urgencyDays);
	return {
		override,
		urgent: u.urgent,
		urgencyCause: u.cause,
		daysUntilDue: u.days,
		important: isImportant(task, settings),
		priority: task.priority,
	};
}

function tagOverride(task: TaskItem, quadrants: QuadrantConfig): Quadrant | undefined {
	const keys = Object.keys(quadrants) as Quadrant[];
	for (const key of keys) {
		const tag = quadrants[key].tag.trim().toLowerCase();
		if (tag && task.tags.some((t) => t.toLowerCase() === tag)) {
			return key;
		}
	}
	return undefined;
}

export function classifyTasks(tasks: TaskItem[], settings: FocusFirstSettings): MatrixQuadrants {
	const quadrants: MatrixQuadrants = { do: [], schedule: [], delegate: [], eliminate: [] };

	for (const task of tasks) {
		if (task.completed) continue;

		const manual = tagOverride(task, settings.quadrants);
		let quadrant: Quadrant;

		if (manual) {
			quadrant = manual;
		} else {
			const urgent = urgency(task, settings.urgencyDays).urgent;
			const important = isImportant(task, settings);
			if (urgent && important)       quadrant = 'do';
			else if (!urgent && important) quadrant = 'schedule';
			else if (urgent && !important) quadrant = 'delegate';
			else                           quadrant = 'eliminate';
		}

		quadrants[quadrant].push({ ...task, quadrant, manual: manual !== undefined });
	}

	return quadrants;
}

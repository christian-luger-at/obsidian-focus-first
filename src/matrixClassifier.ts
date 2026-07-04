import { FocusFirstSettings, QuadrantConfig } from './settings';
import { TaskItem } from './taskScanner';

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

function isUrgent(task: TaskItem, urgencyDays: number): boolean {
	if (!task.dueDate) return false;
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const due = new Date(task.dueDate);
	due.setHours(0, 0, 0, 0);
	const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
	return diffDays <= urgencyDays;
}

function isImportant(task: TaskItem, settings: FocusFirstSettings): boolean {
	if (!task.priority) return false;
	return settings.importantPriorities.includes(task.priority);
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
			const urgent = isUrgent(task, settings.urgencyDays);
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

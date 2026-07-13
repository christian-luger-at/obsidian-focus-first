import { FocusFirstSettings, QuadrantConfig, AxisMode, TaskSize } from './settings';
import { TaskItem } from './taskScanner';
import { daysBetween } from './dateUtils';

// The four positional slots of the 2×2 grid. Their names come from Eisenhower,
// but they are reused for the Value/Effort matrix (#36): the same slots are just
// relabelled — do↔Quick Wins, schedule↔Big Bets, delegate↔Fill-ins,
// eliminate↔Time Sinks — so all slot infrastructure (colours, sort, positions)
// carries over unchanged.
export type Quadrant = 'do' | 'schedule' | 'delegate' | 'eliminate';

export interface MatrixTask extends TaskItem {
	quadrant: Quadrant;
	manual: boolean; // true = placed by tag, false = auto-classified
}

export interface MatrixQuadrants {
	do: MatrixTask[];        // vertical + horizontal  (important+urgent / high-value+low-effort)
	schedule: MatrixTask[];  // vertical + !horizontal (important / high-value+high-effort)
	delegate: MatrixTask[];  // !vertical + horizontal (urgent / low-value+low-effort)
	eliminate: MatrixTask[]; // !vertical + !horizontal
}

export type UrgencyCause = 'no-due' | 'overdue' | 'due-today' | 'within-threshold' | 'beyond-threshold';

/** How the Value axis resolved a task's value (Value/Effort matrix). */
export type ValueCause = 'tag-high' | 'tag-low' | 'priority' | 'no-tag';

/** The reason a task lands where it does — derived from the same logic that classifies. */
export interface ClassificationReason {
	mode: AxisMode;
	override?: Quadrant;          // set when a manual quadrant tag placed it (Eisenhower only)
	// Eisenhower axes
	urgent: boolean;
	urgencyCause: UrgencyCause;
	daysUntilDue?: number;        // present when the task has a due date (negative = overdue)
	important: boolean;
	priority?: string;            // the task's priority signifier, if any
	// Value/Effort axes
	highValue: boolean;
	valueCause: ValueCause;
	lowEffort: boolean;
	size?: TaskSize;              // the task's size, if any (undefined = un-sized → high effort)
}

/** Maps the two binary axes onto a positional slot (shared by both presets). */
function slotFor(vertical: boolean, horizontal: boolean): Quadrant {
	if (vertical) return horizontal ? 'do' : 'schedule';
	return horizontal ? 'delegate' : 'eliminate';
}

/**
 * Resolves a task's value for the Value axis: the override tags always win, then
 * the configured source (priority as an importance proxy, or nothing but the
 * high-value tag). Due date is deliberately never a value source (#36).
 */
export function resolveValue(task: TaskItem, settings: FocusFirstSettings): { highValue: boolean; cause: ValueCause } {
	const high = settings.highValueTag.trim().toLowerCase();
	const low = settings.lowValueTag.trim().toLowerCase();
	const tags = task.tags.map((t) => t.toLowerCase());
	if (high && tags.includes(high)) return { highValue: true, cause: 'tag-high' };
	if (low && tags.includes(low)) return { highValue: false, cause: 'tag-low' };
	if (settings.valueSource === 'priority') return { highValue: isImportant(task, settings), cause: 'priority' };
	return { highValue: false, cause: 'no-tag' };
}

/** Low effort = the task's size is one of the configured low-effort sizes. Un-sized → high effort (#36). */
export function isLowEffort(task: TaskItem, settings: FocusFirstSettings): boolean {
	return task.size !== undefined && settings.lowEffortSizes.includes(task.size);
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
	// A manual quadrant tag only overrides in the Eisenhower preset (#36 v1 skips
	// quadrant override tags for Value/Effort).
	const override = settings.axisMode === 'eisenhower' ? tagOverride(task, settings.quadrants) : undefined;
	const u = urgency(task, settings.urgencyDays);
	const value = resolveValue(task, settings);
	return {
		mode: settings.axisMode,
		override,
		urgent: u.urgent,
		urgencyCause: u.cause,
		daysUntilDue: u.days,
		important: isImportant(task, settings),
		priority: task.priority,
		highValue: value.highValue,
		valueCause: value.cause,
		lowEffort: isLowEffort(task, settings),
		size: task.size,
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

		let quadrant: Quadrant;
		let manual = false;

		if (settings.axisMode === 'valueEffort') {
			// Value/Effort: vertical = value, horizontal = low effort. No quadrant
			// override tags in v1 (#36); the value override lives on the value axis.
			quadrant = slotFor(resolveValue(task, settings).highValue, isLowEffort(task, settings));
		} else {
			const override = tagOverride(task, settings.quadrants);
			if (override) {
				quadrant = override;
				manual = true;
			} else {
				// Eisenhower: vertical = important, horizontal = urgent.
				quadrant = slotFor(isImportant(task, settings), urgency(task, settings.urgencyDays).urgent);
			}
		}

		quadrants[quadrant].push({ ...task, quadrant, manual });
	}

	return quadrants;
}

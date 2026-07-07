import { App, TFile } from 'obsidian';
import { FocusFirstSettings, Priority } from './settings';

export interface TaskItem {
	file: TFile;
	line: string;
	lineNumber: number;
	completed: boolean;
	dueDate?: Date;
	startDate?: Date;
	scheduledDate?: Date;
	priority?: Priority;
	tags: string[];
}

// Matches Tasks-plugin due date: 📅 YYYY-MM-DD
const DUE_DATE_RE = /📅\s*(\d{4}-\d{2}-\d{2})/;
// Matches Tasks-plugin start date: 🛫 YYYY-MM-DD
const START_DATE_RE = /🛫\s*(\d{4}-\d{2}-\d{2})/;
// Matches Tasks-plugin scheduled date: ⏳ YYYY-MM-DD
const SCHEDULED_DATE_RE = /⏳\s*(\d{4}-\d{2}-\d{2})/;
// Matches Tasks-plugin priority emojis
const PRIORITY_RE = /(🔺|⏫|🔼|🔽|⏬)/;
// Matches Obsidian tags: #tag (no spaces, no #-only)
const TAG_RE = /#([^\s#][^\s]*)/g;

export async function scanTasks(app: App, settings: FocusFirstSettings): Promise<TaskItem[]> {
	const files = app.vault.getMarkdownFiles().filter((f) => {
		if (settings.taskScope === 'folder' && settings.taskFolder) {
			const folder = settings.taskFolder.endsWith('/')
				? settings.taskFolder
				: settings.taskFolder + '/';
			return f.path.startsWith(folder);
		}
		return true;
	});

	const results: TaskItem[] = [];

	for (const file of files) {
		const cache = app.metadataCache.getFileCache(file);
		const listItems = cache?.listItems;
		if (!listItems) continue;

		const taskItems = listItems.filter((item) => item.task !== undefined);
		if (taskItems.length === 0) continue;

		const content = await app.vault.cachedRead(file);
		const lines = content.split('\n');

		for (const item of taskItems) {
			const lineNumber = item.position.start.line;
			const line = lines[lineNumber] ?? '';

			const dueDateMatch = DUE_DATE_RE.exec(line);
			const dueDate = dueDateMatch?.[1] ? new Date(dueDateMatch[1]) : undefined;

			const startDateMatch = START_DATE_RE.exec(line);
			const startDate = startDateMatch?.[1] ? new Date(startDateMatch[1]) : undefined;

			const scheduledDateMatch = SCHEDULED_DATE_RE.exec(line);
			const scheduledDate = scheduledDateMatch?.[1] ? new Date(scheduledDateMatch[1]) : undefined;

			const priorityMatch = PRIORITY_RE.exec(line);
			const priority = priorityMatch?.[1] as Priority | undefined;

			const tags: string[] = [];
			let tagMatch: RegExpExecArray | null;
			TAG_RE.lastIndex = 0;
			while ((tagMatch = TAG_RE.exec(line)) !== null) {
				tags.push(`#${tagMatch[1]}`);
			}

			results.push({
				file,
				line,
				lineNumber,
				completed: item.task === 'x' || item.task === 'X' || item.task === '-',
				dueDate,
				startDate,
				scheduledDate,
				priority,
				tags,
			});
		}
	}

	return results;
}

/**
 * Whether a task is not actionable yet: its start (🛫) or scheduled (⏳) date is
 * after today. The due date is deliberately ignored here — it drives urgency and
 * classification, not "is this ready to work on".
 */
export function isFutureTask(task: TaskItem, now: Date = new Date()): boolean {
	const today = new Date(now);
	today.setHours(0, 0, 0, 0);
	const isAfterToday = (date?: Date): boolean => {
		if (!date) return false;
		const day = new Date(date);
		day.setHours(0, 0, 0, 0);
		return day.getTime() > today.getTime();
	};
	return isAfterToday(task.startDate) || isAfterToday(task.scheduledDate);
}

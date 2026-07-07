import { App, TFile, MarkdownView, Menu, Platform, setIcon } from 'obsidian';
import { MatrixTask } from './matrixClassifier';
import { TaskItem, isFutureTask } from './taskScanner';
import { FocusFirstSettings } from './settings';
import { getTasksApi } from './tasksPlugin';
import { setDueDate, shiftDueDate, setPriority, addDaysToIso } from './tasksFormat';
import { t } from './i18n';

/**
 * Shared task-item rendering and the vault-mutating helpers behind its action
 * buttons. Kept separate from FocusFirstView so the rendering only needs
 * `app` + `settings` rather than the view/leaf.
 */

export function makeTaskDraggable(li: HTMLElement, task: MatrixTask): void {
	li.draggable = true;
	li.addEventListener('dragstart', (e) => {
		e.dataTransfer?.setData('application/json', JSON.stringify({
			filePath: task.file.path,
			lineNumber: task.lineNumber,
			quadrant: task.quadrant,
		}));
		li.classList.add('is-dragging');
	});
	li.addEventListener('dragend', () => {
		li.classList.remove('is-dragging');
	});
}

export async function openTaskFile(app: App, task: TaskItem): Promise<void> {
	const leaf = app.workspace.getLeaf(false);
	await leaf.openFile(task.file);
	const view = leaf.view;
	if (view instanceof MarkdownView) {
		view.editor.setCursor({ line: task.lineNumber, ch: 0 });
		view.editor.scrollIntoView(
			{ from: { line: task.lineNumber, ch: 0 }, to: { line: task.lineNumber, ch: 0 } },
			true,
		);
	}
}

/**
 * Removes every occurrence of a tag (together with its leading whitespace) from
 * a line, case-insensitively, leaving the rest of the line's whitespace — in
 * particular any leading indentation of nested tasks — untouched.
 */
export function removeTagFromLine(line: string, tag: string): string {
	const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return line.replace(new RegExp(`\\s*${escaped}(?=\\s|$)`, 'gi'), '');
}

// The date signifiers a created date (➕) sorts before, per the Tasks plugin's
// canonical order (start, scheduled, due, cancelled, done).
const DATE_SIGNIFIER_RE = /[🛫⏳📅❌✅]/u;

function formatDate(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

/**
 * Adds a `➕ <today>` created date to a task line, matching what the Tasks plugin
 * writes on a newly generated recurrence instance. No-op if the line already has
 * a created date. Placed before the first other date signifier (canonical order)
 * so it reads like a native Tasks line; indentation is preserved.
 */
function withCreatedDate(line: string, today: string): string {
	if (line.includes('➕')) return line;
	const created = `➕ ${today}`;
	const match = DATE_SIGNIFIER_RE.exec(line);
	if (match) {
		return `${line.slice(0, match.index)}${created} ${line.slice(match.index)}`;
	}
	return `${line.trimEnd()} ${created}`;
}

export async function completeTaskLine(
	app: App,
	filePath: string,
	lineNumber: number,
	now: Date = new Date(),
): Promise<void> {
	const file = app.vault.getAbstractFileByPath(filePath);
	if (!(file instanceof TFile)) return;
	const content = await app.vault.read(file);
	const lines = content.split('\n');
	const line = lines[lineNumber];
	if (line === undefined) return;

	// Delegate to the Tasks plugin when it's available: it applies the user's
	// done-date/status settings and, for recurring (🔁) tasks, generates the next
	// occurrence. The result can be multiple lines, so splice it in. Without the
	// plugin, 🔁 has no engine anyway — just flip the checkbox as before.
	const api = getTasksApi(app);
	if (api) {
		const today = formatDate(now);
		// The newly generated next occurrence is the still-open `[ ]` line; give it
		// a created date like the Tasks plugin does. The completed line is left as-is.
		const replacement = api.executeToggleTaskDoneCommand(line, filePath)
			.split('\n')
			.map((l) => (/^\s*[-*+] \[ \]/.test(l) ? withCreatedDate(l, today) : l));
		lines.splice(lineNumber, 1, ...replacement);
	} else {
		lines[lineNumber] = line.replace(/\[\s\]/, '[x]');
	}
	await app.vault.modify(file, lines.join('\n'));
}

/**
 * Reads a file, applies `transform` to a single task line, and writes it back —
 * the shared read-modify-write behind the inline task edits. Skips the write if
 * the transform leaves the line unchanged.
 */
export async function updateTaskLine(
	app: App,
	filePath: string,
	lineNumber: number,
	transform: (line: string) => string,
): Promise<void> {
	const file = app.vault.getAbstractFileByPath(filePath);
	if (!(file instanceof TFile)) return;
	const content = await app.vault.read(file);
	const lines = content.split('\n');
	const line = lines[lineNumber];
	if (line === undefined) return;
	const next = transform(line);
	if (next === line) return;
	lines[lineNumber] = next;
	await app.vault.modify(file, lines.join('\n'));
}

export async function toggleFocusTagLine(
	app: App,
	settings: FocusFirstSettings,
	filePath: string,
	lineNumber: number,
	focusTag: string,
	add: boolean,
): Promise<void> {
	const file = app.vault.getAbstractFileByPath(filePath);
	if (!(file instanceof TFile)) return;
	const content = await app.vault.read(file);
	const lines = content.split('\n');
	const line = lines[lineNumber];
	if (line === undefined) return;
	if (add) {
		lines[lineNumber] = line.trimEnd() + ' ' + settings.focusTag;
	} else {
		lines[lineNumber] = removeTagFromLine(line, focusTag);
	}
	await app.vault.modify(file, lines.join('\n'));
}

export async function toggleHideTagLine(
	app: App,
	settings: FocusFirstSettings,
	filePath: string,
	lineNumber: number,
	hideTag: string,
): Promise<void> {
	const file = app.vault.getAbstractFileByPath(filePath);
	if (!(file instanceof TFile)) return;
	const content = await app.vault.read(file);
	const lines = content.split('\n');
	const line = lines[lineNumber];
	if (line === undefined) return;
	const already = line.split(/\s+/).some((token) => token.toLowerCase() === hideTag);
	if (already) {
		lines[lineNumber] = removeTagFromLine(line, hideTag);
	} else {
		lines[lineNumber] = line.trimEnd() + ' ' + settings.hideTag;
	}
	await app.vault.modify(file, lines.join('\n'));
}

/**
 * Renders one interactive task row (title, hover meta, and the top-right action
 * overlay with done / focus / hide buttons). Identical markup for the matrix,
 * the focus section, and the embedded code block.
 */
export function renderTaskItem(
	parent: HTMLElement,
	task: MatrixTask,
	app: App,
	settings: FocusFirstSettings,
): void {
	const focusTag = settings.focusTag.trim().toLowerCase();
	const isFocused = focusTag
		? task.tags.some((tag) => tag.toLowerCase() === focusTag)
		: false;
	const hideTag = settings.hideTag.trim().toLowerCase();
	// "Future" tasks (start/scheduled date ahead) are dimmed when that mode is on.
	const isFuture = settings.futureTasks === 'dim' && isFutureTask(task);
	const li = parent.createEl('li', {
		cls: `focus-first-task-item${isFocused ? ' is-focused' : ''}${isFuture ? ' is-future' : ''}`,
	});
	makeTaskDraggable(li, task);

	const text = task.line
		.replace(/^[\s\-*]*\[.\]\s*/, '')
		.replace(/(🔺|⏫|🔼|🔽|⏬)\s*/g, '')
		.replace(/📅\s*\d{4}-\d{2}-\d{2}/g, '')
		.replace(/#\S+/g, '')
		.trim();

	// Keyboard navigation (issue #11): each item is a selectable option carrying
	// its file/line so the view's handler can act on it. tabindex is managed by
	// the view's roving-selection logic.
	li.setAttribute('role', 'option');
	li.setAttribute('aria-label', text);
	li.setAttribute('tabindex', '-1');
	li.setAttribute('data-file-path', task.file.path);
	li.setAttribute('data-line', String(task.lineNumber));

	// Title — always visible
	const titleEl = li.createEl('span', { text, cls: 'focus-first-task-text' });
	titleEl.addEventListener('click', () => { void openTaskFile(app, task); });

	// Hover panel — visible only on hover via CSS
	const hover = li.createDiv({ cls: 'focus-first-task-hover' });
	const hoverInner = hover.createDiv({ cls: 'focus-first-task-hover-inner' });

	// Meta row inside hover panel
	const meta = hoverInner.createDiv({ cls: 'focus-first-task-meta' });
	if (task.priority) meta.createEl('span', { text: task.priority, cls: 'focus-first-task-priority' });
	if (task.dueDate) {
		meta.createEl('span', {
			text: `📅 ${task.dueDate.toLocaleDateString()}`,
			cls: 'focus-first-task-due',
		});
	}
	for (const tag of task.tags) {
		meta.createEl('span', { text: tag, cls: 'focus-first-task-tag' });
	}
	meta.createEl('span', { text: task.file.basename, cls: 'focus-first-task-source' });

	// Action toolbar — appended last so it sits below the whole row (title + meta),
	// revealed on hover via CSS. Buttons are appended below.
	const actions = li.createDiv({ cls: 'focus-first-task-actions' });

	const focusRun = focusTag
		? () => void toggleFocusTagLine(app, settings, task.file.path, task.lineNumber, focusTag, !isFocused)
		: null;
	const hideRun = hideTag
		? () => void toggleHideTagLine(app, settings, task.file.path, task.lineNumber, hideTag)
		: null;

	// Done stays a single-tap button on every platform.
	const doneBtn = actionButton(actions, 'check', String(t().view.focusDone));
	doneBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		void completeTaskLine(app, task.file.path, task.lineNumber);
	});

	if (Platform.isMobile) {
		// Mobile has no hover and little width: collapse everything except Done
		// behind a single overflow (⋯) menu so the row stays at two finger-sized
		// targets. Postpone/priority become submenus of that menu.
		const moreBtn = actionButton(actions, 'more-horizontal', String(t().view.actions.more), 'focus-first-more-btn');
		moreBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			const va = t().view.actions;
			const menu = new Menu();
			if (focusRun) {
				menu.addItem((item) => item
					.setTitle(String(isFocused ? t().view.focusRemove : t().view.focusAdd))
					.setIcon('star').onClick(focusRun));
			}
			if (hideRun) {
				menu.addItem((item) => item.setTitle(String(t().view.hideTask)).setIcon('eye-off').onClick(hideRun));
			}
			// Submenus aren't in the typed public API, so flatten the two groups
			// under non-clickable section labels instead.
			menu.addSeparator();
			menu.addItem((item) => item.setTitle(String(va.postpone)).setIsLabel(true));
			buildPostponeMenu(menu, task, app);
			menu.addSeparator();
			menu.addItem((item) => item.setTitle(String(va.priority)).setIsLabel(true));
			buildPriorityMenu(menu, task, app);
			menu.showAtMouseEvent(e);
		});
		return;
	}

	// Desktop: the full icon row, revealed on hover.
	if (focusRun) {
		const focusBtn = actionButton(actions, 'star',
			String(isFocused ? t().view.focusRemove : t().view.focusAdd),
			isFocused ? 'is-active' : '');
		focusBtn.addEventListener('click', (e) => { e.stopPropagation(); focusRun(); });
	}
	if (hideRun) {
		const hideBtn = actionButton(actions, 'eye-off', String(t().view.hideTask));
		hideBtn.addEventListener('click', (e) => { e.stopPropagation(); hideRun(); });
	}

	const postponeBtn = actionButton(actions, 'calendar-clock', String(t().view.actions.postpone), 'focus-first-postpone-btn');
	postponeBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		const menu = new Menu();
		buildPostponeMenu(menu, task, app);
		menu.showAtMouseEvent(e);
	});

	const priorityBtn = actionButton(actions, 'flag', String(t().view.actions.priority), 'focus-first-priority-btn');
	priorityBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		const menu = new Menu();
		buildPriorityMenu(menu, task, app);
		menu.showAtMouseEvent(e);
	});
}

/** Creates one action button (icon + aria-label) in the actions row. */
function actionButton(parent: HTMLElement, icon: string, ariaLabel: string, extraCls = ''): HTMLElement {
	const btn = parent.createEl('button', { cls: `focus-first-task-btn${extraCls ? ` ${extraCls}` : ''}` });
	setIcon(btn, icon);
	btn.setAttribute('aria-label', ariaLabel);
	return btn;
}

/** Populates a menu with the postpone (reschedule) options for a task. */
function buildPostponeMenu(menu: Menu, task: MatrixTask, app: App): void {
	const a = t().view.actions;
	const edit = (transform: (line: string) => string) =>
		void updateTaskLine(app, task.file.path, task.lineNumber, transform);
	if (task.dueDate) {
		menu.addItem((item) => item.setTitle(String(a.postponePlusDay)).setIcon('chevron-right')
			.onClick(() => edit((l) => shiftDueDate(l, 1))));
		menu.addItem((item) => item.setTitle(String(a.postponePlusWeek)).setIcon('chevrons-right')
			.onClick(() => edit((l) => shiftDueDate(l, 7))));
	} else {
		const today = formatDate(new Date());
		menu.addItem((item) => item.setTitle(String(a.dueToday)).setIcon('calendar')
			.onClick(() => edit((l) => setDueDate(l, today))));
		menu.addItem((item) => item.setTitle(String(a.dueTomorrow)).setIcon('calendar')
			.onClick(() => edit((l) => setDueDate(l, addDaysToIso(today, 1)))));
	}
}

/** Populates a menu with the priority options for a task. */
function buildPriorityMenu(menu: Menu, task: MatrixTask, app: App): void {
	const a = t().view.actions;
	const options: { emoji: string | null; label: string }[] = [
		{ emoji: '🔺', label: String(a.priorityHighest) },
		{ emoji: '⏫', label: String(a.priorityHigh) },
		{ emoji: '🔼', label: String(a.priorityMedium) },
		{ emoji: '🔽', label: String(a.priorityLow) },
		{ emoji: '⏬', label: String(a.priorityLowest) },
		{ emoji: null, label: String(a.priorityNone) },
	];
	for (const opt of options) {
		menu.addItem((item) => item
			.setTitle(opt.label)
			.setChecked(task.priority === (opt.emoji ?? undefined))
			.onClick(() => void updateTaskLine(
				app, task.file.path, task.lineNumber, (l) => setPriority(l, opt.emoji),
			)));
	}
}

import { App, TFile, MarkdownView, Menu, setIcon } from 'obsidian';
import { MatrixTask, ClassificationReason, explainTask } from './matrixClassifier';
import { TaskItem, isFutureTask } from './taskScanner';
import { FocusFirstSettings, Priority, TaskSize, sizeTagList } from './settings';
import { getTasksApi } from './tasksPlugin';
import { setDueDate, shiftDueDate, setPriority, setStartDate, addDaysToIso, setSize } from './tasksFormat';
import { EditSnapshot, showUndoNotice } from './undo';
import { t } from './i18n';

/** Runs a mutating action and, if it changed anything, shows an undo toast (#32). */
function undoable(app: App, label: string, edit: Promise<EditSnapshot | undefined>): void {
	void edit.then((snap) => showUndoNotice(app, label, snap));
}

/**
 * Shared task-item rendering and the vault-mutating helpers behind its action
 * buttons. Kept separate from FocusFirstView so the rendering only needs
 * `app` + `settings` rather than the view/leaf.
 */

/** The five Tasks-plugin priorities with their localised labels, in order. */
function priorityOptions(): { emoji: Priority; label: string }[] {
	const a = t().view.actions;
	return [
		{ emoji: '🔺', label: String(a.priorityHighest) },
		{ emoji: '⏫', label: String(a.priorityHigh) },
		{ emoji: '🔼', label: String(a.priorityMedium) },
		{ emoji: '🔽', label: String(a.priorityLow) },
		{ emoji: '⏬', label: String(a.priorityLowest) },
	];
}

export function makeTaskDraggable(li: HTMLElement, task: MatrixTask): void {
	li.draggable = true;
	li.addEventListener('dragstart', (e) => {
		e.dataTransfer?.setData('application/json', JSON.stringify({
			filePath: task.file.path,
			lineNumber: task.lineNumber,
			quadrant: task.quadrant,
			line: task.line,
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

/** Appends `tag` to a line unless it's already present (case-insensitive). */
function addTagToLine(line: string, tag: string): string {
	const has = line.split(/\s+/).some((token) => token.toLowerCase() === tag.toLowerCase());
	return has ? line : `${line.replace(/[ \t]+$/, '')} ${tag}`;
}

/** ISO date of the next Monday after `from` (a week away when `from` is Monday). */
function nextMondayIso(from: Date): string {
	const daysUntilMonday = ((8 - from.getDay()) % 7) || 7;
	return addDaysToIso(formatDate(from), daysUntilMonday);
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
	expectedLine?: string,
): Promise<EditSnapshot | undefined> {
	const file = app.vault.getAbstractFileByPath(filePath);
	if (!(file instanceof TFile)) return;
	const content = await app.vault.read(file);
	const lines = content.split('\n');
	const line = lines[lineNumber];
	if (line === undefined) return;
	// Guard against a stale line number: if the note shifted since the view was
	// scanned, this line no longer matches the task the user acted on (#27).
	if (expectedLine !== undefined && line !== expectedLine) return;

	// Delegate to the Tasks plugin when it's available: it applies the user's
	// done-date/status settings and, for recurring (🔁) tasks, generates the next
	// occurrence. The result can be multiple lines. Without the plugin, 🔁 has no
	// engine anyway — just flip the checkbox as before.
	const flip = () => line.replace(/\[\s\]/, '[x]');
	const api = getTasksApi(app);
	let after: string[];
	if (api) {
		const raw = api.executeToggleTaskDoneCommand(line, filePath);
		// A blank result would splice an empty line in place of the task (#28);
		// fall back to a plain checkbox flip instead.
		if (raw.trim() === '') {
			after = [flip()];
		} else {
			const today = formatDate(now);
			// The newly generated next occurrence is the still-open `[ ]` line; give
			// it a created date like the Tasks plugin does. The completed line stays.
			after = raw.split('\n').map((l) => (/^\s*[-*+] \[ \]/.test(l) ? withCreatedDate(l, today) : l));
		}
	} else {
		after = [flip()];
	}
	lines.splice(lineNumber, 1, ...after);
	await app.vault.modify(file, lines.join('\n'));
	return { filePath, startLine: lineNumber, before: [line], after };
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
	expectedLine?: string,
): Promise<EditSnapshot | undefined> {
	const file = app.vault.getAbstractFileByPath(filePath);
	if (!(file instanceof TFile)) return;
	const content = await app.vault.read(file);
	const lines = content.split('\n');
	const line = lines[lineNumber];
	if (line === undefined) return;
	// Stale-line guard (#27): bail if the line no longer matches the acted-on task.
	if (expectedLine !== undefined && line !== expectedLine) return;
	const next = transform(line);
	if (next === line) return;
	lines[lineNumber] = next;
	await app.vault.modify(file, lines.join('\n'));
	return { filePath, startLine: lineNumber, before: [line], after: [next] };
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

/**
 * Strips a raw task line down to its display title: removes the checkbox marker,
 * priority signifiers, dated signifiers, and tags. Used both for rendering and
 * as the stable per-task key for the manual focus order (file path + title).
 */
export function taskTitle(line: string): string {
	return line
		.replace(/^[\s\-*]*\[.\]\s*/, '')
		.replace(/(🔺|⏫|🔼|🔽|⏬)\s*/g, '')
		// Strip all date signifiers (due, start, scheduled, created, cancelled,
		// done) with their dates so the title stays clean — they show in the popover.
		.replace(/[📅🛫⏳➕❌✅]\s*\d{4}-\d{2}-\d{2}/gu, '')
		.replace(/#\S+/g, '')
		.replace(/\s{2,}/g, ' ')
		.trim();
}

/**
 * Renders one interactive task row. The list shows only titles (each a link that
 * opens the note on a single click); hovering a row reveals a floating popover
 * with its metadata and actions, which disappears when the pointer leaves — so
 * the list stays clean and never reflows. Identical markup for the matrix, the
 * focus section, and the embedded code block. Returns the created <li> so callers
 * can wire extra behaviour (e.g. the focus reorder drop target).
 */
export function renderTaskItem(
	parent: HTMLElement,
	task: MatrixTask,
	app: App,
	settings: FocusFirstSettings,
	opts: { suppressWhyHere?: boolean; position?: number } = {},
): HTMLElement {
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

	const text = taskTitle(task.line);

	// Position number for the ordered focus shortlist (#34); #1 is the "frog".
	if (opts.position !== undefined) {
		li.createEl('span', { text: `${opts.position}.`, cls: 'focus-first-task-position' });
	}

	// Title — a link: a single click opens the note, like any other link. The list
	// is just titles; the detail popover opens on row hover (see below).
	const titleEl = li.createEl('span', { text, cls: 'focus-first-task-text' });
	titleEl.addEventListener('click', () => { void openTaskFile(app, task); });

	// Detail popover — the task metadata as aligned label/value rows (so it's calm
	// and easy to scan) plus the actions. The title isn't repeated here (it's right
	// there in the list). Hidden until the row is hovered; showTaskDetail floats it
	// next to the row.
	const detail = li.createDiv({ cls: 'focus-first-task-detail' });

	// Actions come first (top row), the metadata grid below.
	const actions = detail.createDiv({ cls: 'focus-first-task-actions' });

	const meta = detail.createDiv({ cls: 'focus-first-task-meta' });
	const labels = t().view.detail;
	const priorityNames: Record<string, string> = Object.fromEntries(
		priorityOptions().map((o) => [o.emoji, o.label]),
	);
	// Label + value are appended straight into the grid (grid-template-columns:
	// auto 1fr places them in the two columns), so no row wrapper is needed.
	const addRow = (label: string, build: (value: HTMLElement) => void): void => {
		meta.createDiv({ cls: 'focus-first-detail-label', text: label });
		build(meta.createDiv({ cls: 'focus-first-detail-value' }));
	};
	// Why-here reason first, so the automatic classification is transparent
	// (unless the user turned it off, or this is a focus task — a focus task is
	// here because of the #focus tag, not the quadrant logic, so the reason is
	// irrelevant there regardless of the setting, issue #31).
	if (settings.showWhyHere && !opts.suppressWhyHere) {
		addRow(String(labels.why), (v) => {
			v.setText(classificationReasonText(task, settings));
			v.addClass('focus-first-detail-why');
		});
	}
	const priority = task.priority;
	if (priority) addRow(String(labels.priority), (v) => v.setText(priorityNames[priority] ?? priority));
	if (task.size) addRow(String(labels.size), (v) => v.setText(sizeLabel(task.size!)));
	if (task.dueDate) {
		const due = task.dueDate;
		addRow(String(labels.due), (v) => { v.setText(due.toLocaleDateString()); v.addClass('focus-first-task-due'); });
	}
	if (task.startDate) {
		const start = task.startDate;
		addRow(String(labels.start), (v) => v.setText(start.toLocaleDateString()));
	}
	if (task.scheduledDate) {
		const scheduled = task.scheduledDate;
		addRow(String(labels.scheduled), (v) => v.setText(scheduled.toLocaleDateString()));
	}
	if (task.tags.length > 0) {
		addRow(String(labels.tags), (v) => {
			v.addClass('focus-first-task-tags');
			for (const tag of task.tags) v.createEl('span', { text: tag, cls: 'focus-first-task-tag' });
		});
	}
	addRow(String(labels.note), (v) => { v.setText(task.file.basename); v.addClass('focus-first-task-source'); });

	const focusRun = focusTag
		? () => void toggleFocusTagLine(app, settings, task.file.path, task.lineNumber, focusTag, !isFocused)
		: null;

	const doneBtn = actionButton(actions, 'check', String(t().view.focusDone), 'focus-first-done-btn');
	doneBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		undoable(app, String(t().view.undoLabels.completed),
			completeTaskLine(app, task.file.path, task.lineNumber, undefined, task.line));
	});

	if (focusRun) {
		const focusBtn = actionButton(actions, 'star',
			String(isFocused ? t().view.focusRemove : t().view.focusAdd),
			`focus-first-focus-btn${isFocused ? ' is-active' : ''}`);
		focusBtn.addEventListener('click', (e) => { e.stopPropagation(); focusRun(); });
	}
	if (hideTag) {
		const hideBtn = actionButton(actions, 'eye-off', String(t().view.hideTask), 'focus-first-hide-btn');
		hideBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			const menu = new Menu();
			buildHideMenu(menu, task, app, settings);
			menu.showAtMouseEvent(e);
		});
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

	// Size is only offered when the user has configured size tags (they can be
	// blanked out to opt out entirely).
	if (sizeTagList(settings).length > 0) {
		const sizeBtn = actionButton(actions, 'ruler', String(t().view.actions.size), 'focus-first-size-btn');
		sizeBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			const menu = new Menu();
			buildSizeMenu(menu, task, app, settings);
			menu.showAtMouseEvent(e);
		});
	}

	// Reveal the popover when the row is hovered. An open delay means it only
	// appears when you actually rest on a row (so it doesn't flicker while you scan
	// the list). A short hide delay plus the popover's own hover form a bridge so
	// you can move from the row into the popover to use its buttons.
	let hideTimer = 0;
	let showTimer = 0;
	let mouseX = 0;
	let mouseY = 0;
	const scheduleHide = () => {
		window.clearTimeout(showTimer);
		window.clearTimeout(hideTimer);
		hideTimer = window.setTimeout(() => hideTaskDetail(detail), 150);
	};
	const scheduleReveal = (e: MouseEvent) => {
		mouseX = e.clientX;
		mouseY = e.clientY;
		window.clearTimeout(hideTimer);
		window.clearTimeout(showTimer);
		showTimer = window.setTimeout(() => showTaskDetail(li, detail, mouseX, mouseY), 400);
	};
	li.addEventListener('mouseenter', scheduleReveal);
	li.addEventListener('mousemove', (e: MouseEvent) => { mouseX = e.clientX; mouseY = e.clientY; });
	li.addEventListener('mouseleave', scheduleHide);
	detail.addEventListener('mouseenter', () => { window.clearTimeout(hideTimer); });
	detail.addEventListener('mouseleave', scheduleHide);

	return li;
}

/**
 * One-line, localised reason a task sits in its quadrant, built from the same
 * classification logic (explainTask) so the explanation never drifts from the
 * placement. A manual quadrant tag short-circuits to an override message.
 */
function classificationReasonText(task: MatrixTask, settings: FocusFirstSettings): string {
	const d = t().view.detail;
	const r: ClassificationReason = explainTask(task, settings);
	if (r.override) {
		const tag = settings.quadrants[r.override].tag.trim();
		return String(d.whyOverride).replace('{tag}', tag);
	}
	const threshold = String(settings.urgencyDays);
	const days = r.daysUntilDue ?? 0;
	let urgencyText: string;
	switch (r.urgencyCause) {
		case 'overdue':          urgencyText = String(d.causeOverdue).replace('{days}', String(Math.abs(days))); break;
		case 'due-today':        urgencyText = String(d.causeToday); break;
		case 'within-threshold': urgencyText = String(d.causeWithin).replace('{days}', String(days)).replace('{threshold}', threshold); break;
		case 'beyond-threshold': urgencyText = String(d.causeBeyond).replace('{days}', String(days)).replace('{threshold}', threshold); break;
		default:                 urgencyText = String(d.causeNoDue); break;
	}
	let importanceText: string;
	if (r.important) importanceText = String(d.causePriority).replace('{priority}', r.priority ?? '');
	else if (r.priority) importanceText = String(d.causePriorityNotImportant).replace('{priority}', r.priority);
	else importanceText = String(d.causeNoPriority);
	const urgentPrefix = String(r.urgent ? d.whyUrgent : d.whyNotUrgent);
	const importantPrefix = String(r.important ? d.whyImportant : d.whyNotImportant);
	return `${urgentPrefix}: ${urgencyText} · ${importantPrefix}: ${importanceText}`;
}

/**
 * Shows the detail popover for a row. It's appended to the view root
 * (`.focus-first-view`) and positioned absolutely relative to it, so it floats
 * over the list without pushing rows (no reflow) and — crucially — isn't clipped
 * by the scrolling quadrant (unlike `position: fixed`, which Obsidian's
 * transformed pane ancestors break).
 *
 * It's placed next to the mouse cursor: to the right of it by default, flipping
 * to the left when there's no room on the right; vertically it starts at the
 * cursor and shifts up if it would overflow the bottom. Everything is clamped
 * inside the view. An open delay on the row hover keeps it from flickering while
 * scanning the list. No-op in non-DOM tests.
 */
function showTaskDetail(li: HTMLElement, detail: HTMLElement, mouseX: number, mouseY: number): void {
	if (typeof li.getBoundingClientRect !== 'function') return;
	const root = li.closest('.focus-first-view');
	if (!root) return;
	root.appendChild(detail);
	// The static "shown" styles live in the .is-open CSS class; only the
	// cursor-relative placement is dynamic, so it goes through CSS custom
	// properties (the one escape hatch the styling rules allow).
	detail.classList.add('is-open');
	const rootRect = root.getBoundingClientRect();
	detail.setCssProps({ '--ff-detail-max-width': `${Math.max(rootRect.width - 16, 160)}px` });
	const width = detail.offsetWidth;
	const height = detail.offsetHeight;
	const gap = 12;
	// Horizontal: right of the cursor, flipping left when it wouldn't fit; then
	// clamp inside the view.
	let left = mouseX + gap;
	if (left + width > rootRect.right) left = mouseX - gap - width;
	left = Math.max(rootRect.left, Math.min(left, rootRect.right - width)) - rootRect.left;
	// Vertical: start at the cursor, shift up if it would overflow the bottom.
	let top = mouseY;
	if (top + height > rootRect.bottom) top = rootRect.bottom - height;
	top = Math.max(rootRect.top, top) - rootRect.top;
	detail.setCssProps({ '--ff-detail-left': `${left}px`, '--ff-detail-top': `${top}px` });
}

function hideTaskDetail(detail: HTMLElement): void {
	detail.classList.remove('is-open');
	detail.remove();
}

/** Creates one action button (icon + aria-label) in the actions row. */
function actionButton(parent: HTMLElement, icon: string, ariaLabel: string, extraCls = ''): HTMLElement {
	const btn = parent.createEl('button', { cls: `focus-first-task-btn${extraCls ? ` ${extraCls}` : ''}` });
	setIcon(btn, icon);
	btn.setAttribute('aria-label', ariaLabel);
	return btn;
}

/**
 * Populates a menu with the hide options: hide indefinitely, or "hide until" a
 * date (adds the hide tag plus a future start date 🛫 so the task reappears on
 * its own — issue #23).
 */
function buildHideMenu(menu: Menu, task: MatrixTask, app: App, settings: FocusFirstSettings): void {
	const a = t().view.actions;
	const tag = settings.hideTag.trim();
	const today = formatDate(new Date());
	const edit = (transform: (line: string) => string) =>
		undoable(app, String(t().view.undoLabels.hidden),
			updateTaskLine(app, task.file.path, task.lineNumber, transform, task.line));
	const hideUntil = (iso: string) => (l: string) => addTagToLine(setStartDate(l, iso), tag);
	menu.addItem((item) => item.setTitle(String(t().view.hideTask)).setIcon('eye-off')
		.onClick(() => edit((l) => addTagToLine(l, tag))));
	menu.addItem((item) => item.setTitle(String(a.hideUntilTomorrow)).setIcon('chevron-right')
		.onClick(() => edit(hideUntil(addDaysToIso(today, 1)))));
	menu.addItem((item) => item.setTitle(String(a.hideUntilNextWeek)).setIcon('chevrons-right')
		.onClick(() => edit(hideUntil(addDaysToIso(today, 7)))));
	menu.addItem((item) => item.setTitle(String(a.hideUntilMonday)).setIcon('calendar')
		.onClick(() => edit(hideUntil(nextMondayIso(new Date())))));
}

/** Populates a menu with the postpone (reschedule) options for a task. */
function buildPostponeMenu(menu: Menu, task: MatrixTask, app: App): void {
	const a = t().view.actions;
	const edit = (transform: (line: string) => string) =>
		undoable(app, String(t().view.undoLabels.updated),
			updateTaskLine(app, task.file.path, task.lineNumber, transform, task.line));
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
	const options: { emoji: Priority | null; label: string }[] = [
		...priorityOptions(),
		{ emoji: null, label: String(t().view.actions.priorityNone) },
	];
	for (const opt of options) {
		menu.addItem((item) => item
			.setTitle(opt.label)
			.setChecked(task.priority === (opt.emoji ?? undefined))
			.onClick(() => undoable(app, String(t().view.undoLabels.updated),
				updateTaskLine(app, task.file.path, task.lineNumber, (l) => setPriority(l, opt.emoji), task.line))));
	}
}

/** Localised label for a task size. */
function sizeLabel(size: TaskSize): string {
	const a = t().view.actions;
	return String(size === 'small' ? a.sizeSmall : size === 'medium' ? a.sizeMedium : a.sizeLarge);
}

/** Populates a menu with the size options, writing the matching configured tag. */
function buildSizeMenu(menu: Menu, task: MatrixTask, app: App, settings: FocusFirstSettings): void {
	const allTags = sizeTagList(settings);
	const options: { size: TaskSize | null; tag: string | null; label: string }[] = [
		{ size: 'small', tag: settings.sizeTags.small.trim(), label: sizeLabel('small') },
		{ size: 'medium', tag: settings.sizeTags.medium.trim(), label: sizeLabel('medium') },
		{ size: 'large', tag: settings.sizeTags.large.trim(), label: sizeLabel('large') },
		{ size: null, tag: null, label: String(t().view.actions.sizeNone) },
	];
	for (const opt of options) {
		// Skip a bucket whose tag the user blanked out (nothing to write).
		if (opt.size !== null && !opt.tag) continue;
		menu.addItem((item) => item
			.setTitle(opt.label)
			.setChecked(task.size === (opt.size ?? undefined))
			.onClick(() => undoable(app, String(t().view.undoLabels.updated),
				updateTaskLine(app, task.file.path, task.lineNumber, (l) => setSize(l, opt.tag, allTags), task.line))));
	}
}

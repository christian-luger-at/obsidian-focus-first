import { App, TFile, MarkdownView, setIcon } from 'obsidian';
import { MatrixTask } from './matrixClassifier';
import { TaskItem } from './taskScanner';
import { FocusFirstSettings } from './settings';
import { getTasksApi } from './tasksPlugin';
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
	const li = parent.createEl('li', { cls: `focus-first-task-item${isFocused ? ' is-focused' : ''}` });
	makeTaskDraggable(li, task);

	const text = task.line
		.replace(/^[\s\-*]*\[.\]\s*/, '')
		.replace(/(🔺|⏫|🔼|🔽|⏬)\s*/g, '')
		.replace(/📅\s*\d{4}-\d{2}-\d{2}/g, '')
		.replace(/#\S+/g, '')
		.trim();

	// Title — always visible
	const titleEl = li.createEl('span', { text, cls: 'focus-first-task-text' });
	titleEl.addEventListener('click', () => { void openTaskFile(app, task); });

	// Action buttons — absolutely positioned top-right overlay so they sit at
	// the top of the item (title height), not down in the meta row. Revealed
	// on hover via CSS. Buttons are appended further below.
	const actions = li.createDiv({ cls: 'focus-first-task-actions' });

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

	const doneBtn = actions.createEl('button', { cls: 'focus-first-task-btn' });
	setIcon(doneBtn, 'check');
	doneBtn.setAttribute('aria-label', String(t().view.focusDone));
	doneBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		void completeTaskLine(app, task.file.path, task.lineNumber);
	});

	if (focusTag) {
		const focusBtn = actions.createEl('button', {
			cls: `focus-first-task-btn${isFocused ? ' is-active' : ''}`,
		});
		setIcon(focusBtn, 'star');
		focusBtn.setAttribute('aria-label', String(isFocused ? t().view.focusRemove : t().view.focusAdd));
		focusBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			void toggleFocusTagLine(app, settings, task.file.path, task.lineNumber, focusTag, !isFocused);
		});
	}

	if (hideTag) {
		const hideBtn = actions.createEl('button', { cls: 'focus-first-task-btn' });
		setIcon(hideBtn, 'eye-off');
		hideBtn.setAttribute('aria-label', String(t().view.hideTask));
		hideBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			void toggleHideTagLine(app, settings, task.file.path, task.lineNumber, hideTag);
		});
	}
}

import { App, TFile, MarkdownView, setIcon } from 'obsidian';
import { MatrixTask } from './matrixClassifier';
import { TaskItem } from './taskScanner';
import { FocusFirstSettings } from './settings';
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

export async function completeTaskLine(app: App, filePath: string, lineNumber: number): Promise<void> {
	const file = app.vault.getAbstractFileByPath(filePath);
	if (!(file instanceof TFile)) return;
	const content = await app.vault.read(file);
	const lines = content.split('\n');
	const line = lines[lineNumber];
	if (line === undefined) return;
	lines[lineNumber] = line.replace(/\[\s\]/, '[x]');
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

import { MarkdownRenderChild, debounce } from 'obsidian';
import FocusFirstPlugin from './main';
import { scanTasks, TaskItem } from './taskScanner';
import { classifyTasks } from './matrixClassifier';
import { completeTaskLine } from './taskRenderer';
import { FocusSection } from './focusSection';

export { isFocusSection } from './focusSection';
export type { FocusSection };

/**
 * Renders one Focus First data section (the focus list or a single quadrant)
 * inside a ```focus-first-tasks``` block with `show-focus`. It selects exactly the
 * same tasks the view would show for that section — using the shared
 * classifier — and presents them as a plain native checklist (same look as the
 * wrapped Tasks output). Re-renders on metadata changes to stay in sync.
 */
export class FocusDataBlock extends MarkdownRenderChild {
	private plugin: FocusFirstPlugin;
	private section: FocusSection;
	private emptyText: string;
	private debouncedRender = debounce(() => { void this.render(); }, 500, true);

	constructor(containerEl: HTMLElement, plugin: FocusFirstPlugin, section: FocusSection, emptyText: string) {
		super(containerEl);
		this.plugin = plugin;
		this.section = section;
		this.emptyText = emptyText;
	}

	onload(): void {
		this.containerEl.addClass('focus-first-tasks-wrapper');
		void this.render();
		this.registerEvent(
			this.plugin.app.metadataCache.on('changed', () => this.debouncedRender()),
		);
	}

	private async render(): Promise<void> {
		const el = this.containerEl;
		const tasks = await scanTasks(this.plugin.app, this.plugin.settings);
		const selected = this.select(tasks);

		el.empty();
		if (selected.length === 0) {
			if (this.emptyText) {
				el.createEl('p', { text: this.emptyText, cls: 'focus-first-tasks-empty' });
			}
			return;
		}

		const list = el.createEl('ul', { cls: 'contains-task-list focus-first-tasks-list' });
		for (const task of selected) {
			const li = list.createEl('li', { cls: 'task-list-item' });
			const checkbox = li.createEl('input', {
				cls: 'task-list-item-checkbox',
				attr: { type: 'checkbox' },
			});
			checkbox.addEventListener('click', (e) => {
				e.preventDefault();
				void completeTaskLine(this.plugin.app, task.file.path, task.lineNumber);
			});
			const desc = task.line.replace(/^[\s\-*]*\[.\]\s*/, '').trim();
			li.createEl('span', { text: desc, cls: 'focus-first-tasks-item-text' });
		}
	}

	/** Selects the same tasks the Focus First view shows for this section. */
	private select(tasks: TaskItem[]): TaskItem[] {
		const hideTag = this.plugin.settings.hideTag.trim().toLowerCase();
		const open = tasks.filter(
			(task) => !task.completed
				&& (!hideTag || !task.tags.some((tag) => tag.toLowerCase() === hideTag)),
		);

		if (this.section === 'focus') {
			const focusTag = this.plugin.settings.focusTag.trim().toLowerCase();
			if (!focusTag) return [];
			return open.filter((task) => task.tags.some((tag) => tag.toLowerCase() === focusTag));
		}

		return classifyTasks(open, this.plugin.settings)[this.section];
	}
}

import { MarkdownRenderChild, MarkdownRenderer, debounce } from 'obsidian';
import FocusFirstPlugin from './main';
import { scanTasks, TaskItem, isFutureTask, isHiddenTask } from './taskScanner';
import { classifyTasks } from './matrixClassifier';
import { completeTaskLine } from './taskRenderer';
import { canonicalizeTaskLine } from './tasksFormat';
import { FocusSection } from './focusSection';

export { isFocusSection } from './focusSection';
export type { FocusSection };

/**
 * Renders one Focus First data section (the focus list or a single quadrant)
 * inside a ```focus-first-tasks``` block with `show-focus`. It selects exactly
 * the same tasks the view would show for that section — using the shared
 * classifier — then renders their Markdown lines through Obsidian so they get
 * the same formatting as normal tasks (including the Tasks plugin's rendering,
 * when it is enabled). Re-renders on metadata changes to stay in sync.
 */
export class FocusDataBlock extends MarkdownRenderChild {
	private plugin: FocusFirstPlugin;
	private section: FocusSection;
	private emptyText: string;
	private sourcePath: string;
	private debouncedRender = debounce(() => { void this.render(); }, 500, true);

	constructor(
		containerEl: HTMLElement,
		plugin: FocusFirstPlugin,
		section: FocusSection,
		emptyText: string,
		sourcePath: string,
	) {
		super(containerEl);
		this.plugin = plugin;
		this.section = section;
		this.emptyText = emptyText;
		this.sourcePath = sourcePath;
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

		// Render the task lines as a Markdown checklist so Obsidian — and the Tasks
		// plugin, when enabled — format them like normal tasks. The metadata is
		// reordered into the Tasks plugin's canonical order first, so the output
		// matches a native ```tasks``` query.
		const markdown = selected.map((task) => canonicalizeTaskLine(task.line)).join('\n');
		const result = el.createDiv({ cls: 'focus-first-tasks-result' });
		await MarkdownRenderer.render(this.plugin.app, markdown, result, this.sourcePath, this);

		this.rewireCheckboxes(result, selected);
		this.appendBacklinks(result, selected);
	}

	/**
	 * The Markdown renderer formats the task lines like the Tasks plugin, but it
	 * doesn't add the source backlink the Tasks plugin appends to its own query
	 * results. Recreate that `(Document > Heading)` backlink so the output matches
	 * a normal Tasks query. Uses the same `tasks-backlink` markup for styling.
	 */
	private appendBacklinks(result: HTMLElement, selected: TaskItem[]): void {
		const items = result.querySelectorAll('.task-list-item');
		items.forEach((item, i) => {
			const task = selected[i];
			if (!task) return;

			const heading = this.precedingHeading(task);
			const linkText = heading ? `${task.file.basename} > ${heading}` : task.file.basename;
			const linkHref = heading ? `${task.file.path}#${heading}` : task.file.path;

			const backlink = item.createSpan({ cls: 'tasks-backlink' });
			backlink.appendText(' (');
			const link = backlink.createEl('a', {
				cls: 'internal-link',
				text: linkText,
				href: linkHref,
				attr: { 'data-href': linkHref, rel: 'noopener', target: '_blank' },
			});
			link.addEventListener('click', (evt) => {
				evt.preventDefault();
				void this.plugin.app.workspace.openLinkText(
					linkHref,
					this.sourcePath,
					evt.ctrlKey || evt.metaKey,
				);
			});
			backlink.appendText(')');
		});
	}

	/** The nearest heading at or above the task's line, or null if none. */
	private precedingHeading(task: TaskItem): string | null {
		const headings = this.plugin.app.metadataCache.getFileCache(task.file)?.headings;
		if (!headings || headings.length === 0) return null;
		let result: string | null = null;
		for (const heading of headings) {
			if (heading.position.start.line <= task.lineNumber) result = heading.heading;
			else break;
		}
		return result;
	}

	/**
	 * The checkboxes rendered above map to this code block, not to each task's
	 * real location, so toggling them would edit the wrong place. Re-wire each to
	 * complete the correct file/line instead (capture phase, so it wins over any
	 * handler the Tasks plugin attached).
	 */
	private rewireCheckboxes(result: HTMLElement, selected: TaskItem[]): void {
		const checkboxes = result.querySelectorAll('.task-list-item-checkbox');
		checkboxes.forEach((checkbox, i) => {
			const task = selected[i];
			if (!task) return;
			checkbox.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopImmediatePropagation();
				void completeTaskLine(this.plugin.app, task.file.path, task.lineNumber);
			}, { capture: true });
		});
	}

	/** Selects the same tasks the Focus First view shows for this section. */
	private select(tasks: TaskItem[]): TaskItem[] {
		const hideFuture = this.plugin.settings.futureTasks === 'hide';
		const open = tasks.filter(
			(task) => !task.completed
				&& !isHiddenTask(task, this.plugin.settings)
				&& (!hideFuture || !isFutureTask(task)),
		);

		if (this.section === 'focus') {
			const focusTag = this.plugin.settings.focusTag.trim().toLowerCase();
			if (!focusTag) return [];
			return open.filter((task) => task.tags.some((tag) => tag.toLowerCase() === focusTag));
		}

		return classifyTasks(open, this.plugin.settings)[this.section];
	}
}

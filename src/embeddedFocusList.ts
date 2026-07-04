import { MarkdownRenderChild, debounce } from 'obsidian';
import FocusFirstPlugin from './main';
import { scanTasks } from './taskScanner';
import { classifyTasks, MatrixTask, Quadrant } from './matrixClassifier';
import { renderTaskItem } from './taskRenderer';
import { t } from './i18n';

const QUADRANT_ORDER: Quadrant[] = ['do', 'schedule', 'delegate', 'eliminate'];

/**
 * Renders the focus-task list inside a ```focus-first``` code block in any note.
 * Reuses the same interactive task rows as the view (renderTaskItem) and
 * re-renders on metadata changes so it stays in sync, like the view does.
 */
export class EmbeddedFocusList extends MarkdownRenderChild {
	private plugin: FocusFirstPlugin;
	private debouncedRender = debounce(() => { void this.render(); }, 500, true);

	constructor(containerEl: HTMLElement, plugin: FocusFirstPlugin) {
		super(containerEl);
		this.plugin = plugin;
	}

	onload(): void {
		this.containerEl.addClass('focus-first-embed');
		this.containerEl.style.setProperty(
			'--focus-first-font-scale',
			String(this.plugin.settings.fontSize / 100),
		);
		void this.render();
		this.registerEvent(
			this.plugin.app.metadataCache.on('changed', () => this.debouncedRender()),
		);
	}

	private async render(): Promise<void> {
		const el = this.containerEl;
		const focusTag = this.plugin.settings.focusTag.trim().toLowerCase();

		if (!focusTag) {
			el.empty();
			this.renderHeader(el);
			el.createEl('p', { text: String(t().view.focusEmpty), cls: 'focus-first-embed-empty' });
			return;
		}

		const tasks = await scanTasks(this.plugin.app, this.plugin.settings);
		const hideTag = this.plugin.settings.hideTag.trim().toLowerCase();
		const focusTasks = tasks.filter(
			(task) => !task.completed
				&& task.tags.some((tag) => tag.toLowerCase() === focusTag)
				&& (!hideTag || !task.tags.some((tag) => tag.toLowerCase() === hideTag)),
		);

		el.empty();
		this.renderHeader(el, focusTasks.length);

		if (focusTasks.length === 0) {
			el.createEl('p', { text: String(t().view.focusEmpty), cls: 'focus-first-embed-empty' });
			return;
		}

		// Classify to attach the `quadrant` field renderTaskItem/drag rely on,
		// while keeping the original scan order.
		const byQuadrant = classifyTasks(focusTasks, this.plugin.settings);
		const matrixByKey = new Map<string, MatrixTask>();
		for (const q of QUADRANT_ORDER) {
			for (const mt of byQuadrant[q]) {
				matrixByKey.set(`${mt.file.path}:${mt.lineNumber}`, mt);
			}
		}

		const list = el.createEl('ul', { cls: 'focus-first-task-list' });
		for (const task of focusTasks) {
			const mt = matrixByKey.get(`${task.file.path}:${task.lineNumber}`);
			if (mt) renderTaskItem(list, mt, this.plugin.app, this.plugin.settings);
		}
	}

	private renderHeader(el: HTMLElement, count?: number): void {
		const header = el.createDiv({ cls: 'focus-first-embed-header' });
		header.createSpan({ text: String(t().view.focusSectionTitle), cls: 'focus-first-embed-title' });
		if (count !== undefined) {
			header.createSpan({ text: String(count), cls: 'focus-first-quadrant-count' });
		}
	}
}

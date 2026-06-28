import { ItemView, WorkspaceLeaf, MarkdownView, TFile, debounce } from 'obsidian';
import FocusFirstPlugin from './main';
import { scanTasks, TaskItem } from './taskScanner';
import { t } from './i18n';

export const FOCUS_FIRST_VIEW_TYPE = 'focus-first-view';

export class FocusFirstView extends ItemView {
	private plugin: FocusFirstPlugin;
	private tasks: TaskItem[] = [];
	private debouncedRefresh = debounce(() => this.refresh(), 500, true);

	constructor(leaf: WorkspaceLeaf, plugin: FocusFirstPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return FOCUS_FIRST_VIEW_TYPE;
	}

	getDisplayText(): string {
		return t().view.title;
	}

	getIcon(): string {
		return 'checkmark';
	}

	async onOpen(): Promise<void> {
		this.registerEvent(
			this.app.metadataCache.on('changed', (_file: TFile) => {
				this.debouncedRefresh();
			}),
		);
		await this.refresh();
	}

	async refresh(): Promise<void> {
		this.tasks = await scanTasks(this.app, this.plugin.settings);
		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		const header = contentEl.createDiv({ cls: 'focus-first-header' });
		header.createEl('h4', { text: t().view.title });

		const refreshBtn = header.createEl('button', { text: t().view.refresh });
		refreshBtn.addEventListener('click', () => { void this.refresh(); });

		const open = this.tasks.filter((t) => !t.completed);
		const done = this.tasks.filter((t) => t.completed);

		const scope =
			this.plugin.settings.taskScope === 'folder' && this.plugin.settings.taskFolder
				? this.plugin.settings.taskFolder
				: t().view.scopeAll;

		contentEl.createEl('p', {
			text: `${t().view.scope}: ${scope} · ${open.length} ${t().view.open}, ${done.length} ${t().view.done}`,
			cls: 'focus-first-meta',
		});

		if (open.length === 0) {
			contentEl.createEl('p', { text: t().view.empty, cls: 'focus-first-empty' });
			return;
		}

		const list = contentEl.createEl('ul', { cls: 'focus-first-task-list' });

		for (const task of open) {
			const li = list.createEl('li', { cls: 'focus-first-task-item' });

			const text = task.line.replace(/^[\s\-*]*\[.\]\s*/, '');

			const link = li.createEl('span', { text, cls: 'focus-first-task-text' });
			link.addEventListener('click', () => { void this.openTask(task); });

			li.createEl('span', {
				text: task.file.basename,
				cls: 'focus-first-task-source',
			});
		}
	}

	private async openTask(task: TaskItem): Promise<void> {
		const leaf = this.app.workspace.getLeaf(false);
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
}

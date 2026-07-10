import { Plugin, WorkspaceLeaf, Notice } from 'obsidian';
import {
	DEFAULT_SETTINGS,
	FocusFirstSettingTab,
	FocusFirstSettings,
} from './settings';
import { t } from './i18n';
import { FocusFirstView, FOCUS_FIRST_VIEW_TYPE } from './TaskView';
import { WrappedTasksBlock, parseTasksBlock } from './wrappedTasksBlock';
import { FocusDataBlock, isFocusSection } from './focusDataBlock';
import { QuickAddModal } from './quickAddModal';
import { InboxSetupModal } from './inboxSetupModal';
import { commitTask, isInboxConfigured } from './quickAdd';
import { getTasksCreateApi, TasksCreateApi } from './tasksPlugin';

export default class FocusFirstPlugin extends Plugin {
	settings!: FocusFirstSettings;

	async onload() {
		await this.loadSettings();

		this.registerView(
			FOCUS_FIRST_VIEW_TYPE,
			(leaf) => new FocusFirstView(leaf, this),
		);

		this.applyFontSize();

		this.addRibbonIcon('list-checks', t().ribbon.tooltip, async () => {
			await this.activateView();
		});

		this.addCommand({
			id: 'open-view',
			name: t().commands.openView.name,
			callback: async () => await this.activateView(),
		});

		this.addCommand({
			id: 'add-task',
			name: t().commands.addTask.name,
			callback: () => this.openQuickAdd(),
		});

		this.addSettingTab(new FocusFirstSettingTab(this.app, this));

		// A ```focus-first-tasks``` block either renders a Focus First data section
		// (`show-focus focus|do|schedule|delegate|eliminate`) or wraps a raw Tasks
		// query. Both support an `empty-text <message>` shown when nothing matches.
		this.registerMarkdownCodeBlockProcessor('focus-first-tasks', (source, el, ctx) => {
			const { showFocus, emptyText } = parseTasksBlock(source);
			if (showFocus) {
				if (isFocusSection(showFocus)) {
					ctx.addChild(new FocusDataBlock(el, this, showFocus, emptyText, ctx.sourcePath));
				} else {
					el.createEl('p', { text: t().tasksBlock.invalidShow, cls: 'focus-first-tasks-missing' });
				}
				return;
			}
			ctx.addChild(new WrappedTasksBlock(el, this, source, ctx.sourcePath));
		});
	}

	/**
	 * Captures a new task. When the Tasks plugin is enabled, uses its own create
	 * dialog (date/priority/recurrence pickers) and appends the result to the
	 * configured target. Otherwise falls back to a simple built-in dialog.
	 */
	openQuickAdd() {
		// On the first quick-add with no inbox configured, ask where tasks should
		// go (issue #24), then continue once the target is saved.
		if (!isInboxConfigured(this.settings)) {
			new InboxSetupModal(this, () => this.startQuickAdd()).open();
			return;
		}
		this.startQuickAdd();
	}

	private startQuickAdd() {
		const createApi = getTasksCreateApi(this.app);
		if (createApi) {
			void this.quickAddViaTasks(createApi);
		} else {
			new QuickAddModal(this).open();
		}
	}

	private async quickAddViaTasks(api: TasksCreateApi): Promise<void> {
		const line = await api.createTaskLineModal();
		const result = await commitTask(this.app, this.settings, line);
		if (result === 'no-target') {
			new Notice(t().quickAdd.noActiveNote);
			return;
		}
		if (result === 'empty') return; // cancelled or blank
		new Notice(t().quickAdd.addedNotice);
		this.refreshViews();
	}

	async activateView() {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null = null;
		const existing = workspace.getLeavesOfType(FOCUS_FIRST_VIEW_TYPE);

		if (existing.length > 0) {
			leaf = existing[0] ?? null;
		} else {
			leaf = workspace.getRightLeaf(false) ?? null;
			await leaf?.setViewState({ type: FOCUS_FIRST_VIEW_TYPE, active: true });
		}

		if (leaf) await workspace.revealLeaf(leaf);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<FocusFirstSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async resetSettings() {
		this.settings = structuredClone(DEFAULT_SETTINGS);
		await this.saveSettings();
		this.applyFontSize();
	}

	applyFontSize() {
		const scale = this.settings.fontSize / 100;
		for (const leaf of this.app.workspace.getLeavesOfType(FOCUS_FIRST_VIEW_TYPE)) {
			const view = leaf.view;
			if (view instanceof FocusFirstView) {
				view.contentEl.style.setProperty('--focus-first-font-scale', String(scale));
			}
		}
	}

	/** Re-renders every open Focus First view (used after a settings change). */
	refreshViews() {
		for (const leaf of this.app.workspace.getLeavesOfType(FOCUS_FIRST_VIEW_TYPE)) {
			const view = leaf.view;
			if (view instanceof FocusFirstView) {
				void view.refresh();
			}
		}
	}
}

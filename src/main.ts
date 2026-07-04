import { Plugin, WorkspaceLeaf } from 'obsidian';
import {
	DEFAULT_SETTINGS,
	FokusFirstSettingTab,
	FokusFirstSettings,
} from './settings';
import { t } from './i18n';
import { FocusFirstView, FOCUS_FIRST_VIEW_TYPE } from './TaskView';
import { WrappedTasksBlock, parseTasksBlock } from './wrappedTasksBlock';
import { FocusDataBlock, isFocusSection } from './focusDataBlock';

export default class FocusFirstPlugin extends Plugin {
	settings!: FokusFirstSettings;

	async onload() {
		await this.loadSettings();

		this.registerView(
			FOCUS_FIRST_VIEW_TYPE,
			(leaf) => new FocusFirstView(leaf, this),
		);

		this.applyFontSize();

		this.addRibbonIcon('checkmark', t().ribbon.tooltip, async () => {
			await this.activateView();
		});

		this.addCommand({
			id: 'open-focus-first',
			name: t().commands.openView.name,
			callback: async () => await this.activateView(),
		});

		this.addSettingTab(new FokusFirstSettingTab(this.app, this));

		// A ```focus-first-tasks``` block either renders a Focus First data section
		// (`show-focus focus|do|schedule|delegate|eliminate`) or wraps a raw Tasks
		// query. Both support an `empty-text <message>` shown when nothing matches.
		this.registerMarkdownCodeBlockProcessor('focus-first-tasks', (source, el, ctx) => {
			const { showFocus, emptyText } = parseTasksBlock(source);
			if (showFocus) {
				if (isFocusSection(showFocus)) {
					ctx.addChild(new FocusDataBlock(el, this, showFocus, emptyText));
				} else {
					el.createEl('p', { text: t().tasksBlock.invalidShow, cls: 'focus-first-tasks-missing' });
				}
				return;
			}
			ctx.addChild(new WrappedTasksBlock(el, this, source, ctx.sourcePath));
		});
	}

	onunload() {
		
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
			(await this.loadData()) as Partial<FokusFirstSettings>,
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
}

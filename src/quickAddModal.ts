import { Modal, Notice } from 'obsidian';
import FocusFirstPlugin from './main';
import { t } from './i18n';
import { commitTask } from './quickAdd';

/**
 * Quick-add dialog (issue #8): capture a task without leaving the view. A modal
 * keeps the view free of a permanent input row. Stays open after adding so
 * several tasks can be captured in a row.
 */
export class QuickAddModal extends Modal {
	private plugin: FocusFirstPlugin;
	private input!: HTMLInputElement;
	private readonly tags = new Set<string>();

	constructor(plugin: FocusFirstPlugin) {
		super(plugin.app);
		this.plugin = plugin;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		titleEl.setText(t().quickAdd.title);

		this.input = contentEl.createEl('input', {
			cls: 'focus-first-quickadd-input',
			attr: { type: 'text', placeholder: t().quickAdd.placeholder },
		});
		this.input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				void this.submit();
			}
		});

		// Quick-modifier chips: #focus plus each configured quadrant tag.
		const chips = contentEl.createDiv({ cls: 'focus-first-quickadd-chips' });
		const settings = this.plugin.settings;
		this.addChip(chips, t().quickAdd.focus, settings.focusTag);
		for (const key of ['do', 'schedule', 'delegate', 'eliminate'] as const) {
			this.addChip(chips, t().view.quadrants[key].title, settings.quadrants[key].tag);
		}

		const controls = contentEl.createDiv({ cls: 'focus-first-quickadd-controls' });
		const addBtn = controls.createEl('button', { text: t().quickAdd.add, cls: 'mod-cta' });
		addBtn.addEventListener('click', () => { void this.submit(); });

		window.setTimeout(() => this.input.focus(), 0);
	}

	private addChip(parent: HTMLElement, label: string, tag: string): void {
		if (!tag.trim()) return;
		const chip = parent.createEl('button', { text: label, cls: 'focus-first-quickadd-chip' });
		chip.addEventListener('click', () => {
			if (this.tags.has(tag)) {
				this.tags.delete(tag);
				chip.classList.remove('is-active');
			} else {
				this.tags.add(tag);
				chip.classList.add('is-active');
			}
			this.input.focus();
		});
	}

	private async submit(): Promise<void> {
		const result = await commitTask(
			this.plugin.app,
			this.plugin.settings,
			this.input.value,
			[...this.tags],
		);
		if (result === 'empty') return;
		if (result === 'no-target') {
			new Notice(t().quickAdd.noActiveNote);
			return;
		}

		new Notice(t().quickAdd.addedNotice);
		// Stay open for rapid capture: clear the input and refresh the view.
		this.input.value = '';
		this.input.focus();
		this.plugin.refreshViews();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

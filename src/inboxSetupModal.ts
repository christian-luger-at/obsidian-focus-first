import { Modal } from 'obsidian';
import FocusFirstPlugin from './main';
import { t } from './i18n';
import { normalizeInboxPath } from './quickAdd';

/**
 * First-use inbox setup (issue #24): shown before the first quick-add when no
 * inbox note is configured. Explains what the setting is for, lets the user pick
 * the note, persists it, and then runs `onSaved` to continue the quick-add.
 * Cancelling (or closing) writes nothing and does not continue.
 */
export class InboxSetupModal extends Modal {
	private plugin: FocusFirstPlugin;
	private onSaved: () => void;
	private saved = false;
	private input!: HTMLInputElement;

	constructor(plugin: FocusFirstPlugin, onSaved: () => void) {
		super(plugin.app);
		this.plugin = plugin;
		this.onSaved = onSaved;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		const s = t().quickAdd.inboxSetup;
		titleEl.setText(s.title);

		contentEl.createEl('p', { text: s.description, cls: 'focus-first-inbox-setup-desc' });

		this.input = contentEl.createEl('input', {
			cls: 'focus-first-quickadd-input',
			attr: { type: 'text', placeholder: String(s.placeholder) },
		});
		this.input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				void this.save();
			}
		});

		const controls = contentEl.createDiv({ cls: 'focus-first-quickadd-controls' });
		const cancelBtn = controls.createEl('button', { text: String(s.cancel), cls: 'focus-first-inbox-cancel' });
		cancelBtn.addEventListener('click', () => this.close());
		const saveBtn = controls.createEl('button', { text: String(s.save), cls: 'mod-cta focus-first-inbox-save' });
		saveBtn.addEventListener('click', () => { void this.save(); });

		this.input.focus();
	}

	private async save(): Promise<void> {
		this.plugin.settings.quickAddInbox = normalizeInboxPath(this.input.value);
		await this.plugin.saveSettings();
		this.saved = true;
		this.close();
		this.onSaved();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	/** Exposed for tests: whether the modal completed via Save. */
	get wasSaved(): boolean {
		return this.saved;
	}
}

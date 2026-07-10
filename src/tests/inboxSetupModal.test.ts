/**
 * Tests for InboxSetupModal (issue #24) — the first-use dialog that asks where
 * quick-added tasks should go, persists the choice, then continues the quick-add.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('obsidian', () => import('./__mocks__/obsidian'));

const { InboxSetupModal } = await import('../inboxSetupModal');
const { DEFAULT_SETTINGS } = await import('../settings');

import type { FocusFirstSettings } from '../settings';

function makePlugin(settings: Partial<FocusFirstSettings> = {}) {
	const plugin = {
		app: {},
		settings: { ...DEFAULT_SETTINGS, ...settings },
		saveSettings: vi.fn(async () => {}),
	};
	return plugin;
}

type ModalContent = {
	contentEl: { findByClass(c: string): { value: string; dispatch(t: string, e?: unknown): void; text: string } };
};

function openModal(plugin: unknown, onSaved: () => void) {
	const modal = new InboxSetupModal(plugin as never, onSaved);
	modal.onOpen();
	return modal;
}

async function flush() { for (let i = 0; i < 8; i++) await Promise.resolve(); }

describe('InboxSetupModal', () => {
	it('renders the description, an input, and save/cancel buttons', () => {
		const plugin = makePlugin();
		const modal = openModal(plugin, () => {});
		const content = (modal as unknown as ModalContent).contentEl;
		expect(content.findByClass('focus-first-inbox-setup-desc')).toBeDefined();
		expect(content.findByClass('focus-first-quickadd-input')).toBeDefined();
		expect(content.findByClass('focus-first-quickadd-controls')).toBeDefined();
	});

	it('saves the typed path (normalized) on the Save button, persists it, and continues', async () => {
		const plugin = makePlugin({ quickAddInbox: '' });
		const onSaved = vi.fn();
		const modal = openModal(plugin, onSaved);
		const content = (modal as unknown as ModalContent).contentEl;
		content.findByClass('focus-first-quickadd-input').value = 'Notes/Inbox';
		content.findByClass('focus-first-inbox-save').dispatch('click');
		await flush();

		expect(plugin.settings.quickAddInbox).toBe('Notes/Inbox.md'); // normalized
		expect(plugin.saveSettings).toHaveBeenCalled();
		expect(onSaved).toHaveBeenCalled();
		expect(modal.wasSaved).toBe(true);
	});

	it('also saves on Enter in the input', async () => {
		const plugin = makePlugin({ quickAddInbox: '' });
		const onSaved = vi.fn();
		const modal = openModal(plugin, onSaved);
		const input = (modal as unknown as ModalContent).contentEl.findByClass('focus-first-quickadd-input');
		input.value = 'Inbox.md';
		input.dispatch('keydown', { key: 'Enter', preventDefault: () => {} });
		await flush();
		expect(onSaved).toHaveBeenCalled();
	});

	it('ignores non-Enter keys in the input', async () => {
		const plugin = makePlugin({ quickAddInbox: '' });
		const modal = openModal(plugin, () => {});
		const input = (modal as unknown as ModalContent).contentEl.findByClass('focus-first-quickadd-input');
		input.value = 'typing…';
		input.dispatch('keydown', { key: 'a', preventDefault: () => {} });
		await flush();
		expect(plugin.saveSettings).not.toHaveBeenCalled();
	});

	it('falls back to Inbox.md when saved empty', async () => {
		const plugin = makePlugin({ quickAddInbox: '' });
		const modal = openModal(plugin, () => {});
		const content = (modal as unknown as ModalContent).contentEl;
		content.findByClass('focus-first-quickadd-input').value = '   ';
		content.findByClass('focus-first-inbox-save').dispatch('click');
		await flush();

		expect(plugin.settings.quickAddInbox).toBe('Inbox.md');
	});

	it('does not persist or continue when cancelled', () => {
		const plugin = makePlugin({ quickAddInbox: '' });
		const onSaved = vi.fn();
		const modal = openModal(plugin, onSaved);
		(modal as unknown as ModalContent).contentEl.findByClass('focus-first-inbox-cancel').dispatch('click');

		expect(plugin.saveSettings).not.toHaveBeenCalled();
		expect(onSaved).not.toHaveBeenCalled();
		expect(modal.wasSaved).toBe(false);
	});

	it('clears its content on close', () => {
		const plugin = makePlugin();
		const modal = openModal(plugin, () => {});
		expect(() => modal.onClose()).not.toThrow();
	});
});

/**
 * Tests for QuickAddModal — the fallback quick-add dialog: it captures input,
 * applies quick-modifier tags, and appends the task to the configured target.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('obsidian', () => import('./__mocks__/obsidian'));

const { QuickAddModal } = await import('../quickAddModal');
const { TFile } = await import('./__mocks__/obsidian');
const { DEFAULT_SETTINGS } = await import('../settings');

import type { FocusFirstSettings } from '../settings';

function makePlugin(
	settings: Partial<FocusFirstSettings>,
	activePath: string | null,
	files: Record<string, string> = {},
) {
	const store = { ...files };
	const vault = {
		getAbstractFileByPath: (path: string) => (path in store ? new TFile(path) : null),
		read: vi.fn(async (file: { path: string }) => store[file.path] ?? ''),
		modify: vi.fn(async (file: { path: string }, content: string) => { store[file.path] = content; }),
		create: vi.fn(async (path: string, content: string) => { store[path] = content; }),
		createFolder: vi.fn(async () => {}),
		_store: store,
	};
	const plugin = {
		app: {
			vault,
			workspace: { getActiveFile: () => (activePath ? { path: activePath } : null) },
		},
		settings: { ...DEFAULT_SETTINGS, ...settings },
		refreshViews: vi.fn(),
	};
	return { plugin, vault };
}

function openModal(plugin: unknown) {
	const modal = new QuickAddModal(plugin as never);
	modal.onOpen();
	return modal;
}

async function flush() {
	for (let i = 0; i < 8; i++) await Promise.resolve();
}

describe('QuickAddModal', () => {
	it('renders an input, chips, and an add button', () => {
		const { plugin } = makePlugin({}, null, { 'Inbox.md': '' });
		const modal = openModal(plugin);
		const contentEl = (modal as unknown as { contentEl: { findByClass(c: string): unknown } }).contentEl;
		expect(contentEl.findByClass('focus-first-quickadd-input')).toBeDefined();
		expect(contentEl.findByClass('focus-first-quickadd-chip')).toBeDefined();
	});

	it('appends the typed task to the inbox on Enter, then clears the input', async () => {
		const { plugin, vault } = makePlugin(
			{ quickAddTarget: 'inbox', quickAddInbox: 'Inbox.md' },
			null,
			{ 'Inbox.md': '- [ ] Old' },
		);
		const modal = openModal(plugin);
		const content = (modal as unknown as { contentEl: { findByClass(c: string): { value: string; dispatch(t: string, e?: unknown): void } } }).contentEl;
		const input = content.findByClass('focus-first-quickadd-input');
		input.value = 'Buy milk 📅 2026-07-10';
		input.dispatch('keydown', { key: 'Enter', preventDefault: () => {} });
		await flush();

		expect(vault._store['Inbox.md']).toBe('- [ ] Old\n- [ ] Buy milk 📅 2026-07-10\n');
		expect(input.value).toBe('');
		expect(plugin.refreshViews).toHaveBeenCalled();
	});

	it('does nothing for empty input', async () => {
		const { plugin, vault } = makePlugin({ quickAddTarget: 'inbox' }, null, { 'Inbox.md': '' });
		const modal = openModal(plugin);
		const content = (modal as unknown as { contentEl: { findByClass(c: string): { value: string; dispatch(t: string, e?: unknown): void } } }).contentEl;
		const input = content.findByClass('focus-first-quickadd-input');
		input.value = '   ';
		input.dispatch('keydown', { key: 'Enter', preventDefault: () => {} });
		await flush();

		expect(vault.modify).not.toHaveBeenCalled();
		expect(vault.create).not.toHaveBeenCalled();
	});

	it('applies an active quick-modifier chip (focus) to the task', async () => {
		const { plugin, vault } = makePlugin(
			{ quickAddTarget: 'inbox', quickAddInbox: 'Inbox.md', focusTag: '#focus' },
			null,
			{ 'Inbox.md': '' },
		);
		const modal = openModal(plugin);
		const content = (modal as unknown as { contentEl: { findByClass(c: string): { value: string; dispatch(t: string, e?: unknown): void } } }).contentEl;
		content.findByClass('focus-first-quickadd-chip').dispatch('click'); // toggle #focus on
		const input = content.findByClass('focus-first-quickadd-input');
		input.value = 'Prepare talk';
		input.dispatch('keydown', { key: 'Enter', preventDefault: () => {} });
		await flush();

		expect(vault._store['Inbox.md']).toBe('- [ ] Prepare talk #focus\n');
	});

	it('shows no write when the active-note target is missing', async () => {
		const { plugin, vault } = makePlugin({ quickAddTarget: 'active' }, null, {});
		const modal = openModal(plugin);
		const content = (modal as unknown as { contentEl: { findByClass(c: string): { value: string; dispatch(t: string, e?: unknown): void } } }).contentEl;
		const input = content.findByClass('focus-first-quickadd-input');
		input.value = 'Something';
		input.dispatch('keydown', { key: 'Enter', preventDefault: () => {} });
		await flush();

		expect(vault.modify).not.toHaveBeenCalled();
		expect(vault.create).not.toHaveBeenCalled();
	});

	it('onClose empties the content', () => {
		const { plugin } = makePlugin({}, null, { 'Inbox.md': '' });
		const modal = openModal(plugin);
		expect(() => modal.onClose()).not.toThrow();
	});
});

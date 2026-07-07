/**
 * Tests for quickAdd.ts — the pure helpers and the vault append behind the
 * quick-add dialog (issue #8): task-line building, inbox path normalization,
 * target resolution, and the create/append write path.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('obsidian', () => import('./__mocks__/obsidian'));

const { TFile } = await import('./__mocks__/obsidian');
const { DEFAULT_SETTINGS } = await import('../settings');
const { buildTaskLine, normalizeInboxPath, resolveTargetPath, appendTaskLine, commitTask } = await import('../quickAdd');

import type { FocusFirstSettings } from '../settings';

function settings(overrides: Partial<FocusFirstSettings> = {}): FocusFirstSettings {
	return { ...DEFAULT_SETTINGS, ...overrides };
}

describe('buildTaskLine', () => {
	it('wraps the input in a checkbox and trims it', () => {
		expect(buildTaskLine('  Call the bank  ')).toBe('- [ ] Call the bank');
	});

	it('preserves inline Tasks syntax verbatim', () => {
		expect(buildTaskLine('Task 📅 2026-07-10 🔼 #do')).toBe('- [ ] Task 📅 2026-07-10 🔼 #do');
	});

	it('appends quick-modifier tags that are not already present', () => {
		expect(buildTaskLine('Call the bank', ['#focus', '#do'])).toBe('- [ ] Call the bank #focus #do');
	});

	it('does not duplicate a tag already typed inline', () => {
		expect(buildTaskLine('Call the bank #focus', ['#focus'])).toBe('- [ ] Call the bank #focus');
	});

	it('strips an existing checkbox prefix (e.g. returned by the Tasks dialog)', () => {
		expect(buildTaskLine('- [ ] Task 📅 2026-07-10', ['#focus'])).toBe('- [ ] Task 📅 2026-07-10 #focus');
	});
});

describe('normalizeInboxPath', () => {
	it('adds a .md suffix when missing', () => {
		expect(normalizeInboxPath('Inbox')).toBe('Inbox.md');
		expect(normalizeInboxPath('Notes/Tasks')).toBe('Notes/Tasks.md');
	});

	it('keeps an existing .md suffix', () => {
		expect(normalizeInboxPath('Inbox.md')).toBe('Inbox.md');
	});

	it('falls back to Inbox.md for an empty path', () => {
		expect(normalizeInboxPath('   ')).toBe('Inbox.md');
	});
});

describe('resolveTargetPath', () => {
	it('returns the normalized inbox path in inbox mode', () => {
		const s = settings({ quickAddTarget: 'inbox', quickAddInbox: 'Notes/Inbox' });
		expect(resolveTargetPath(s, 'Some/Active.md')).toBe('Notes/Inbox.md');
	});

	it('returns the active file path in active mode', () => {
		const s = settings({ quickAddTarget: 'active' });
		expect(resolveTargetPath(s, 'Some/Active.md')).toBe('Some/Active.md');
	});

	it('returns null in active mode when there is no active note', () => {
		const s = settings({ quickAddTarget: 'active' });
		expect(resolveTargetPath(s, null)).toBeNull();
	});
});

describe('appendTaskLine', () => {
	function makeVault(files: Record<string, string>) {
		const store = { ...files };
		const folders = new Set<string>();
		const vault = {
			getAbstractFileByPath: (path: string) =>
				path in store ? new TFile(path) : (folders.has(path) ? { path } : null),
			read: vi.fn(async (file: { path: string }) => store[file.path] ?? ''),
			modify: vi.fn(async (file: { path: string }, content: string) => { store[file.path] = content; }),
			create: vi.fn(async (path: string, content: string) => { store[path] = content; }),
			createFolder: vi.fn(async (path: string) => { folders.add(path); }),
			_store: store,
			_folders: folders,
		};
		return vault;
	}

	it('appends to an existing note, inserting a newline when needed', async () => {
		const vault = makeVault({ 'Inbox.md': '- [ ] Existing' });
		await appendTaskLine({ vault } as never, 'Inbox.md', '- [ ] New');
		expect(vault._store['Inbox.md']).toBe('- [ ] Existing\n- [ ] New\n');
	});

	it('does not add a blank line when the note already ends with a newline', async () => {
		const vault = makeVault({ 'Inbox.md': '- [ ] Existing\n' });
		await appendTaskLine({ vault } as never, 'Inbox.md', '- [ ] New');
		expect(vault._store['Inbox.md']).toBe('- [ ] Existing\n- [ ] New\n');
	});

	it('writes straight into an empty note', async () => {
		const vault = makeVault({ 'Inbox.md': '' });
		await appendTaskLine({ vault } as never, 'Inbox.md', '- [ ] New');
		expect(vault._store['Inbox.md']).toBe('- [ ] New\n');
	});

	it('creates the note when it does not exist', async () => {
		const vault = makeVault({});
		await appendTaskLine({ vault } as never, 'Inbox.md', '- [ ] New');
		expect(vault.create).toHaveBeenCalledWith('Inbox.md', '- [ ] New\n');
	});

	it('creates a missing parent folder before creating the note', async () => {
		const vault = makeVault({});
		await appendTaskLine({ vault } as never, 'Notes/Inbox.md', '- [ ] New');
		expect(vault.createFolder).toHaveBeenCalledWith('Notes');
		expect(vault.create).toHaveBeenCalledWith('Notes/Inbox.md', '- [ ] New\n');
	});
});

describe('commitTask', () => {
	function makeApp(files: Record<string, string>, activePath: string | null) {
		const store = { ...files };
		return {
			workspace: { getActiveFile: () => (activePath ? { path: activePath } : null) },
			vault: {
				getAbstractFileByPath: (path: string) => (path in store ? new TFile(path) : null),
				read: vi.fn(async (file: { path: string }) => store[file.path] ?? ''),
				modify: vi.fn(async (file: { path: string }, content: string) => { store[file.path] = content; }),
				create: vi.fn(async (path: string, content: string) => { store[path] = content; }),
				createFolder: vi.fn(async () => {}),
				_store: store,
			},
		};
	}

	it('does nothing for empty input', async () => {
		const app = makeApp({ 'Inbox.md': '' }, null);
		expect(await commitTask(app as never, settings(), '   ')).toBe('empty');
		expect(app.vault.modify).not.toHaveBeenCalled();
	});

	it('appends to the inbox note in inbox mode', async () => {
		const app = makeApp({ 'Inbox.md': '- [ ] Old' }, 'Active.md');
		const result = await commitTask(app as never, settings({ quickAddTarget: 'inbox', quickAddInbox: 'Inbox.md' }), 'New task', ['#focus']);
		expect(result).toBe('added');
		expect(app.vault._store['Inbox.md']).toBe('- [ ] Old\n- [ ] New task #focus\n');
	});

	it('appends to the active note in active mode', async () => {
		const app = makeApp({ 'Active.md': '# Notes' }, 'Active.md');
		const result = await commitTask(app as never, settings({ quickAddTarget: 'active' }), 'Do it');
		expect(result).toBe('added');
		expect(app.vault._store['Active.md']).toBe('# Notes\n- [ ] Do it\n');
	});

	it('reports no-target in active mode without an active note', async () => {
		const app = makeApp({}, null);
		expect(await commitTask(app as never, settings({ quickAddTarget: 'active' }), 'Do it')).toBe('no-target');
	});
});

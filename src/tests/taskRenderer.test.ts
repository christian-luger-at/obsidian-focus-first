/**
 * Tests for completeTaskLine — in particular that completion delegates to the
 * Tasks plugin when present (so recurrence and done-date match the user's
 * config, issue #6) and falls back to a plain checkbox flip when it isn't.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('obsidian', () => import('./__mocks__/obsidian'));

const { completeTaskLine } = await import('../taskRenderer');
const { TFile } = await import('./__mocks__/obsidian');
const { TASKS_PLUGIN_ID } = await import('../tasksPlugin');

function makeFakeVault(files: Record<string, string>) {
	const store = { ...files };
	return {
		getAbstractFileByPath: (path: string) => (path in store ? new TFile(path) : null),
		read: vi.fn(async (file: { path: string }) => store[file.path] ?? ''),
		modify: vi.fn(async (file: { path: string }, content: string) => {
			store[file.path] = content;
		}),
		_store: store,
	};
}

/** An app whose `plugins.plugins[tasks].apiV1` exposes the toggle command. */
function appWithTasksApi(
	vault: ReturnType<typeof makeFakeVault>,
	toggle: (line: string, path: string) => string,
) {
	return {
		vault,
		plugins: {
			plugins: {
				[TASKS_PLUGIN_ID]: { apiV1: { executeToggleTaskDoneCommand: toggle } },
			},
		},
	} as never;
}

describe('completeTaskLine — without the Tasks plugin', () => {
	it('flips the checkbox from [ ] to [x]', async () => {
		const vault = makeFakeVault({ 'Notes/a.md': '- [ ] Buy milk 📅 2026-07-05' });
		const app = { vault } as never;

		await completeTaskLine(app, 'Notes/a.md', 0);

		expect(vault._store['Notes/a.md']).toBe('- [x] Buy milk 📅 2026-07-05');
	});

	it('leaves other lines untouched', async () => {
		const vault = makeFakeVault({ 'Notes/a.md': '# Heading\n- [ ] One\n- [ ] Two' });
		const app = { vault } as never;

		await completeTaskLine(app, 'Notes/a.md', 2);

		expect(vault._store['Notes/a.md']).toBe('# Heading\n- [ ] One\n- [x] Two');
	});
});

describe('completeTaskLine — with the Tasks plugin', () => {
	const NOW = new Date('2026-07-07T09:00:00');

	it('delegates to the Tasks API and uses its (single-line) result', async () => {
		const vault = makeFakeVault({ 'Notes/a.md': '- [ ] Pay rent 📅 2026-07-05' });
		const toggle = vi.fn(() => '- [x] Pay rent 📅 2026-07-05 ✅ 2026-07-07');
		const app = appWithTasksApi(vault, toggle);

		await completeTaskLine(app, 'Notes/a.md', 0, NOW);

		expect(toggle).toHaveBeenCalledWith('- [ ] Pay rent 📅 2026-07-05', 'Notes/a.md');
		// A single completed line gets no created date (no new occurrence).
		expect(vault._store['Notes/a.md']).toBe('- [x] Pay rent 📅 2026-07-05 ✅ 2026-07-07');
	});

	it('splices a recurring result and adds a created date to the next occurrence', async () => {
		const vault = makeFakeVault({
			'Notes/a.md': 'intro\n- [ ] Water plants 🔁 every week 📅 2026-07-07\noutro',
		});
		// Tasks returns the next occurrence first, then the completed instance.
		const toggle = vi.fn(() =>
			'- [ ] Water plants 🔁 every week 📅 2026-07-14\n'
			+ '- [x] Water plants 🔁 every week 📅 2026-07-07 ✅ 2026-07-07',
		);
		const app = appWithTasksApi(vault, toggle);

		await completeTaskLine(app, 'Notes/a.md', 1, NOW);

		expect(vault._store['Notes/a.md']).toBe(
			'intro\n'
			+ '- [ ] Water plants 🔁 every week ➕ 2026-07-07 📅 2026-07-14\n'
			+ '- [x] Water plants 🔁 every week 📅 2026-07-07 ✅ 2026-07-07\n'
			+ 'outro',
		);
	});

	it('preserves indentation and does not duplicate an existing created date', async () => {
		const vault = makeFakeVault({
			'Notes/a.md': '\t- [ ] Sub task 🔁 every day 📅 2026-07-07',
		});
		// Next occurrence already carries a ➕ created date and is indented.
		const toggle = vi.fn(() =>
			'\t- [ ] Sub task 🔁 every day ➕ 2026-07-07 📅 2026-07-08\n'
			+ '\t- [x] Sub task 🔁 every day 📅 2026-07-07 ✅ 2026-07-07',
		);
		const app = appWithTasksApi(vault, toggle);

		await completeTaskLine(app, 'Notes/a.md', 0, NOW);

		expect(vault._store['Notes/a.md']).toBe(
			'\t- [ ] Sub task 🔁 every day ➕ 2026-07-07 📅 2026-07-08\n'
			+ '\t- [x] Sub task 🔁 every day 📅 2026-07-07 ✅ 2026-07-07',
		);
	});

	it('ignores a Tasks plugin that does not expose the toggle command', async () => {
		const vault = makeFakeVault({ 'Notes/a.md': '- [ ] Plain task' });
		const app = {
			vault,
			plugins: { plugins: { [TASKS_PLUGIN_ID]: {} } },
		} as never;

		await completeTaskLine(app, 'Notes/a.md', 0);

		// Falls back to the plain checkbox flip.
		expect(vault._store['Notes/a.md']).toBe('- [x] Plain task');
	});
});

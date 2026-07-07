/**
 * Tests for taskScanner.ts
 *
 * scanTasks() uses app.vault and app.metadataCache. We mock those inline.
 * The core logic under test: due-date regex, priority regex, tag regex,
 * completion detection, task filtering by scope, and edge cases.
 */

import { describe, it, expect, vi } from 'vitest';
import { scanTasks, isFutureTask, TaskItem } from '../taskScanner';
import { DEFAULT_SETTINGS, FocusFirstSettings } from '../settings';
import { TFile } from './__mocks__/obsidian';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSettings(overrides: Partial<FocusFirstSettings> = {}): FocusFirstSettings {
	return { ...DEFAULT_SETTINGS, ...overrides };
}

/**
 * Build a minimal App mock where every markdown file maps to a list of
 * task-line strings. Each string becomes one list item at its line index.
 */
function makeApp(files: { path: string; lines: string[] }[]) {
	const tFiles = files.map((f) => {
		const tf = new TFile(f.path);
		return { tFile: tf, lines: f.lines };
	});

	return {
		vault: {
			getMarkdownFiles: () => tFiles.map((f) => f.tFile),
			cachedRead: vi.fn(async (file: TFile) => {
				const match = tFiles.find((f) => f.tFile.path === file.path);
				return (match?.lines ?? []).join('\n');
			}),
		},
		metadataCache: {
			getFileCache: (file: TFile) => {
				const match = tFiles.find((f) => f.tFile.path === file.path);
				if (!match) return null;
				// Expose every line that looks like a task checkbox as a listItem
				const listItems = match.lines.flatMap((line, idx) => {
					// Matches `- [ ]` or `- [x]` or `- [X]`
					const m = /^\s*- \[(.)\]/.exec(line);
					if (!m) return [];
					return [{
						task: m[1],
						position: { start: { line: idx } },
					}];
				});
				return { listItems };
			},
		},
	} as unknown as import('obsidian').App;
}

// ---------------------------------------------------------------------------
// Due-date parsing
// ---------------------------------------------------------------------------

describe('due-date parsing', () => {
	it('parses Tasks-plugin 📅 emoji due date', async () => {
		const app = makeApp([{ path: 'a.md', lines: ['- [ ] Task 📅 2025-01-15'] }]);
		const [task] = await scanTasks(app, makeSettings());
		expect(task?.dueDate).toBeInstanceOf(Date);
		expect(task?.dueDate?.toISOString().startsWith('2025-01-15')).toBe(true);
	});

	it('parses due date with space between emoji and date', async () => {
		const app = makeApp([{ path: 'a.md', lines: ['- [ ] Task 📅  2025-03-20'] }]);
		const [task] = await scanTasks(app, makeSettings());
		expect(task?.dueDate).toBeInstanceOf(Date);
	});

	it('returns undefined dueDate when no date present', async () => {
		const app = makeApp([{ path: 'a.md', lines: ['- [ ] No date here'] }]);
		const [task] = await scanTasks(app, makeSettings());
		expect(task?.dueDate).toBeUndefined();
	});

	it('does not pick up non-emoji YYYY-MM-DD strings as due dates', async () => {
		const app = makeApp([{ path: 'a.md', lines: ['- [ ] Created 2025-01-01 no emoji'] }]);
		const [task] = await scanTasks(app, makeSettings());
		expect(task?.dueDate).toBeUndefined();
	});

	it('only parses the first due date when multiple 📅 appear', async () => {
		// Edge case: two date emojis — regex picks first match
		const app = makeApp([{ path: 'a.md', lines: ['- [ ] Task 📅 2025-01-01 📅 2025-06-30'] }]);
		const [task] = await scanTasks(app, makeSettings());
		expect(task?.dueDate?.toISOString().startsWith('2025-01-01')).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Start / scheduled date parsing (issue #7)
// ---------------------------------------------------------------------------

describe('start/scheduled date parsing', () => {
	it('parses the 🛫 start date', async () => {
		const app = makeApp([{ path: 'a.md', lines: ['- [ ] Task 🛫 2026-08-01'] }]);
		const [task] = await scanTasks(app, makeSettings());
		expect(task?.startDate?.toISOString().startsWith('2026-08-01')).toBe(true);
		expect(task?.scheduledDate).toBeUndefined();
	});

	it('parses the ⏳ scheduled date', async () => {
		const app = makeApp([{ path: 'a.md', lines: ['- [ ] Task ⏳ 2026-08-02'] }]);
		const [task] = await scanTasks(app, makeSettings());
		expect(task?.scheduledDate?.toISOString().startsWith('2026-08-02')).toBe(true);
		expect(task?.startDate).toBeUndefined();
	});

	it('parses start, scheduled, and due dates together without confusing them', async () => {
		const app = makeApp([{
			path: 'a.md',
			lines: ['- [ ] Task 🛫 2026-08-01 ⏳ 2026-08-02 📅 2026-08-03'],
		}]);
		const [task] = await scanTasks(app, makeSettings());
		expect(task?.startDate?.toISOString().startsWith('2026-08-01')).toBe(true);
		expect(task?.scheduledDate?.toISOString().startsWith('2026-08-02')).toBe(true);
		expect(task?.dueDate?.toISOString().startsWith('2026-08-03')).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// isFutureTask (issue #7)
// ---------------------------------------------------------------------------

describe('isFutureTask', () => {
	const NOW = new Date('2026-07-07T12:00:00');
	function make(overrides: Partial<TaskItem>): TaskItem {
		return {
			file: new TFile('a.md') as never,
			line: '- [ ] Task',
			lineNumber: 0,
			completed: false,
			tags: [],
			...overrides,
		};
	}

	it('is false when there is no start or scheduled date', () => {
		expect(isFutureTask(make({ dueDate: new Date('2026-01-01') }), NOW)).toBe(false);
	});

	it('is true when the start date is after today', () => {
		expect(isFutureTask(make({ startDate: new Date('2026-08-01') }), NOW)).toBe(true);
	});

	it('is true when the scheduled date is after today', () => {
		expect(isFutureTask(make({ scheduledDate: new Date('2026-08-01') }), NOW)).toBe(true);
	});

	it('is false when start/scheduled dates are today or past', () => {
		expect(isFutureTask(make({ startDate: new Date('2026-07-07') }), NOW)).toBe(false);
		expect(isFutureTask(make({ scheduledDate: new Date('2026-06-01') }), NOW)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Priority parsing
// ---------------------------------------------------------------------------

describe('priority parsing', () => {
	const cases: [string, string][] = [
		['🔺', '🔺 Highest priority'],
		['⏫', '⏫ High priority'],
		['🔼', '🔼 Medium priority'],
		['🔽', '🔽 Low priority'],
		['⏬', '⏬ Lowest priority'],
	];

	for (const [emoji, label] of cases) {
		it(`parses priority ${emoji} (${label})`, async () => {
			const app = makeApp([{ path: 'a.md', lines: [`- [ ] Task ${emoji}`] }]);
			const [task] = await scanTasks(app, makeSettings());
			expect(task?.priority).toBe(emoji);
		});
	}

	it('returns undefined priority when no priority emoji', async () => {
		const app = makeApp([{ path: 'a.md', lines: ['- [ ] Plain task'] }]);
		const [task] = await scanTasks(app, makeSettings());
		expect(task?.priority).toBeUndefined();
	});

	it('picks up the first priority emoji when multiple appear', async () => {
		const app = makeApp([{ path: 'a.md', lines: ['- [ ] Task 🔺 ⏫'] }]);
		const [task] = await scanTasks(app, makeSettings());
		expect(task?.priority).toBe('🔺');
	});
});

// ---------------------------------------------------------------------------
// Tag parsing
// ---------------------------------------------------------------------------

describe('tag parsing', () => {
	it('extracts a single tag', async () => {
		const app = makeApp([{ path: 'a.md', lines: ['- [ ] Task #work'] }]);
		const [task] = await scanTasks(app, makeSettings());
		expect(task?.tags).toEqual(['#work']);
	});

	it('extracts multiple tags', async () => {
		const app = makeApp([{ path: 'a.md', lines: ['- [ ] Task #work #important #do'] }]);
		const [task] = await scanTasks(app, makeSettings());
		expect(task?.tags).toContain('#work');
		expect(task?.tags).toContain('#important');
		expect(task?.tags).toContain('#do');
		expect(task?.tags).toHaveLength(3);
	});

	it('returns empty tags array when no tags present', async () => {
		const app = makeApp([{ path: 'a.md', lines: ['- [ ] No tags here'] }]);
		const [task] = await scanTasks(app, makeSettings());
		expect(task?.tags).toEqual([]);
	});

	it('does not match bare # symbol', async () => {
		// TAG_RE requires at least one non-# non-space char after #
		const app = makeApp([{ path: 'a.md', lines: ['- [ ] Task # standalone'] }]);
		const [task] = await scanTasks(app, makeSettings());
		expect(task?.tags).toEqual([]);
	});

	it('handles tags with hyphens and underscores', async () => {
		const app = makeApp([{ path: 'a.md', lines: ['- [ ] Task #my-tag #sub_task'] }]);
		const [task] = await scanTasks(app, makeSettings());
		expect(task?.tags).toContain('#my-tag');
		expect(task?.tags).toContain('#sub_task');
	});

	it('does not re-use stale regex state across multiple tasks (lastIndex reset)', async () => {
		// This catches bugs where TAG_RE.lastIndex is not reset between tasks
		const app = makeApp([{
			path: 'a.md',
			lines: [
				'- [ ] First #alpha',
				'- [ ] Second #beta',
			],
		}]);
		const tasks = await scanTasks(app, makeSettings());
		expect(tasks[0]?.tags).toEqual(['#alpha']);
		expect(tasks[1]?.tags).toEqual(['#beta']);
	});
});

// ---------------------------------------------------------------------------
// Completion detection
// ---------------------------------------------------------------------------

describe('completion detection', () => {
	it('marks lowercase x as completed', async () => {
		const app = makeApp([{ path: 'a.md', lines: ['- [x] Done task'] }]);
		const [task] = await scanTasks(app, makeSettings());
		expect(task?.completed).toBe(true);
	});

	it('marks uppercase X as completed', async () => {
		const app = makeApp([{ path: 'a.md', lines: ['- [X] Also done'] }]);
		const [task] = await scanTasks(app, makeSettings());
		expect(task?.completed).toBe(true);
	});

	it('marks space as not completed', async () => {
		const app = makeApp([{ path: 'a.md', lines: ['- [ ] Open task'] }]);
		const [task] = await scanTasks(app, makeSettings());
		expect(task?.completed).toBe(false);
	});

	it('marks cancelled task [-] as completed', async () => {
		const app = makeApp([{ path: 'a.md', lines: ['- [-] Cancelled task'] }]);
		const [task] = await scanTasks(app, makeSettings());
		expect(task?.completed).toBe(true);
	});

	it('marks in-progress task [/] as not completed', async () => {
		// Only x, X, and - are treated as done/hidden; other custom states remain visible
		const app = makeApp([{ path: 'a.md', lines: ['- [/] In progress'] }]);
		const [task] = await scanTasks(app, makeSettings());
		expect(task?.completed).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Task scope filtering
// ---------------------------------------------------------------------------

describe('task scope filtering', () => {
	const allFiles = [
		{ path: 'Notes/a.md', lines: ['- [ ] In Notes'] },
		{ path: 'Work/b.md',  lines: ['- [ ] In Work'] },
		{ path: 'root.md',    lines: ['- [ ] At root'] },
	];

	it('returns tasks from all files when scope is "all"', async () => {
		const app = makeApp(allFiles);
		const tasks = await scanTasks(app, makeSettings({ taskScope: 'all' }));
		expect(tasks).toHaveLength(3);
	});

	it('returns only tasks from specified folder when scope is "folder"', async () => {
		const app = makeApp(allFiles);
		const tasks = await scanTasks(app, makeSettings({ taskScope: 'folder', taskFolder: 'Notes' }));
		expect(tasks).toHaveLength(1);
		expect(tasks[0]?.file.path).toBe('Notes/a.md');
	});

	it('handles folder path with trailing slash', async () => {
		const app = makeApp(allFiles);
		const tasks = await scanTasks(app, makeSettings({ taskScope: 'folder', taskFolder: 'Work/' }));
		expect(tasks).toHaveLength(1);
		expect(tasks[0]?.file.path).toBe('Work/b.md');
	});

	it('returns no tasks when folder has no matching files', async () => {
		const app = makeApp(allFiles);
		const tasks = await scanTasks(app, makeSettings({ taskScope: 'folder', taskFolder: 'Inbox' }));
		expect(tasks).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// File with no list items
// ---------------------------------------------------------------------------

describe('files without task items', () => {
	it('skips files with no list items in cache', async () => {
		// makeApp only exposes lines matching checkbox pattern as listItems
		const app = makeApp([{ path: 'prose.md', lines: ['Just some prose', 'No tasks here'] }]);
		const tasks = await scanTasks(app, makeSettings());
		expect(tasks).toHaveLength(0);
	});

	it('skips files where getFileCache returns null', async () => {
		const app = {
			vault: {
				getMarkdownFiles: () => [new TFile('ghost.md')],
				cachedRead: vi.fn(async () => '- [ ] Task'),
			},
			metadataCache: {
				getFileCache: () => null,
			},
		} as unknown as import('obsidian').App;
		const tasks = await scanTasks(app, makeSettings());
		expect(tasks).toHaveLength(0);
	});

	it('skips files where cache has no listItems', async () => {
		const app = {
			vault: {
				getMarkdownFiles: () => [new TFile('empty.md')],
				cachedRead: vi.fn(async () => '- [ ] Task'),
			},
			metadataCache: {
				getFileCache: () => ({ listItems: undefined }),
			},
		} as unknown as import('obsidian').App;
		const tasks = await scanTasks(app, makeSettings());
		expect(tasks).toHaveLength(0);
	});

	it('skips files where cache has empty listItems array', async () => {
		const app = {
			vault: {
				getMarkdownFiles: () => [new TFile('empty.md')],
				cachedRead: vi.fn(async () => ''),
			},
			metadataCache: {
				getFileCache: () => ({ listItems: [] }),
			},
		} as unknown as import('obsidian').App;
		const tasks = await scanTasks(app, makeSettings());
		expect(tasks).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Multiple tasks per file
// ---------------------------------------------------------------------------

describe('multiple tasks per file', () => {
	it('returns all task items from a single file', async () => {
		const app = makeApp([{
			path: 'multi.md',
			lines: [
				'- [ ] First task #work 📅 2025-02-01 🔺',
				'- [x] Done task',
				'- [ ] Third task #home',
			],
		}]);
		const tasks = await scanTasks(app, makeSettings());
		expect(tasks).toHaveLength(3);
	});

	it('correctly assigns line numbers', async () => {
		const app = makeApp([{
			path: 'a.md',
			lines: ['some prose', '- [ ] Task at line 1', '- [ ] Task at line 2'],
		}]);
		const tasks = await scanTasks(app, makeSettings());
		expect(tasks[0]?.lineNumber).toBe(1);
		expect(tasks[1]?.lineNumber).toBe(2);
	});

	it('aggregates tasks from multiple files', async () => {
		const app = makeApp([
			{ path: 'a.md', lines: ['- [ ] Task A'] },
			{ path: 'b.md', lines: ['- [ ] Task B1', '- [ ] Task B2'] },
		]);
		const tasks = await scanTasks(app, makeSettings());
		expect(tasks).toHaveLength(3);
	});
});

// ---------------------------------------------------------------------------
// Rich task line (due date + priority + tags together)
// ---------------------------------------------------------------------------

describe('rich task lines', () => {
	it('extracts due date, priority, and tags from the same line', async () => {
		const app = makeApp([{
			path: 'rich.md',
			lines: ['- [ ] Important meeting 📅 2025-12-31 🔺 #work #urgent'],
		}]);
		const [task] = await scanTasks(app, makeSettings());
		expect(task?.dueDate?.toISOString().startsWith('2025-12-31')).toBe(true);
		expect(task?.priority).toBe('🔺');
		expect(task?.tags).toContain('#work');
		expect(task?.tags).toContain('#urgent');
		expect(task?.completed).toBe(false);
	});

	it('preserves the full raw line', async () => {
		const line = '- [ ] My task 📅 2025-01-01 🔺 #do';
		const app = makeApp([{ path: 'a.md', lines: [line] }]);
		const [task] = await scanTasks(app, makeSettings());
		expect(task?.line).toBe(line);
	});

	it('attaches the correct TFile reference', async () => {
		const app = makeApp([{ path: 'myfile.md', lines: ['- [ ] Task'] }]);
		const [task] = await scanTasks(app, makeSettings());
		expect(task?.file.path).toBe('myfile.md');
	});
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
	it('returns empty array when vault has no markdown files', async () => {
		const app = {
			vault: { getMarkdownFiles: () => [] },
			metadataCache: { getFileCache: () => null },
		} as unknown as import('obsidian').App;
		const tasks = await scanTasks(app, makeSettings());
		expect(tasks).toHaveLength(0);
	});

	it('handles empty vault gracefully without throwing', async () => {
		const app = makeApp([]);
		await expect(scanTasks(app, makeSettings())).resolves.toEqual([]);
	});

	it('handles a line beyond the content length gracefully', async () => {
		// If cache reports a lineNumber that doesn't exist in the file content,
		// task.line should fall back to '' (not throw).
		const app = {
			vault: {
				getMarkdownFiles: () => [new TFile('short.md')],
				cachedRead: vi.fn(async () => ''),
			},
			metadataCache: {
				getFileCache: () => ({
					listItems: [{ task: ' ', position: { start: { line: 99 } } }],
				}),
			},
		} as unknown as import('obsidian').App;
		const tasks = await scanTasks(app, makeSettings());
		expect(tasks[0]?.line).toBe('');
	});
});

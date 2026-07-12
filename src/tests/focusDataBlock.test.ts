/**
 * Tests for the `show-focus` data sections of the ```focus-first-tasks``` block
 * (FocusDataBlock). scanTasks() is mocked so we control the task set; a minimal
 * FakeEl stands in for the container element.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('obsidian', () => import('./__mocks__/obsidian'));
vi.mock('../taskScanner', async (importActual) => {
	const actual = await importActual<typeof import('../taskScanner')>();
	return { ...actual, scanTasks: vi.fn(async () => []) };
});

const { FocusDataBlock, isFocusSection } = await import('../focusDataBlock');
const { DEFAULT_SETTINGS } = await import('../settings');
const { TFile, MarkdownRenderer } = await import('./__mocks__/obsidian');

import { scanTasks } from '../taskScanner';
import type { TaskItem } from '../taskScanner';
import type { FocusFirstSettings } from '../settings';
import type { FocusSection } from '../focusDataBlock';

const scanTasksMock = vi.mocked(scanTasks);

// ---------------------------------------------------------------------------
// FakeEl
// ---------------------------------------------------------------------------

class FakeEl {
	tagName: string;
	children: FakeEl[] = [];
	text = '';
	cls = new Set<string>();
	attrs: Record<string, string> = {};
	listeners: Record<string, Array<(e: unknown) => void>> = {};

	constructor(tagName = 'div') { this.tagName = tagName; }

	empty() { this.children = []; }
	addClass(cls: string) { this.cls.add(cls); }

	createDiv(o?: { cls?: string; text?: string }): FakeEl { return this.createEl('div', o); }
	createSpan(o?: { cls?: string; text?: string }): FakeEl { return this.createEl('span', o); }
	appendText(t: string) { this.text += t; }

	createEl(tag: string, o?: { cls?: string; text?: string; href?: string; attr?: Record<string, string> }): FakeEl {
		const el = new FakeEl(tag);
		if (o?.cls) for (const c of o.cls.split(' ').filter(Boolean)) el.cls.add(c);
		if (o?.text) el.text = o.text;
		if (o?.href) el.attrs.href = o.href;
		if (o?.attr) Object.assign(el.attrs, o.attr);
		this.children.push(el);
		return el;
	}

	addEventListener(type: string, handler: (e: unknown) => void) {
		(this.listeners[type] ??= []).push(handler);
	}
	dispatch(type: string, event: Record<string, unknown> = {}) {
		for (const h of this.listeners[type] ?? []) h(event);
	}

	querySelectorAll(selector: string): FakeEl[] {
		return this.findAllByClass(selector.replace(/^\./, ''));
	}

	findAllByClass(cls: string): FakeEl[] {
		const result: FakeEl[] = [];
		for (const child of this.children) {
			if (child.cls.has(cls)) result.push(child);
			result.push(...child.findAllByClass(cls));
		}
		return result;
	}
	findByClass(cls: string): FakeEl | undefined { return this.findAllByClass(cls)[0]; }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(overrides: Partial<TaskItem> = {}): TaskItem {
	return {
		file: new TFile('Notes/test.md') as never,
		line: '- [ ] Sample task',
		lineNumber: 0,
		completed: false,
		tags: [],
		...overrides,
	};
}

interface OnChangeCapture { handler?: () => void; }

function makeBlock(
	section: FocusSection,
	emptyText: string,
	settings: Partial<FocusFirstSettings>,
	tasks: TaskItem[],
	sourcePath = 'Note.md',
) {
	const onChange: OnChangeCapture = {};
	const app = {
		metadataCache: {
			on: vi.fn((_evt: string, handler: () => void) => { onChange.handler = handler; return {}; }),
			getFileCache: vi.fn(() => undefined as unknown),
		},
		workspace: { openLinkText: vi.fn(async () => {}) },
		vault: { modify: vi.fn(async () => {}) } as {
			modify: ReturnType<typeof vi.fn>;
			getAbstractFileByPath?: (path: string) => unknown;
			read?: (file: unknown) => Promise<string>;
		},
	};
	const plugin = { app, settings: { ...DEFAULT_SETTINGS, ...settings } };
	const container = new FakeEl('div');
	scanTasksMock.mockResolvedValue(tasks);
	const block = new FocusDataBlock(container as never, plugin as never, section, emptyText, sourcePath);
	return { block, container, plugin, app, onChange };
}

const priv = (block: unknown) => block as {
	render(): Promise<void>;
	select(tasks: TaskItem[]): TaskItem[];
	rewireCheckboxes(result: unknown, selected: TaskItem[]): void;
	appendBacklinks(result: unknown, selected: TaskItem[]): void;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('isFocusSection', () => {
	it('accepts focus and the four quadrants', () => {
		for (const v of ['focus', 'do', 'schedule', 'delegate', 'eliminate']) {
			expect(isFocusSection(v)).toBe(true);
		}
	});
	it('rejects anything else', () => {
		for (const v of ['', 'matrix', 'Do', 'foo']) {
			expect(isFocusSection(v)).toBe(false);
		}
	});
});

describe('FocusDataBlock — focus section', () => {
	beforeEach(() => { scanTasksMock.mockReset(); });

	it('selects the focus tasks and renders their lines through the Markdown renderer', async () => {
		const renderSpy = vi.spyOn(MarkdownRenderer, 'render');
		const tasks = [
			makeTask({ tags: ['#focus'], line: '- [ ] Focused one', lineNumber: 0 }),
			makeTask({ tags: ['#focus'], line: '- [ ] Focused two', lineNumber: 1 }),
			makeTask({ tags: [], line: '- [ ] Not focused', lineNumber: 2 }),
		];
		const { block, container } = makeBlock('focus', '', { focusTag: '#focus' }, tasks);
		await priv(block).render();

		// Rendered via Obsidian (so the Tasks plugin can format it), not a hand-built list.
		expect(container.findByClass('focus-first-tasks-result')).toBeDefined();
		expect(renderSpy.mock.calls[0]?.[1]).toBe('- [ ] Focused one\n- [ ] Focused two');
		renderSpy.mockRestore();
	});

	it('select() excludes hidden and completed tasks', () => {
		const tasks = [
			makeTask({ tags: ['#focus'], lineNumber: 0 }),
			makeTask({ tags: ['#focus', '#hide'], lineNumber: 1 }),
			makeTask({ tags: ['#focus'], completed: true, lineNumber: 2 }),
		];
		const { block } = makeBlock('focus', '', { focusTag: '#focus', hideTag: '#hide' }, tasks);
		expect(priv(block).select(tasks)).toHaveLength(1);
	});

	it('shows the empty-text message when nothing matches', async () => {
		const { block, container } = makeBlock('focus', 'Nothing focused', { focusTag: '#focus' }, [makeTask()]);
		await priv(block).render();

		expect(container.findByClass('focus-first-tasks-empty')?.text).toBe('Nothing focused');
		expect(container.findByClass('task-list-item')).toBeUndefined();
	});

	it('renders nothing extra when empty and no empty-text is set', async () => {
		const { block, container } = makeBlock('focus', '', { focusTag: '#focus' }, []);
		await priv(block).render();

		expect(container.findByClass('focus-first-tasks-empty')).toBeUndefined();
		expect(container.findByClass('task-list-item')).toBeUndefined();
	});

	it('re-wires a rendered checkbox to complete the correct task line', async () => {
		const tasks = [makeTask({ tags: ['#focus'], line: '- [ ] Focused #focus', lineNumber: 0 })];
		const { block, app } = makeBlock('focus', '', { focusTag: '#focus' }, tasks);
		app.vault.getAbstractFileByPath = () => new TFile('Notes/test.md');
		app.vault.read = vi.fn(async () => '- [ ] Focused #focus');

		// Stand in for the checkbox the Markdown renderer would produce.
		const result = new FakeEl('div');
		result.createEl('input', { cls: 'task-list-item-checkbox' });
		priv(block).rewireCheckboxes(result, tasks);

		result.findByClass('task-list-item-checkbox')?.dispatch('click', {
			preventDefault: () => {},
			stopImmediatePropagation: () => {},
		});
		await Promise.resolve();
		await Promise.resolve();

		expect(app.vault.modify).toHaveBeenCalled();
	});

	it('appends a source backlink to each task, like the Tasks plugin', () => {
		const tasks = [makeTask({ file: new TFile('Notes/Meeting.md') as never, lineNumber: 0 })];
		const { block } = makeBlock('focus', '', { focusTag: '#focus' }, tasks);

		const result = new FakeEl('div');
		result.createEl('li', { cls: 'task-list-item' });
		priv(block).appendBacklinks(result, tasks);

		const backlink = result.findByClass('tasks-backlink');
		expect(backlink).toBeDefined();
		expect(backlink?.text).toBe(' ()'); // ' (' + link + ')' — link text lives in the child
		const link = backlink?.findByClass('internal-link');
		expect(link?.text).toBe('Meeting'); // file basename, no heading
		expect(link?.attrs['data-href']).toBe('Notes/Meeting.md');
	});

	it('includes the preceding heading as the backlink anchor', () => {
		const tasks = [makeTask({ file: new TFile('Notes/Meeting.md') as never, lineNumber: 5 })];
		const { block, app } = makeBlock('focus', '', { focusTag: '#focus' }, tasks);
		app.metadataCache.getFileCache = vi.fn(() => ({
			headings: [
				{ heading: 'Intro', position: { start: { line: 0 } } },
				{ heading: 'Action items', position: { start: { line: 3 } } },
				{ heading: 'Later', position: { start: { line: 9 } } },
			],
		}));

		const result = new FakeEl('div');
		result.createEl('li', { cls: 'task-list-item' });
		priv(block).appendBacklinks(result, tasks);

		const link = result.findByClass('tasks-backlink')?.findByClass('internal-link');
		expect(link?.text).toBe('Meeting > Action items');
		expect(link?.attrs['data-href']).toBe('Notes/Meeting.md#Action items');
	});

	it('opens the linked note when the backlink is clicked', () => {
		const tasks = [makeTask({ file: new TFile('Notes/Meeting.md') as never, lineNumber: 0 })];
		const { block, app } = makeBlock('focus', '', { focusTag: '#focus' }, tasks, 'Dashboard.md');

		const result = new FakeEl('div');
		result.createEl('li', { cls: 'task-list-item' });
		priv(block).appendBacklinks(result, tasks);

		result.findByClass('internal-link')?.dispatch('click', {
			preventDefault: () => {},
			ctrlKey: false,
			metaKey: false,
		});

		expect(app.workspace.openLinkText).toHaveBeenCalledWith('Notes/Meeting.md', 'Dashboard.md', false);
	});

	it('subscribes to metadata changes on load', () => {
		const { block, container, app, onChange } = makeBlock('focus', '', { focusTag: '#focus' }, []);
		block.onload();

		expect(container.cls.has('focus-first-tasks-wrapper')).toBe(true);
		expect(app.metadataCache.on).toHaveBeenCalledWith('changed', expect.any(Function));
		expect(onChange.handler).toBeTypeOf('function');
	});

	it('re-renders when a metadata change fires', async () => {
		const { block, onChange } = makeBlock('focus', '', { focusTag: '#focus' }, []);
		block.onload();
		scanTasksMock.mockClear();

		onChange.handler?.(); // simulate a task file change
		await Promise.resolve();

		expect(scanTasksMock).toHaveBeenCalled();
	});
});

describe('FocusDataBlock — quadrant sections', () => {
	beforeEach(() => { scanTasksMock.mockReset(); });

	it('select() returns the tasks the classifier assigns to that quadrant', () => {
		// Manual quadrant tags give deterministic classification.
		const tasks = [
			makeTask({ tags: ['#do'], line: '- [ ] Do this', lineNumber: 0 }),
			makeTask({ tags: ['#eliminate'], line: '- [ ] Drop this', lineNumber: 1 }),
		];
		const { block } = makeBlock('do', '', {}, tasks);
		const selected = priv(block).select(tasks);
		expect(selected).toHaveLength(1);
		expect(selected[0]?.line).toBe('- [ ] Do this');
	});

	it('select() excludes hidden tasks from a quadrant', () => {
		const tasks = [
			makeTask({ tags: ['#do'], lineNumber: 0 }),
			makeTask({ tags: ['#do', '#hide'], lineNumber: 1 }),
		];
		const { block } = makeBlock('do', '', { hideTag: '#hide' }, tasks);
		expect(priv(block).select(tasks)).toHaveLength(1);
	});
});

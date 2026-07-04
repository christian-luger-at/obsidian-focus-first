/**
 * Tests for the `show-focus` data sections of the ```focus-first-tasks``` block
 * (FocusDataBlock). scanTasks() is mocked so we control the task set; a minimal
 * FakeEl stands in for the container element.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('obsidian', () => import('./__mocks__/obsidian'));
vi.mock('../taskScanner', () => ({ scanTasks: vi.fn(async () => []) }));

const { FocusDataBlock, isFocusSection } = await import('../focusDataBlock');
const { DEFAULT_SETTINGS } = await import('../settings');
const { TFile } = await import('./__mocks__/obsidian');

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

	createEl(tag: string, o?: { cls?: string; text?: string; attr?: Record<string, string> }): FakeEl {
		const el = new FakeEl(tag);
		if (o?.cls) for (const c of o.cls.split(' ').filter(Boolean)) el.cls.add(c);
		if (o?.text) el.text = o.text;
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
) {
	const onChange: OnChangeCapture = {};
	const app = {
		metadataCache: {
			on: vi.fn((_evt: string, handler: () => void) => { onChange.handler = handler; return {}; }),
		},
		vault: { modify: vi.fn(async () => {}) } as {
			modify: ReturnType<typeof vi.fn>;
			getAbstractFileByPath?: (path: string) => unknown;
			read?: (file: unknown) => Promise<string>;
		},
	};
	const plugin = { app, settings: { ...DEFAULT_SETTINGS, ...settings } };
	const container = new FakeEl('div');
	scanTasksMock.mockResolvedValue(tasks);
	const block = new FocusDataBlock(container as never, plugin as never, section, emptyText);
	return { block, container, plugin, app, onChange };
}

const priv = (block: unknown) => block as { render(): Promise<void> };

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

	it('renders the focus tasks as a native checklist', async () => {
		const tasks = [
			makeTask({ tags: ['#focus'], line: '- [ ] Focused one', lineNumber: 0 }),
			makeTask({ tags: ['#focus'], line: '- [ ] Focused two', lineNumber: 1 }),
			makeTask({ tags: [], line: '- [ ] Not focused', lineNumber: 2 }),
		];
		const { block, container } = makeBlock('focus', '', { focusTag: '#focus' }, tasks);
		await priv(block).render();

		expect(container.findByClass('contains-task-list')).toBeDefined();
		expect(container.findAllByClass('task-list-item')).toHaveLength(2);
		expect(container.findByClass('focus-first-tasks-item-text')?.text).toBe('Focused one');
	});

	it('excludes hidden and completed tasks', async () => {
		const tasks = [
			makeTask({ tags: ['#focus'], lineNumber: 0 }),
			makeTask({ tags: ['#focus', '#hide'], lineNumber: 1 }),
			makeTask({ tags: ['#focus'], completed: true, lineNumber: 2 }),
		];
		const { block, container } = makeBlock('focus', '', { focusTag: '#focus', hideTag: '#hide' }, tasks);
		await priv(block).render();

		expect(container.findAllByClass('task-list-item')).toHaveLength(1);
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

	it('checking a task off completes it', async () => {
		const tasks = [makeTask({ tags: ['#focus'], line: '- [ ] Focused', lineNumber: 0 })];
		const { block, container, app } = makeBlock('focus', '', { focusTag: '#focus' }, tasks);
		app.vault.getAbstractFileByPath = () => new TFile('Notes/test.md');
		app.vault.read = vi.fn(async () => '- [ ] Focused #focus');
		await priv(block).render();

		container.findByClass('task-list-item-checkbox')?.dispatch('click', { preventDefault: () => {} });
		await Promise.resolve();
		await Promise.resolve();

		expect(app.vault.modify).toHaveBeenCalled();
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

	it('shows the tasks the classifier assigns to that quadrant', async () => {
		// Manual quadrant tags give deterministic classification.
		const tasks = [
			makeTask({ tags: ['#do'], line: '- [ ] Do this', lineNumber: 0 }),
			makeTask({ tags: ['#eliminate'], line: '- [ ] Drop this', lineNumber: 1 }),
		];
		const { block, container } = makeBlock('do', '', {}, tasks);
		await priv(block).render();

		const items = container.findAllByClass('task-list-item');
		expect(items).toHaveLength(1);
		expect(container.findByClass('focus-first-tasks-item-text')?.text).toBe('Do this');
	});

	it('excludes hidden tasks from a quadrant', async () => {
		const tasks = [
			makeTask({ tags: ['#do'], lineNumber: 0 }),
			makeTask({ tags: ['#do', '#hide'], lineNumber: 1 }),
		];
		const { block, container } = makeBlock('do', '', { hideTag: '#hide' }, tasks);
		await priv(block).render();

		expect(container.findAllByClass('task-list-item')).toHaveLength(1);
	});
});

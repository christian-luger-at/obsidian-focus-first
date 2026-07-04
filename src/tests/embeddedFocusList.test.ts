/**
 * Tests for the embedded ```focus-first``` code-block list (EmbeddedFocusList).
 *
 * scanTasks() is mocked so we can feed a deterministic task set. A minimal
 * FakeEl stands in for the container element that Obsidian passes to the code
 * block processor.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('obsidian', () => import('./__mocks__/obsidian'));
vi.mock('../taskScanner', () => ({ scanTasks: vi.fn(async () => []) }));

const { EmbeddedFocusList } = await import('../embeddedFocusList');
const { DEFAULT_SETTINGS } = await import('../settings');
const { TFile } = await import('./__mocks__/obsidian');

import { scanTasks } from '../taskScanner';
import type { TaskItem } from '../taskScanner';
import type { FokusFirstSettings } from '../settings';

const scanTasksMock = vi.mocked(scanTasks);

// ---------------------------------------------------------------------------
// FakeEl — minimal container stand-in (adds addClass + style.setProperty on
// top of the createEl/findByClass helpers the list needs).
// ---------------------------------------------------------------------------

class FakeClassList {
	constructor(private el: FakeEl) {}
	add(...cls: string[]) { for (const c of cls) this.el.cls.add(c); }
	remove(...cls: string[]) { for (const c of cls) this.el.cls.delete(c); }
	toggle(cls: string, force?: boolean) {
		const want = force === undefined ? !this.el.cls.has(cls) : force;
		if (want) this.el.cls.add(cls); else this.el.cls.delete(cls);
		return want;
	}
	contains(cls: string) { return this.el.cls.has(cls); }
}

class FakeStyle {
	props: Record<string, string> = {};
	setProperty(k: string, v: string) { this.props[k] = v; }
}

class FakeEl {
	tagName: string;
	children: FakeEl[] = [];
	text = '';
	draggable = false;
	cls = new Set<string>();
	attrs: Record<string, string> = {};
	style = new FakeStyle();
	listeners: Record<string, Array<(e: unknown) => void>> = {};
	parentEl?: FakeEl;
	classList = new FakeClassList(this);

	constructor(tagName = 'div') { this.tagName = tagName; }

	empty() { this.children = []; }
	addClass(cls: string) { this.cls.add(cls); }

	createDiv(o?: { cls?: string; text?: string }) { return this.createEl('div', o); }
	createSpan(o?: { cls?: string; text?: string }) { return this.createEl('span', o); }

	createEl(tag: string, o?: { cls?: string; text?: string; attr?: Record<string, string> }): FakeEl {
		const el = new FakeEl(tag);
		if (o?.cls) for (const c of o.cls.split(' ').filter(Boolean)) el.cls.add(c);
		if (o?.text) el.text = o.text;
		if (o?.attr) Object.assign(el.attrs, o.attr);
		el.parentEl = this;
		this.children.push(el);
		return el;
	}

	addEventListener(type: string, handler: (e: unknown) => void) {
		(this.listeners[type] ??= []).push(handler);
	}
	dispatch(type: string, event: Record<string, unknown> = {}) {
		for (const h of this.listeners[type] ?? []) h(event);
	}
	setAttribute(k: string, v: string) { this.attrs[k] = v; }

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

function makeChild(settings: Partial<FokusFirstSettings> = {}, tasks: TaskItem[] = []) {
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
	const child = new EmbeddedFocusList(container as never, plugin as never);
	return { child, container, plugin, app, onChange };
}

const priv = (child: unknown) => child as { render(): Promise<void> };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EmbeddedFocusList', () => {
	beforeEach(() => { scanTasksMock.mockReset(); });

	it('shows the empty message when no focus tag is configured', async () => {
		const { child, container } = makeChild({ focusTag: '' });
		await priv(child).render();

		expect(container.findByClass('focus-first-embed-header')).toBeDefined();
		expect(container.findByClass('focus-first-embed-empty')).toBeDefined();
		expect(container.findByClass('focus-first-task-list')).toBeUndefined();
	});

	it('shows the empty message when there are no focus tasks', async () => {
		const { child, container } = makeChild({ focusTag: '#focus' }, [makeTask()]);
		await priv(child).render();

		expect(container.findByClass('focus-first-embed-empty')).toBeDefined();
		expect(container.findByClass('focus-first-task-list')).toBeUndefined();
	});

	it('renders focus tasks with a count', async () => {
		const tasks = [
			makeTask({ tags: ['#focus'], line: '- [ ] Focused one', lineNumber: 0 }),
			makeTask({ tags: ['#focus'], line: '- [ ] Focused two', lineNumber: 1 }),
		];
		const { child, container } = makeChild({ focusTag: '#focus' }, tasks);
		await priv(child).render();

		const list = container.findByClass('focus-first-task-list');
		expect(list).toBeDefined();
		expect(container.findAllByClass('focus-first-task-item')).toHaveLength(2);
		expect(container.findByClass('focus-first-quadrant-count')?.text).toBe('2');
	});

	it('excludes hidden tasks even if they carry the focus tag', async () => {
		const tasks = [
			makeTask({ tags: ['#focus'], line: '- [ ] Visible', lineNumber: 0 }),
			makeTask({ tags: ['#focus', '#hide'], line: '- [ ] Hidden', lineNumber: 1 }),
		];
		const { child, container } = makeChild({ focusTag: '#focus', hideTag: '#hide' }, tasks);
		await priv(child).render();

		expect(container.findAllByClass('focus-first-task-item')).toHaveLength(1);
		expect(container.findByClass('focus-first-quadrant-count')?.text).toBe('1');
	});

	it('onload adds the embed class and subscribes to metadata changes', async () => {
		const { child, container, app, onChange } = makeChild({ focusTag: '#focus' }, []);
		child.onload();
		await Promise.resolve();

		expect(container.cls.has('focus-first-embed')).toBe(true);
		expect(container.style.props['--focus-first-font-scale']).toBeDefined();
		expect(app.metadataCache.on).toHaveBeenCalledWith('changed', expect.any(Function));
		expect(onChange.handler).toBeTypeOf('function');
	});

	it('the done button on an embedded task marks it complete', async () => {
		const tasks = [makeTask({ tags: ['#focus'], line: '- [ ] Focused', lineNumber: 0 })];
		const { child, container, app } = makeChild({ focusTag: '#focus' }, tasks);
		app.vault.getAbstractFileByPath = () => new TFile('Notes/test.md');
		app.vault.read = vi.fn(async () => '- [ ] Focused #focus');
		await priv(child).render();

		const actions = container.findByClass('focus-first-task-actions');
		actions?.children[0]?.dispatch('click', { stopPropagation: () => {} });
		await Promise.resolve();
		await Promise.resolve();

		expect(app.vault.modify).toHaveBeenCalled();
	});
});

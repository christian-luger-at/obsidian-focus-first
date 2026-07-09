/**
 * Tests for TaskView.ts DOM rendering — render(), renderFilterPanel(),
 * renderFocusTasks(), renderMatrix(), renderTask(), and drag & drop.
 *
 * A minimal fake DOM element (FakeEl) replicates the subset of the Obsidian
 * HTMLElement extensions (createDiv/createEl/createSpan/empty/classList/
 * setCssProps/addEventListener) that TaskView.ts relies on, so the rendering
 * logic can be exercised and asserted on without a real browser DOM.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('obsidian', () => import('./__mocks__/obsidian'));

const { FocusFirstView } = await import('../TaskView');
const { openTaskFile } = await import('../taskRenderer');
const { DEFAULT_SETTINGS } = await import('../settings');
const { TFile, MarkdownView, createdMenus, clearCreatedMenus } = await import('./__mocks__/obsidian');

import type { TaskItem } from '../taskScanner';
import type { FocusFirstSettings } from '../settings';

// ---------------------------------------------------------------------------
// FakeEl — minimal stand-in for Obsidian's extended HTMLElement
// ---------------------------------------------------------------------------

class FakeClassList {
	constructor(private el: FakeEl) {}
	add(...cls: string[]) { for (const c of cls) this.el.cls.add(c); }
	remove(...cls: string[]) { for (const c of cls) this.el.cls.delete(c); }
	toggle(cls: string, force?: boolean) {
		const has = this.el.cls.has(cls);
		const want = force === undefined ? !has : force;
		if (want) this.el.cls.add(cls); else this.el.cls.delete(cls);
		return want;
	}
	contains(cls: string) { return this.el.cls.has(cls); }
}

class FakeEl {
	tagName: string;
	children: FakeEl[] = [];
	text = '';
	value = '';
	type = '';
	checked = false;
	draggable = false;
	cls = new Set<string>();
	attrs: Record<string, string> = {};
	style: Record<string, string> = {};
	listeners: Record<string, Array<(e: unknown) => void>> = {};
	parentEl?: FakeEl;
	classList = new FakeClassList(this);

	constructor(tagName = 'div') {
		this.tagName = tagName;
	}

	empty() { this.children = []; }

	remove() {
		const siblings = this.parentEl?.children;
		if (siblings) {
			const i = siblings.indexOf(this);
			if (i >= 0) siblings.splice(i, 1);
		}
	}

	createDiv(o?: { cls?: string; text?: string }) { return this.createEl('div', o); }
	createSpan(o?: { cls?: string; text?: string }) { return this.createEl('span', o); }

	createEl(tag: string, o?: { cls?: string; text?: string; attr?: Record<string, string> }): FakeEl {
		const el = new FakeEl(tag);
		if (o?.cls) for (const c of o.cls.split(' ').filter(Boolean)) el.cls.add(c);
		if (o?.text) el.text = o.text;
		if (o?.attr) {
			Object.assign(el.attrs, o.attr);
			if (o.attr.value !== undefined) el.value = o.attr.value;
		}
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
	getAttribute(k: string) { return this.attrs[k]; }
	addClass(...c: string[]) { for (const x of c) this.cls.add(x); }
	setText(t: string) { this.text = t; }
	setCssProps(props: Record<string, string>) { Object.assign(this.style, props); }

	contains(node: unknown): boolean {
		if (!(node instanceof FakeEl)) return false;
		let cur: FakeEl | undefined = node;
		while (cur) {
			if (cur === this) return true;
			cur = cur.parentEl;
		}
		return false;
	}

	// Recursively find descendants by class name (test helper, not part of Obsidian API)
	findAllByClass(cls: string): FakeEl[] {
		const result: FakeEl[] = [];
		for (const child of this.children) {
			if (child.cls.has(cls)) result.push(child);
			result.push(...child.findAllByClass(cls));
		}
		return result;
	}

	findByClass(cls: string): FakeEl | undefined {
		return this.findAllByClass(cls)[0];
	}

	// --- Extra DOM surface used by keyboard navigation (issue #11) ---
	findAll(selector: string): FakeEl[] {
		return this.findAllByClass(selector.replace(/^\./, ''));
	}

	closest(selector: string): FakeEl | null {
		const classes = selector.split(',').map((s) => s.trim().replace(/^\./, ''));
		const matches = (el: FakeEl) => classes.some((c) => el.cls.has(c));
		if (matches(this)) return this;
		let cur = this.parentEl;
		while (cur) {
			if (matches(cur)) return cur;
			cur = cur.parentEl;
		}
		return null;
	}

	get className(): string { return [...this.cls].join(' '); }
	get ownerDocument(): { activeElement: FakeEl | null } { return { activeElement: null }; }
	tabIndex = -1;
	focus() {}
	scrollIntoView() {}
	offsetHeight = 10;
	offsetWidth = 100;
	rect = { left: 10, top: 500, right: 210, bottom: 520, width: 200, height: 20 };
	getBoundingClientRect() { return this.rect; }
	appendChild(el: FakeEl) { el.parentEl = this; this.children.push(el); return el; }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysFromToday(offset: number): Date {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	d.setDate(d.getDate() + offset);
	return d;
}

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

function makeView(settings: Partial<FocusFirstSettings> = {}, tasks: TaskItem[] = []) {
	const vault = {
		getAbstractFileByPath: (_path: string): InstanceType<typeof TFile> | null => null,
		read: vi.fn(async (_file: unknown) => ''),
		modify: vi.fn(async (_file: unknown, _content: string) => {}),
	};
	const workspace = {
		getLeaf: vi.fn((_newLeaf?: boolean): { openFile: (f: unknown) => Promise<void>; view: unknown } => ({
			openFile: vi.fn(async (_f: unknown) => {}),
			view: undefined,
		})),
	};
	const app = { vault, workspace };
	const leaf = { app };
	const plugin = { settings: { ...DEFAULT_SETTINGS, ...settings }, saveSettings: vi.fn(async () => {}) };
	// @ts-expect-error — stub leaf/plugin, not real Obsidian types
	const view = new FocusFirstView(leaf, plugin);
	const contentEl = new FakeEl('div');
	contentEl.cls.add('focus-first-view'); // so the popover's closest('.focus-first-view') resolves
	// @ts-expect-error — FakeEl stands in for the real HTMLElement contentEl
	view.contentEl = contentEl;
	// @ts-expect-error — assign tasks directly, bypassing scanTasks()
	view.tasks = tasks;
	return { view, plugin, app, contentEl };
}

interface TestableView {
	render(): void;
	renderMatrix(contentEl: unknown, container: unknown): void;
	renderFocusTasks(container: unknown): void;
	moveTaskToQuadrant(filePath: string, lineNumber: number, quadrant: string): Promise<void>;
	makeDropTarget(cell: unknown, quadrant: string): void;
}

function priv(view: unknown): TestableView {
	return view as TestableView;
}

// ---------------------------------------------------------------------------
// render() — top-level wiring
// ---------------------------------------------------------------------------

describe('render()', () => {
	it('builds the header, search bar, focus container, and matrix container', () => {
		const { view, contentEl } = makeView();
		priv(view).render();

		expect(contentEl.findByClass('focus-first-header')).toBeDefined();
		expect(contentEl.findByClass('focus-first-search-bar')).toBeDefined();
		expect(contentEl.findByClass('focus-first-focus-container')).toBeDefined();
		expect(contentEl.findByClass('focus-first-matrix-container')).toBeDefined();
	});

	it('warns when the Tasks plugin is not enabled', () => {
		const { view, contentEl } = makeView(); // stub app has no plugins → not enabled
		priv(view).render();
		expect(contentEl.findByClass('focus-first-warning')).toBeDefined();
	});

	it('does not warn when the Tasks plugin is enabled', () => {
		const { view, contentEl, app } = makeView();
		(app as unknown as { plugins: { enabledPlugins: Set<string> } }).plugins = {
			enabledPlugins: new Set(['obsidian-tasks-plugin']),
		};
		priv(view).render();
		expect(contentEl.findByClass('focus-first-warning')).toBeUndefined();
	});

	it('dismissing the warning removes it and persists the choice', () => {
		const { view, contentEl, plugin } = makeView();
		priv(view).render();
		expect(contentEl.findByClass('focus-first-warning')).toBeDefined();

		contentEl.findByClass('focus-first-warning-dismiss')?.dispatch('click');

		expect(plugin.settings.tasksPluginWarningDismissed).toBe(true);
		expect(plugin.saveSettings).toHaveBeenCalled();
		expect(contentEl.findByClass('focus-first-warning')).toBeUndefined();
	});

	it('does not warn again once the notice was dismissed', () => {
		const { view, contentEl } = makeView({ tasksPluginWarningDismissed: true });
		priv(view).render();
		expect(contentEl.findByClass('focus-first-warning')).toBeUndefined();
	});

	it('clicking refresh triggers a refresh', () => {
		const { view, contentEl } = makeView();
		priv(view).render();
		const refreshSpy = vi.spyOn(view, 'refresh').mockResolvedValue();

		const refreshBtn = contentEl.findByClass('focus-first-refresh-btn');
		refreshBtn?.dispatch('click');

		expect(refreshSpy).toHaveBeenCalledOnce();
	});

	it('typing in the search input updates searchQuery and re-renders', () => {
		const tasks = [makeTask({ line: '- [ ] Apple task' }), makeTask({ line: '- [ ] Banana task' })];
		const { view, contentEl } = makeView({}, tasks);
		priv(view).render();

		const searchInput = contentEl.findByClass('focus-first-search-input');
		expect(searchInput).toBeDefined();
		searchInput!.value = 'banana';
		searchInput!.dispatch('input');

		// @ts-expect-error — reading private searchQuery for assertion
		expect(view.searchQuery).toBe('banana');
	});

	it('clicking the filter toggle shows the filter panel', () => {
		const { view, contentEl } = makeView();
		priv(view).render();

		const filterPanel = contentEl.findByClass('focus-first-filter-panel');
		const filterToggle = contentEl.findByClass('focus-first-filter-toggle');
		expect(filterPanel?.classList.contains('focus-first-hidden')).toBe(true);

		filterToggle?.dispatch('click');

		expect(filterPanel?.classList.contains('focus-first-hidden')).toBe(false);
		expect(filterToggle?.classList.contains('is-open')).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// renderFilterPanel() (exercised indirectly via render())
// ---------------------------------------------------------------------------

describe('filter panel checkboxes', () => {
	it('checking a date filter adds it to activeDateFilters and re-renders the matrix', () => {
		const overdueTask = makeTask({ dueDate: daysFromToday(-2) });
		const futureTask = makeTask({ dueDate: daysFromToday(20) });
		const { view, contentEl } = makeView({}, [overdueTask, futureTask]);
		priv(view).render();

		const checkboxes = contentEl.findAllByClass('focus-first-filter-option')
			.map((label) => label.children.find((c) => c.tagName === 'input'))
			.filter((el): el is FakeEl => !!el);

		// First DATE_FILTER_OPTIONS entry is '__overdue__'
		const overdueCheckbox = checkboxes[0]!;
		overdueCheckbox.checked = true;
		overdueCheckbox.dispatch('change');

		// @ts-expect-error — reading private activeDateFilters for assertion
		expect(view.activeDateFilters.has('__overdue__')).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// renderFocusTasks()
// ---------------------------------------------------------------------------

describe('renderFocusTasks()', () => {
	it('hides the container when no focus tag is configured', () => {
		const { view, contentEl } = makeView({ focusTag: '' });
		const container = contentEl.createDiv();
		priv(view).renderFocusTasks(container);
		expect(container.classList.contains('focus-first-hidden')).toBe(true);
	});

	it('hides the container when there are no focused tasks', () => {
		const { view, contentEl } = makeView({ focusTag: '#focus' }, [makeTask()]);
		const container = contentEl.createDiv();
		priv(view).renderFocusTasks(container);
		expect(container.classList.contains('focus-first-hidden')).toBe(true);
	});

	it('renders focused tasks and reveals the container', () => {
		const tasks = [makeTask({ tags: ['#focus'], line: '- [ ] Focused task' })];
		const { view, contentEl } = makeView({ focusTag: '#focus' }, tasks);
		const container = contentEl.createDiv();
		priv(view).renderFocusTasks(container);

		expect(container.classList.contains('focus-first-hidden')).toBe(false);
		const itemText = container.findByClass('focus-first-task-text');
		expect(itemText?.text).toBe('Focused task');
	});

	it('excludes hidden tasks even if they carry the focus tag', () => {
		const tasks = [makeTask({ tags: ['#focus', '#hide'], line: '- [ ] Hidden focus task' })];
		const { view, contentEl } = makeView({ focusTag: '#focus', hideTag: '#hide' }, tasks);
		const container = contentEl.createDiv();
		priv(view).renderFocusTasks(container);
		expect(container.classList.contains('focus-first-hidden')).toBe(true);
	});

	it('the done button calls completeTask', async () => {
		const tasks = [makeTask({ tags: ['#focus'], lineNumber: 0 })];
		const { view, contentEl, app } = makeView({ focusTag: '#focus' }, tasks);
		app.vault.getAbstractFileByPath = () => new TFile('Notes/test.md');
		app.vault.read = vi.fn(async () => '- [ ] Sample task #focus');
		const container = contentEl.createDiv();
		priv(view).renderFocusTasks(container);

		// Focus tasks render through renderTask() — the same path/markup as the
		// quadrant task items — so actions live under `focus-first-task-actions`.
		const doneBtn = container.findByClass('focus-first-done-btn');
		doneBtn?.dispatch('click', { stopPropagation: () => {} });
		await Promise.resolve();
		await Promise.resolve();

		expect(app.vault.modify).toHaveBeenCalled();
	});

	it('the focus (star) button clears the focus tag', async () => {
		const tasks = [makeTask({ tags: ['#focus'], lineNumber: 0 })];
		const { view, contentEl, app } = makeView({ focusTag: '#focus' }, tasks);
		app.vault.getAbstractFileByPath = () => new TFile('Notes/test.md');
		app.vault.read = vi.fn(async () => '- [ ] Sample task #focus');
		const container = contentEl.createDiv();
		priv(view).renderFocusTasks(container);

		// The task is already focused, so clicking the star removes the focus tag.
		const focusBtn = container.findByClass('focus-first-focus-btn');
		focusBtn?.dispatch('click', { stopPropagation: () => {} });
		await Promise.resolve();
		await Promise.resolve();

		expect(app.vault.modify).toHaveBeenCalledWith(expect.anything(), '- [ ] Sample task');
	});
});

// ---------------------------------------------------------------------------
// renderMatrix()
// ---------------------------------------------------------------------------

describe('renderMatrix()', () => {
	it('shows the empty state when there are no open tasks', () => {
		const { view, contentEl } = makeView({}, [makeTask({ completed: true })]);
		const container = contentEl.createDiv();
		priv(view).renderMatrix(contentEl, container);
		expect(container.findByClass('focus-first-empty')).toBeDefined();
	});

	it('excludes completed tasks and renders the rest into quadrants', () => {
		const tasks = [
			makeTask({ completed: true, line: '- [x] Done task' }),
			makeTask({ dueDate: daysFromToday(0), priority: '🔺', line: '- [ ] Urgent important task' }),
		];
		const { view, contentEl } = makeView(
			{ urgencyDays: 3, importantPriorities: ['🔺'] },
			tasks,
		);
		const container = contentEl.createDiv();
		priv(view).renderMatrix(contentEl, container);

		const counts = container.findAllByClass('focus-first-quadrant-count').map((c) => c.text);
		// One quadrant has 1 task, the other three have 0
		expect(counts.filter((c) => c === '1')).toHaveLength(1);
		expect(counts.filter((c) => c === '0')).toHaveLength(3);
	});

	it('excludes tasks carrying the hide tag', () => {
		const tasks = [makeTask({ tags: ['#hide'], dueDate: daysFromToday(0), priority: '🔺' })];
		const { view, contentEl } = makeView({ hideTag: '#hide' }, tasks);
		const container = contentEl.createDiv();
		priv(view).renderMatrix(contentEl, container);
		expect(container.findByClass('focus-first-empty')).toBeDefined();
	});

	it('filters by the active search query', () => {
		const tasks = [
			makeTask({ line: '- [ ] Apple task', dueDate: daysFromToday(0), priority: '🔺' }),
			makeTask({ line: '- [ ] Banana task', dueDate: daysFromToday(0), priority: '🔺' }),
		];
		const { view, contentEl } = makeView({ importantPriorities: ['🔺'] }, tasks);
		// @ts-expect-error — set private searchQuery directly
		view.searchQuery = 'banana';
		const container = contentEl.createDiv();
		priv(view).renderMatrix(contentEl, container);

		const taskTexts = container.findAllByClass('focus-first-task-text').map((t) => t.text);
		expect(taskTexts).toEqual(['Banana task']);
	});
});

// ---------------------------------------------------------------------------
// Future tasks (start/scheduled ahead) — show / dim / hide modes (issue #7)
// ---------------------------------------------------------------------------

describe('future tasks mode', () => {
	function renderMatrixWith(mode: FocusFirstSettings['futureTasks']) {
		// A task that is important+urgent (so it lands in a quadrant) but starts in
		// the future, plus a normal task so "hide" doesn't just empty the matrix.
		const tasks = [
			makeTask({ line: '- [ ] Future task', priority: '🔺', dueDate: daysFromToday(0), startDate: daysFromToday(10) }),
			makeTask({ line: '- [ ] Normal task', priority: '🔺', dueDate: daysFromToday(0) }),
		];
		const { view, contentEl } = makeView({ importantPriorities: ['🔺'], futureTasks: mode }, tasks);
		const container = contentEl.createDiv();
		priv(view).renderMatrix(contentEl, container);
		return container;
	}

	it('shows future tasks normally in "show" mode', () => {
		const container = renderMatrixWith('show');
		const texts = container.findAllByClass('focus-first-task-text').map((t) => t.text);
		expect(texts).toContain('Future task');
		expect(container.findByClass('focus-first-task-item')?.classList.contains('is-future')).toBe(false);
	});

	it('renders future tasks with the is-future class in "dim" mode', () => {
		const container = renderMatrixWith('dim');
		const items = container.findAllByClass('focus-first-task-item');
		const future = items.find((i) => i.findByClass('focus-first-task-text')?.text === 'Future task');
		expect(future?.classList.contains('is-future')).toBe(true);
	});

	it('excludes future tasks in "hide" mode', () => {
		const container = renderMatrixWith('hide');
		const texts = container.findAllByClass('focus-first-task-text').map((t) => t.text);
		expect(texts).toContain('Normal task');
		expect(texts).not.toContain('Future task');
	});
});

// ---------------------------------------------------------------------------
// renderTask() — action buttons (exercised via renderMatrix)
// ---------------------------------------------------------------------------

describe('task item actions in the matrix', () => {
	function renderSingleTaskMatrix(taskOverrides: Partial<TaskItem> = {}, settings: Partial<FocusFirstSettings> = {}) {
		const tasks = [makeTask({ dueDate: daysFromToday(0), priority: '🔺', ...taskOverrides })];
		const result = makeView({ importantPriorities: ['🔺'], ...settings }, tasks);
		const container = result.contentEl.createDiv();
		priv(result.view).renderMatrix(result.contentEl, container);
		return { ...result, container };
	}

	it('clicking the title opens the task note', () => {
		const { container, app } = renderSingleTaskMatrix();
		// The title is a link: a single click calls openTaskFile() → getLeaf().
		const getLeaf = vi.fn(() => ({ openFile: vi.fn(async () => {}), view: undefined }));
		app.workspace.getLeaf = getLeaf;

		container.findByClass('focus-first-task-text')?.dispatch('click');

		expect(getLeaf).toHaveBeenCalled();
	});

	it('the done button marks the task complete', async () => {
		const { container, app } = renderSingleTaskMatrix();
		app.vault.getAbstractFileByPath = () => new TFile('Notes/test.md');
		app.vault.read = vi.fn(async () => '- [ ] Sample task');

		container.findByClass('focus-first-done-btn')?.dispatch('click', { stopPropagation: () => {} });
		await Promise.resolve();
		await Promise.resolve();

		expect(app.vault.modify).toHaveBeenCalledWith(expect.anything(), '- [x] Sample task');
	});

	it('the focus button adds the focus tag', async () => {
		const { container, app } = renderSingleTaskMatrix({}, { focusTag: '#focus' });
		app.vault.getAbstractFileByPath = () => new TFile('Notes/test.md');
		app.vault.read = vi.fn(async () => '- [ ] Sample task');

		container.findByClass('focus-first-focus-btn')?.dispatch('click', { stopPropagation: () => {} });
		await Promise.resolve();
		await Promise.resolve();

		expect(app.vault.modify).toHaveBeenCalledWith(expect.anything(), '- [ ] Sample task #focus');
	});

	it('the hide button adds the hide tag', async () => {
		const { container, app } = renderSingleTaskMatrix({}, { focusTag: '', hideTag: '#hide' });
		app.vault.getAbstractFileByPath = () => new TFile('Notes/test.md');
		app.vault.read = vi.fn(async () => '- [ ] Sample task');

		container.findByClass('focus-first-hide-btn')?.dispatch('click', { stopPropagation: () => {} });
		await Promise.resolve();
		await Promise.resolve();

		expect(app.vault.modify).toHaveBeenCalledWith(expect.anything(), '- [ ] Sample task #hide');
	});

	it('marks focused tasks with the is-focused class', () => {
		const { container } = renderSingleTaskMatrix({ tags: ['#focus'] }, { focusTag: '#focus' });
		const item = container.findByClass('focus-first-task-item');
		expect(item?.classList.contains('is-focused')).toBe(true);
	});

	it('the priority button opens a menu and writes the chosen priority', async () => {
		const { container, app } = renderSingleTaskMatrix();
		app.vault.getAbstractFileByPath = () => new TFile('Notes/test.md');
		app.vault.read = vi.fn(async () => '- [ ] Sample task 📅 2026-07-07');
		clearCreatedMenus();

		container.findByClass('focus-first-priority-btn')?.dispatch('click', { stopPropagation: () => {} });

		const menu = createdMenus[createdMenus.length - 1];
		expect(menu?.items.map((i) => i.title)).toContain('⏫ High');
		menu?.items.find((i) => i.title === '⏫ High')?.callback?.();
		await Promise.resolve();
		await Promise.resolve();

		expect(app.vault.modify).toHaveBeenCalledWith(expect.anything(), '- [ ] Sample task ⏫ 📅 2026-07-07');
	});

	it('the postpone button shifts an existing due date by one day', async () => {
		const { container, app } = renderSingleTaskMatrix({ dueDate: daysFromToday(0) });
		app.vault.getAbstractFileByPath = () => new TFile('Notes/test.md');
		app.vault.read = vi.fn(async () => '- [ ] Sample task 📅 2026-07-07');
		clearCreatedMenus();

		container.findByClass('focus-first-postpone-btn')?.dispatch('click', { stopPropagation: () => {} });

		const menu = createdMenus[createdMenus.length - 1];
		menu?.items.find((i) => i.title === '+1 day')?.callback?.();
		await Promise.resolve();
		await Promise.resolve();

		expect(app.vault.modify).toHaveBeenCalledWith(expect.anything(), '- [ ] Sample task 📅 2026-07-08');
	});

	it('opens the detail popover below the row on peek hover and hides it on leave', () => {
		vi.stubGlobal('window', { setTimeout: (fn: () => void) => { fn(); return 0; }, clearTimeout: () => {} });
		try {
			const { container, contentEl } = renderSingleTaskMatrix();
			contentEl.rect = { left: 0, top: 0, right: 400, bottom: 1000, width: 400, height: 1000 };
			const peek = container.findByClass('focus-first-task-peek');
			const detail = container.findByClass('focus-first-task-detail');
			peek?.dispatch('mouseenter');
			expect(detail?.style.display).toBe('block');
			expect(detail?.style.position).toBe('absolute');
			expect(detail?.style.right).toBe('190px'); // right edge aligned to the button (rootRect.right - anchorRect.right)
			expect(detail?.style.top).toBe('520px'); // just below the row, room below
			peek?.dispatch('mouseleave'); // stubbed setTimeout fires synchronously
			expect(detail?.style.display).toBe('');
			expect(detail?.style.position).toBe('');
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('flips the popover above the row when there is no room below', () => {
		vi.stubGlobal('window', { setTimeout: (fn: () => void) => { fn(); return 0; }, clearTimeout: () => {} });
		try {
			const { container, contentEl } = renderSingleTaskMatrix();
			contentEl.rect = { left: 0, top: 0, right: 400, bottom: 525, width: 400, height: 525 };
			const peek = container.findByClass('focus-first-task-peek');
			const detail = container.findByClass('focus-first-task-detail');
			peek?.dispatch('mouseenter');
			// liRect.bottom(520)+height(10) > rootRect.bottom(525), top(500)-10 > 0 → flip up.
			expect(detail?.style.top).toBe('490px');
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('opens on peek click and stays open while the popover itself is hovered', () => {
		vi.stubGlobal('window', { setTimeout: (fn: () => void) => { fn(); return 0; }, clearTimeout: () => {} });
		try {
			const { container, contentEl } = renderSingleTaskMatrix();
			contentEl.rect = { left: 0, top: 0, right: 400, bottom: 1000, width: 400, height: 1000 };
			const peek = container.findByClass('focus-first-task-peek');
			const detail = container.findByClass('focus-first-task-detail');
			peek?.dispatch('click', { stopPropagation: () => {} });
			expect(detail?.style.display).toBe('block');
			detail?.dispatch('mouseenter'); // hover bridge cancels the hide
			detail?.dispatch('mouseleave'); // leaving hides it
			expect(detail?.style.display).toBe('');
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('the detail popover lists start/scheduled dates and tags', () => {
		const { container } = renderSingleTaskMatrix({
			startDate: daysFromToday(1),
			scheduledDate: daysFromToday(2),
			tags: ['#focus', '#do'],
		});
		expect(container.findByClass('focus-first-task-tags')).toBeDefined();
		expect(container.findByClass('focus-first-task-tag')).toBeDefined();
		// title + priority + due + start + scheduled + tags + note → several value rows.
		expect(container.findAllByClass('focus-first-detail-value').length).toBeGreaterThanOrEqual(5);
	});

	it('the postpone menu offers today/tomorrow for a task with no due date', () => {
		const { container } = renderSingleTaskMatrix({ dueDate: undefined });
		clearCreatedMenus();
		container.findByClass('focus-first-postpone-btn')?.dispatch('click', { stopPropagation: () => {} });
		const titles = createdMenus[createdMenus.length - 1]?.items.map((i) => i.title) ?? [];
		expect(titles).toContain('Due today');
		expect(titles).toContain('Due tomorrow');
	});

});

// ---------------------------------------------------------------------------
// Drag and drop
// ---------------------------------------------------------------------------

describe('drag and drop', () => {
	function renderTwoQuadrants() {
		const tasks = [makeTask({ dueDate: daysFromToday(0), priority: '🔺', line: '- [ ] Drag me' })];
		const result = makeView({ importantPriorities: ['🔺'] }, tasks);
		const container = result.contentEl.createDiv();
		priv(result.view).renderMatrix(result.contentEl, container);
		return { ...result, container };
	}

	it('dragstart stores task data and marks the item as dragging', () => {
		const { container } = renderTwoQuadrants();
		const item = container.findByClass('focus-first-task-item')!;
		const store: Record<string, string> = {};
		const dataTransfer = {
			setData: (k: string, v: string) => { store[k] = v; },
			getData: (k: string) => store[k],
		};

		item.dispatch('dragstart', { dataTransfer });

		expect(item.classList.contains('is-dragging')).toBe(true);
		expect(JSON.parse(store['application/json']!)).toMatchObject({ quadrant: 'do' });
	});

	it('dragend removes the dragging class', () => {
		const { container } = renderTwoQuadrants();
		const item = container.findByClass('focus-first-task-item')!;
		item.classList.add('is-dragging');

		item.dispatch('dragend');

		expect(item.classList.contains('is-dragging')).toBe(false);
	});

	it('dragover on a quadrant marks it as a drag target', () => {
		const { container } = renderTwoQuadrants();
		const cell = container.findByClass('focus-first-quadrant')!;
		cell.dispatch('dragover', { preventDefault: () => {} });
		expect(cell.classList.contains('is-drag-over')).toBe(true);
	});

	it('dropping on a different quadrant moves the task', async () => {
		const { container, app } = renderTwoQuadrants();
		app.vault.getAbstractFileByPath = () => new TFile('Notes/test.md');
		app.vault.read = vi.fn(async () => '- [ ] Drag me #do');

		const sourceCell = container.findAllByClass('focus-first-quadrant')[0]!; // "do"
		const targetCell = container.findAllByClass('focus-first-quadrant')[1]!; // "schedule"
		const store = { 'application/json': JSON.stringify({ filePath: 'Notes/test.md', lineNumber: 0, quadrant: 'do' }) };
		const dataTransfer = { getData: (k: string) => store[k as keyof typeof store] };

		targetCell.dispatch('drop', { preventDefault: () => {}, dataTransfer });
		await Promise.resolve();
		await Promise.resolve();

		expect(app.vault.modify).toHaveBeenCalled();
		void sourceCell;
	});

	it('dropping on the same quadrant does nothing', async () => {
		const { container, app } = renderTwoQuadrants();
		const cell = container.findByClass('focus-first-quadrant')!; // "do"
		const store = { 'application/json': JSON.stringify({ filePath: 'Notes/test.md', lineNumber: 0, quadrant: 'do' }) };
		const dataTransfer = { getData: (k: string) => store[k as keyof typeof store] };

		cell.dispatch('drop', { preventDefault: () => {}, dataTransfer });
		await Promise.resolve();

		expect(app.vault.modify).not.toHaveBeenCalled();
	});

	it('ignores a drop with a malformed JSON payload without throwing', async () => {
		const { container, app } = renderTwoQuadrants();
		const targetCell = container.findAllByClass('focus-first-quadrant')[1]!; // "schedule"
		const store = { 'application/json': 'not json {{{' };
		const dataTransfer = { getData: (k: string) => store[k as keyof typeof store] };

		expect(() => targetCell.dispatch('drop', { preventDefault: () => {}, dataTransfer })).not.toThrow();
		await Promise.resolve();

		expect(app.vault.modify).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// openTask()
// ---------------------------------------------------------------------------

describe('openTaskFile()', () => {
	it('opens the file in a leaf', async () => {
		const { app } = makeView();
		const openFile = vi.fn(async () => {});
		app.workspace.getLeaf = vi.fn(() => ({ openFile, view: undefined }));

		await openTaskFile(app as never, makeTask({ file: new TFile('Notes/x.md') as never }));

		expect(openFile).toHaveBeenCalled();
	});

	it('positions the cursor when the opened leaf is a MarkdownView', async () => {
		const { app } = makeView();
		const setCursor = vi.fn();
		const scrollIntoView = vi.fn();
		const markdownView = Object.assign(new MarkdownView(), { editor: { setCursor, scrollIntoView } });
		app.workspace.getLeaf = vi.fn(() => ({ openFile: vi.fn(async () => {}), view: markdownView }));

		await openTaskFile(app as never, makeTask({ lineNumber: 5 }));

		expect(setCursor).toHaveBeenCalledWith({ line: 5, ch: 0 });
		expect(scrollIntoView).toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// moveTaskToQuadrant & drag-drop target
// ---------------------------------------------------------------------------

describe('moveTaskToQuadrant', () => {
	function viewWithFile(content: string) {
		const store: Record<string, string> = { 'a.md': content };
		const res = makeView({});
		res.app.vault.getAbstractFileByPath = (p: string) => (p in store ? new TFile(p) : null);
		res.app.vault.read = vi.fn(async (_f: unknown) => store['a.md'] ?? '');
		res.app.vault.modify = vi.fn(async (_f: unknown, c: string) => { store['a.md'] = c; });
		return { view: res.view, store };
	}
	async function flush() { for (let i = 0; i < 6; i++) await Promise.resolve(); }

	it('swaps an existing quadrant tag for the target tag', async () => {
		const { view, store } = viewWithFile('- [ ] Task #schedule');
		await priv(view).moveTaskToQuadrant('a.md', 0, 'do');
		expect(store['a.md']).toBe('- [ ] Task #do');
	});

	it('adds the target tag when there is none', async () => {
		const { view, store } = viewWithFile('- [ ] Task');
		await priv(view).moveTaskToQuadrant('a.md', 0, 'eliminate');
		expect(store['a.md']).toBe('- [ ] Task #eliminate');
	});

	it('does nothing when the file is not found', async () => {
		const res = makeView({});
		res.app.vault.getAbstractFileByPath = () => null;
		await expect(priv(res.view).moveTaskToQuadrant('missing.md', 0, 'do')).resolves.toBeUndefined();
	});

	it('makeDropTarget moves a dropped task to the target quadrant', async () => {
		const { view, store } = viewWithFile('- [ ] Task #schedule');
		const cell = new FakeEl('div');
		priv(view).makeDropTarget(cell, 'delegate');
		cell.dispatch('dragover', { preventDefault: () => {} });
		expect(cell.classList.contains('is-drag-over')).toBe(true);
		cell.dispatch('drop', {
			preventDefault: () => {},
			dataTransfer: { getData: () => JSON.stringify({ filePath: 'a.md', lineNumber: 0, quadrant: 'schedule' }) },
		});
		await flush();
		expect(store['a.md']).toBe('- [ ] Task #delegate');
	});

	it('makeDropTarget ignores a malformed payload', () => {
		const { view } = viewWithFile('- [ ] Task');
		const cell = new FakeEl('div');
		priv(view).makeDropTarget(cell, 'do');
		expect(() => cell.dispatch('drop', {
			preventDefault: () => {},
			dataTransfer: { getData: () => 'not json' },
		})).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Keyboard/drag branch coverage (issue #11)
// ---------------------------------------------------------------------------

describe('drag-drop target branches', () => {
	async function flush() { for (let i = 0; i < 8; i++) await Promise.resolve(); }

	function wire(res: ReturnType<typeof makeView>, store: Record<string, string>) {
		res.app.vault.getAbstractFileByPath = (p: string) => (p in store ? new TFile(p) : null);
		res.app.vault.read = vi.fn(async (file: unknown) => store[(file as { path: string }).path] ?? '');
		res.app.vault.modify = vi.fn(async (file: unknown, c: string) => { store[(file as { path: string }).path] = c; });
	}

	it('dragleave removes the highlight only when the pointer leaves the cell', () => {
		const res = makeView({});
		const cell = new FakeEl('div');
		priv(res.view).makeDropTarget(cell, 'do');
		cell.dispatch('dragover', { preventDefault: () => {} });
		const inside = new FakeEl('div');
		inside.parentEl = cell;
		cell.dispatch('dragleave', { relatedTarget: inside });
		expect(cell.classList.contains('is-drag-over')).toBe(true);
		cell.dispatch('dragleave', { relatedTarget: new FakeEl('div') });
		expect(cell.classList.contains('is-drag-over')).toBe(false);
	});

	it('drop to the same quadrant does nothing', async () => {
		const store = { 'a.md': '- [ ] A #do' };
		const res = makeView({});
		wire(res, store);
		const cell = new FakeEl('div');
		priv(res.view).makeDropTarget(cell, 'do');
		cell.dispatch('drop', { preventDefault: () => {}, dataTransfer: { getData: () => JSON.stringify({ filePath: 'a.md', lineNumber: 0, quadrant: 'do' }) } });
		await flush();
		expect(res.app.vault.modify).not.toHaveBeenCalled();
	});

	it('drop ignores an empty, non-object, or wrongly-typed payload', () => {
		const res = makeView({});
		const cell = new FakeEl('div');
		priv(res.view).makeDropTarget(cell, 'do');
		const drop = (raw: string) => cell.dispatch('drop', { preventDefault: () => {}, dataTransfer: { getData: () => raw } });
		expect(() => drop('')).not.toThrow();
		expect(() => drop('42')).not.toThrow();
		expect(() => drop(JSON.stringify({ filePath: 5, lineNumber: 'x' }))).not.toThrow();
	});
});

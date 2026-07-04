/**
 * Tests for the ```focus-first-tasks``` Tasks-plugin wrapper.
 *
 * Only the DOM-independent logic is unit-tested here: the block parser and the
 * "Tasks plugin missing" branch. The live rendering path relies on
 * MarkdownRenderer + MutationObserver + querySelector, which the Node test
 * environment does not provide, so it is verified manually in Obsidian.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('obsidian', () => import('./__mocks__/obsidian'));

const { WrappedTasksBlock, parseTasksBlock } = await import('../wrappedTasksBlock');

// ---------------------------------------------------------------------------
// Minimal FakeEl (only what the missing-plugin branch touches)
// ---------------------------------------------------------------------------

class FakeEl {
	tagName: string;
	children: FakeEl[] = [];
	text = '';
	cls = new Set<string>();

	constructor(tagName = 'div') { this.tagName = tagName; }

	empty() { this.children = []; }
	addClass(cls: string) { this.cls.add(cls); }

	createDiv(o?: { cls?: string; text?: string }) { return this.createEl('div', o); }

	createEl(tag: string, o?: { cls?: string; text?: string }): FakeEl {
		const el = new FakeEl(tag);
		if (o?.cls) for (const c of o.cls.split(' ').filter(Boolean)) el.cls.add(c);
		if (o?.text) el.text = o.text;
		this.children.push(el);
		return el;
	}

	// querySelector consults an overridable map (default: nothing found), so
	// tests can simulate "the Tasks plugin rendered results" / "a message exists".
	queryResults: Record<string, FakeEl | null> = {};
	removed = false;
	querySelector(selector: string): FakeEl | null { return this.queryResults[selector] ?? null; }
	remove() { this.removed = true; }

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
// parseTasksBlock
// ---------------------------------------------------------------------------

describe('parseTasksBlock', () => {
	it('separates the query from the empty-text line (no colon)', () => {
		const { query, emptyText } = parseTasksBlock('not done\ntags include #focus\nempty-text Nothing here');
		expect(query).toBe('not done\ntags include #focus');
		expect(emptyText).toBe('Nothing here');
	});

	it('returns an empty message when none is given', () => {
		const { query, emptyText } = parseTasksBlock('not done');
		expect(query).toBe('not done');
		expect(emptyText).toBe('');
	});

	it('is case-insensitive and trims the empty-text value', () => {
		const { emptyText } = parseTasksBlock('Empty-Text    All clear!  ');
		expect(emptyText).toBe('All clear!');
	});

	it('keeps the query when the empty-text line comes first', () => {
		const { query, emptyText } = parseTasksBlock('empty-text none\nnot done\ndone');
		expect(query).toBe('not done\ndone');
		expect(emptyText).toBe('none');
	});

	it('extracts a lower-cased "show-focus" parameter (no colon) and strips it', () => {
		const { query, showFocus, emptyText } = parseTasksBlock('show-focus Do\nempty-text none');
		expect(showFocus).toBe('do');
		expect(emptyText).toBe('none');
		expect(query).toBe('');
	});

	it('returns an empty "show-focus" when the parameter is absent', () => {
		expect(parseTasksBlock('not done').showFocus).toBe('');
	});

	it('leaves a plain "show" line in the query (Tasks instructions pass through)', () => {
		// `show tree` / `show urgency` are Tasks-plugin instructions, not ours.
		const { query, showFocus } = parseTasksBlock('not done\nshow tree');
		expect(showFocus).toBe('');
		expect(query).toBe('not done\nshow tree');
	});

	it('captures any "show-focus" value so an invalid section can be reported', () => {
		expect(parseTasksBlock('show-focus nope').showFocus).toBe('nope');
	});
});

// ---------------------------------------------------------------------------
// WrappedTasksBlock — missing-plugin branch
// ---------------------------------------------------------------------------

describe('WrappedTasksBlock', () => {
	beforeEach(() => {
		vi.stubGlobal('MutationObserver', class {
			observe() {}
			disconnect() {}
		});
		vi.stubGlobal('window', { setTimeout: () => 0, clearTimeout: () => {} });
	});
	afterEach(() => vi.unstubAllGlobals());

	function makeChild(source: string, enabledPlugins: string[]) {
		const app = { plugins: { enabledPlugins: new Set(enabledPlugins) } };
		const plugin = { app };
		const container = new FakeEl('div');
		const child = new WrappedTasksBlock(container as never, plugin as never, source, 'Note.md');
		return { child, container };
	}
	const priv = (child: unknown) => child as {
		render(): Promise<void>;
		updateEmptyText(): void;
		resultEl?: FakeEl;
	};

	it('shows the missing-plugin message when Tasks is not enabled', async () => {
		const { child, container } = makeChild('not done', []);
		await priv(child).render();

		expect(container.findByClass('focus-first-tasks-missing')).toBeDefined();
		expect(container.findByClass('focus-first-tasks-result')).toBeUndefined();
	});

	it('renders the Tasks result container when the plugin is enabled', async () => {
		const { child, container } = makeChild('not done', ['obsidian-tasks-plugin']);
		await priv(child).render();

		// Past the guard: it creates the result container and no missing message.
		// (MarkdownRenderer is a no-op mock; the observer never fires here.)
		expect(container.findByClass('focus-first-tasks-missing')).toBeUndefined();
		expect(container.findByClass('focus-first-tasks-result')).toBeDefined();
	});

	it('onload adds the wrapper class', () => {
		const { child, container } = makeChild('not done', []);
		child.onload();
		expect(container.cls.has('focus-first-tasks-wrapper')).toBe(true);
	});

	it('onunload is safe before rendering and after rendering', async () => {
		const before = makeChild('not done', []);
		expect(() => before.child.onunload()).not.toThrow();

		const after = makeChild('not done', ['obsidian-tasks-plugin']);
		await priv(after.child).render(); // sets observer + safety timer
		expect(() => after.child.onunload()).not.toThrow();
	});

	it('updateEmptyText shows the message when the query produced no results', () => {
		const { child, container } = makeChild('empty-text Nothing here', ['obsidian-tasks-plugin']);
		priv(child).resultEl = new FakeEl('div'); // querySelector → null → no results
		priv(child).updateEmptyText();
		expect(container.findByClass('focus-first-tasks-empty')?.text).toBe('Nothing here');
	});

	it('updateEmptyText removes an existing message once results appear', () => {
		const { child, container } = makeChild('empty-text X', ['obsidian-tasks-plugin']);
		const resultEl = new FakeEl('div');
		resultEl.queryResults['.task-list-item, .plugin-tasks-list-item'] = new FakeEl('li');
		const existing = new FakeEl('p');
		container.queryResults['.focus-first-tasks-empty'] = existing;
		priv(child).resultEl = resultEl;
		priv(child).updateEmptyText();
		expect(existing.removed).toBe(true);
	});

	it('updateEmptyText does nothing before the result element exists', () => {
		const { child } = makeChild('empty-text X', []);
		expect(() => priv(child).updateEmptyText()).not.toThrow();
	});
});

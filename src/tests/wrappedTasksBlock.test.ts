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

	// The wrapper queries for rendered task items / an existing fallback; the
	// Tasks plugin never runs in tests, so there is nothing to find.
	querySelector(_selector: string): FakeEl | null { return null; }

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
	it('separates the query from the fallback line', () => {
		const { query, fallback } = parseTasksBlock('not done\ntags include #focus\nfallback: Nothing here');
		expect(query).toBe('not done\ntags include #focus');
		expect(fallback).toBe('Nothing here');
	});

	it('returns an empty fallback when none is given', () => {
		const { query, fallback } = parseTasksBlock('not done');
		expect(query).toBe('not done');
		expect(fallback).toBe('');
	});

	it('is case-insensitive and trims the fallback text', () => {
		const { fallback } = parseTasksBlock('Fallback:   All clear!  ');
		expect(fallback).toBe('All clear!');
	});

	it('keeps the query when the fallback line comes first', () => {
		const { query, fallback } = parseTasksBlock('fallback: none\nnot done\ndone');
		expect(query).toBe('not done\ndone');
		expect(fallback).toBe('none');
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
	const priv = (child: unknown) => child as { render(): Promise<void> };

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
});

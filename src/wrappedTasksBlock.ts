import { MarkdownRenderChild, MarkdownRenderer, debounce } from 'obsidian';
import FocusFirstPlugin from './main';
import { t } from './i18n';

const TASKS_PLUGIN_ID = 'obsidian-tasks-plugin';

/**
 * Splits the code-block body into a Tasks-plugin query and an optional
 * fallback message. Any line of the form `fallback: <text>` defines the
 * fallback; every other line is passed through as the query.
 */
export function parseTasksBlock(source: string): { query: string; fallback: string } {
	const queryLines: string[] = [];
	let fallback = '';
	for (const raw of source.split('\n')) {
		const m = /^\s*fallback\s*:\s*(.*)$/i.exec(raw);
		if (m) { fallback = (m[1] ?? '').trim(); continue; }
		queryLines.push(raw);
	}
	return { query: queryLines.join('\n').trim(), fallback };
}

/**
 * A code block that wraps the Tasks plugin's ```tasks``` block: it renders the
 * given query through the Tasks plugin and shows a custom fallback message when
 * the query returns no tasks.
 *
 * The Tasks plugin resolves queries asynchronously, so we render the query as a
 * native ```tasks``` block (Obsidian routes it to the Tasks processor) and watch
 * the result subtree with a MutationObserver to decide about the fallback once
 * the output has settled.
 */
export class WrappedTasksBlock extends MarkdownRenderChild {
	private plugin: FocusFirstPlugin;
	private query: string;
	private fallback: string;
	private sourcePath: string;
	private resultEl?: HTMLElement;
	private observer?: MutationObserver;
	private safetyTimer?: number;
	private evaluate = debounce(() => this.updateFallback(), 100);

	constructor(containerEl: HTMLElement, plugin: FocusFirstPlugin, source: string, sourcePath: string) {
		super(containerEl);
		this.plugin = plugin;
		const { query, fallback } = parseTasksBlock(source);
		this.query = query;
		this.fallback = fallback;
		this.sourcePath = sourcePath;
	}

	onload(): void {
		this.containerEl.addClass('focus-first-tasks-wrapper');
		void this.render();
	}

	onunload(): void {
		this.observer?.disconnect();
		if (this.safetyTimer !== undefined) window.clearTimeout(this.safetyTimer);
	}

	private async render(): Promise<void> {
		const el = this.containerEl;
		el.empty();

		// A ```tasks``` block only works when the Tasks plugin is active —
		// otherwise Obsidian would just print it as raw text.
		if (!this.isTasksPluginEnabled()) {
			el.createEl('p', { text: String(t().tasksBlock.missing), cls: 'focus-first-tasks-missing' });
			return;
		}

		this.resultEl = el.createDiv({ cls: 'focus-first-tasks-result' });
		const markdown = '```tasks\n' + this.query + '\n```';
		await MarkdownRenderer.render(this.plugin.app, markdown, this.resultEl, this.sourcePath, this);

		// Results arrive asynchronously; re-check whenever the subtree mutates,
		// plus a one-shot safety net in case the plugin renders nothing at all.
		this.observer?.disconnect();
		this.observer = new MutationObserver(() => this.evaluate());
		this.observer.observe(this.resultEl, { childList: true, subtree: true });
		this.evaluate();
		this.safetyTimer = window.setTimeout(() => this.updateFallback(), 600);
	}

	/** Shows the fallback when the rendered query produced no task items. */
	private updateFallback(): void {
		if (!this.resultEl) return;
		const hasResults = this.resultEl.querySelector('.task-list-item, .plugin-tasks-list-item') !== null;
		const existing = this.containerEl.querySelector('.focus-first-tasks-fallback');
		if (hasResults) {
			existing?.remove();
		} else if (!existing && this.fallback) {
			this.containerEl.createEl('p', { text: this.fallback, cls: 'focus-first-tasks-fallback' });
		}
	}

	private isTasksPluginEnabled(): boolean {
		const plugins = (this.plugin.app as unknown as {
			plugins?: { enabledPlugins?: Set<string> };
		}).plugins;
		return plugins?.enabledPlugins?.has(TASKS_PLUGIN_ID) ?? false;
	}
}

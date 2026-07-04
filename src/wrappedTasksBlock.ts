import { MarkdownRenderChild, MarkdownRenderer, debounce } from 'obsidian';
import FocusFirstPlugin from './main';
import { t } from './i18n';

const TASKS_PLUGIN_ID = 'obsidian-tasks-plugin';

/**
 * Splits the code-block body into its parameters and the Tasks-plugin query.
 * Parameters use a `key value` form (no colon):
 *   empty-text <text>       — message shown when nothing matches
 *   show-focus <section>    — render a Focus First data section instead of a
 *                             raw query (focus | do | schedule | delegate |
 *                             eliminate)
 * `show-focus` is a distinct key that never collides with Tasks-plugin
 * instructions (e.g. `show tree`), so those pass through as part of the query.
 * Every other line is part of the query.
 */
export function parseTasksBlock(source: string): { query: string; emptyText: string; showFocus: string } {
	const queryLines: string[] = [];
	let emptyText = '';
	let showFocus = '';
	for (const raw of source.split('\n')) {
		const showMatch = /^\s*show-focus\s+(\S+)\s*$/i.exec(raw);
		if (showMatch) { showFocus = (showMatch[1] ?? '').toLowerCase(); continue; }
		const emptyMatch = /^\s*empty-text\s+(.*)$/i.exec(raw);
		if (emptyMatch) { emptyText = (emptyMatch[1] ?? '').trim(); continue; }
		queryLines.push(raw);
	}
	return { query: queryLines.join('\n').trim(), emptyText, showFocus };
}

/**
 * A code block that wraps the Tasks plugin's ```tasks``` block: it renders the
 * given query through the Tasks plugin and shows a custom empty-text message
 * when the query returns no tasks.
 *
 * The Tasks plugin resolves queries asynchronously, so we render the query as a
 * native ```tasks``` block (Obsidian routes it to the Tasks processor) and watch
 * the result subtree with a MutationObserver to decide about the message once
 * the output has settled.
 */
export class WrappedTasksBlock extends MarkdownRenderChild {
	private plugin: FocusFirstPlugin;
	private query: string;
	private emptyText: string;
	private sourcePath: string;
	private resultEl?: HTMLElement;
	private observer?: MutationObserver;
	private safetyTimer?: number;
	private evaluate = debounce(() => this.updateEmptyText(), 100);

	constructor(containerEl: HTMLElement, plugin: FocusFirstPlugin, source: string, sourcePath: string) {
		super(containerEl);
		this.plugin = plugin;
		const { query, emptyText } = parseTasksBlock(source);
		this.query = query;
		this.emptyText = emptyText;
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
		this.safetyTimer = window.setTimeout(() => this.updateEmptyText(), 600);
	}

	/** Shows the empty-text message when the rendered query produced no task items. */
	private updateEmptyText(): void {
		if (!this.resultEl) return;
		const hasResults = this.resultEl.querySelector('.task-list-item, .plugin-tasks-list-item') !== null;
		const existing = this.containerEl.querySelector('.focus-first-tasks-empty');
		if (hasResults) {
			existing?.remove();
		} else if (!existing && this.emptyText) {
			this.containerEl.createEl('p', { text: this.emptyText, cls: 'focus-first-tasks-empty' });
		}
	}

	private isTasksPluginEnabled(): boolean {
		const plugins = (this.plugin.app as unknown as {
			plugins?: { enabledPlugins?: Set<string> };
		}).plugins;
		return plugins?.enabledPlugins?.has(TASKS_PLUGIN_ID) ?? false;
	}
}

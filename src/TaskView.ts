import { ItemView, WorkspaceLeaf, TFile, setIcon, debounce } from 'obsidian';
import FocusFirstPlugin from './main';
import { scanTasks, TaskItem, isFutureTask, isHiddenTask } from './taskScanner';
import { classifyTasks, MatrixTask, Quadrant } from './matrixClassifier';
import { isTasksPluginEnabled } from './tasksPlugin';
import { t } from './i18n';
import { renderTaskItem } from './taskRenderer';
import { sortTasks, groupKey, groupLabel, groupOrder, dueBucket } from './taskSorting';
import { renderNoMatches, renderOnboarding, renderEliminateHint } from './taskEmptyStates';
import { makeDropTarget } from './taskDragDrop';

export const FOCUS_FIRST_VIEW_TYPE = 'focus-first-view';

const QUADRANT_ORDER: Quadrant[] = ['do', 'schedule', 'delegate', 'eliminate'];

type DateBucket = '__overdue__' | '__today__' | '__thisweek__' | '__upcoming__' | '__nodate__';

const DATE_FILTER_OPTIONS: DateBucket[] = ['__overdue__', '__today__', '__thisweek__', '__upcoming__', '__nodate__'];

export class FocusFirstView extends ItemView {
	private plugin: FocusFirstPlugin;
	private tasks: TaskItem[] = [];
	private searchQuery = '';
	private activeDateFilters = new Set<DateBucket>();
	private searchVisible = false;
	private debouncedRefresh = debounce(() => this.refresh(), 500, true);

	constructor(leaf: WorkspaceLeaf, plugin: FocusFirstPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return FOCUS_FIRST_VIEW_TYPE;
	}

	getDisplayText(): string {
		return t().view.title;
	}

	getIcon(): string {
		return 'list-checks';
	}

	async onOpen(): Promise<void> {
		this.contentEl.addClass('focus-first-view');
		this.contentEl.style.setProperty('--focus-first-font-scale', String(this.plugin.settings.fontSize / 100));
		this.registerEvent(
			this.app.metadataCache.on('changed', (_file: TFile) => {
				this.debouncedRefresh();
			}),
		);
		await this.refresh();
	}

	async refresh(): Promise<void> {
		this.tasks = await scanTasks(this.app, this.plugin.settings);
		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		const header = contentEl.createDiv({ cls: 'focus-first-header' });
		header.createEl('h4', { text: t().view.title });
		const headerActions = header.createDiv({ cls: 'focus-first-header-actions' });
		const searchToggleBtn = headerActions.createEl('button', {
			cls: 'mod-cta focus-first-search-toggle',
		});
		setIcon(searchToggleBtn, 'search');
		searchToggleBtn.createSpan({ text: String(t().view.searchToggle) });
		searchToggleBtn.setAttribute('aria-label', String(t().view.searchToggle));
		const addBtn = headerActions.createEl('button', { cls: 'focus-first-add-btn' });
		setIcon(addBtn, 'plus');
		addBtn.createSpan({ text: String(t().view.add) });
		addBtn.setAttribute('aria-label', String(t().quickAdd.addTaskButton));
		addBtn.addEventListener('click', () => { this.plugin.openQuickAdd(); });
		const refreshBtn = headerActions.createEl('button', { cls: 'focus-first-refresh-btn' });
		setIcon(refreshBtn, 'refresh-cw');
		refreshBtn.setAttribute('aria-label', String(t().view.refresh));
		refreshBtn.setAttribute('title', String(t().view.refresh));

		// Focus First works standalone, but the Tasks plugin makes creating dated
		// and prioritised tasks much easier — nudge the user if it's missing,
		// unless they've dismissed the notice.
		if (!isTasksPluginEnabled(this.app) && !this.plugin.settings.tasksPluginWarningDismissed) {
			const warning = contentEl.createDiv({ cls: 'focus-first-warning' });
			const icon = warning.createSpan({ cls: 'focus-first-warning-icon' });
			setIcon(icon, 'alert-triangle');
			warning.createSpan({ text: String(t().view.tasksPluginWarning), cls: 'focus-first-warning-text' });

			const dismiss = warning.createEl('button', { cls: 'focus-first-warning-dismiss' });
			setIcon(dismiss, 'x');
			dismiss.setAttribute('aria-label', String(t().view.tasksPluginWarningDismiss));
			dismiss.addEventListener('click', () => {
				this.plugin.settings.tasksPluginWarningDismissed = true;
				void this.plugin.saveSettings();
				warning.remove();
			});
		}
		refreshBtn.addEventListener('click', () => { void this.refresh(); });

		// Cards wrapper stacks the search + focus cards above the matrix, all
		// sharing the same native card look (--background-secondary + border).
		const cardsWrapper = contentEl.createDiv({ cls: 'focus-first-cards-wrapper' });

		// Search area groups the search input and the date filters. It stays
		// collapsed by default (toggled from the header) so it doesn't take up
		// permanent vertical space; when opened it reveals the input and all filter
		// options at once, and it auto-opens when a search or filter is active so
		// the current state stays visible.
		this.searchVisible = this.searchVisible
			|| this.searchQuery !== ''
			|| this.activeDateFilters.size > 0;
		const searchArea = cardsWrapper.createDiv({
			cls: `focus-first-search-area${this.searchVisible ? '' : ' focus-first-hidden'}`,
		});
		searchToggleBtn.classList.toggle('is-active', this.searchVisible);
		const searchBar = searchArea.createDiv({ cls: 'focus-first-search-bar' });
		const searchInput = searchBar.createEl('input', {
			cls: 'focus-first-search-input',
			attr: {
				type: 'text',
				placeholder: t().view.searchPlaceholder,
				value: this.searchQuery,
			},
		});

		const filterPanel = searchArea.createDiv({ cls: 'focus-first-filter-panel' });

		// Declare containers before closures reference them
		const focusContainer = cardsWrapper.createDiv({ cls: 'focus-first-focus-container' });
		const matrixContainer = contentEl.createDiv({ cls: 'focus-first-matrix-container' });

		this.renderFilterPanel(filterPanel, () => {
			this.renderFocusTasks(focusContainer);
			this.renderMatrix(contentEl, matrixContainer);
		});

		searchToggleBtn.addEventListener('click', () => {
			this.searchVisible = !this.searchVisible;
			searchArea.classList.toggle('focus-first-hidden', !this.searchVisible);
			searchToggleBtn.classList.toggle('is-active', this.searchVisible);
			if (this.searchVisible) searchInput.focus();
		});

		searchInput.addEventListener('input', () => {
			this.searchQuery = searchInput.value;
			this.renderFocusTasks(focusContainer);
			this.renderMatrix(contentEl, matrixContainer);
		});

		this.renderFocusTasks(focusContainer);
		this.renderMatrix(contentEl, matrixContainer);
	}

	private renderFilterPanel(panel: HTMLElement, onChange: () => void): void {
		panel.empty();
		const g = t().groups;
		const labels: Record<DateBucket, string> = {
			__overdue__:  g.overdue,
			__today__:    g.today,
			__thisweek__: g.thisWeek,
			__upcoming__: g.upcoming,
			__nodate__:   g.noDate,
		};
		for (const bucket of DATE_FILTER_OPTIONS) {
			const label = panel.createEl('label', { cls: 'focus-first-filter-option' });
			const cb = label.createEl('input');
			cb.type = 'checkbox';
			cb.checked = this.activeDateFilters.has(bucket);
			label.createEl('span', { text: labels[bucket] });
			cb.addEventListener('change', () => {
				if (cb.checked) this.activeDateFilters.add(bucket);
				else this.activeDateFilters.delete(bucket);
				onChange();
			});
		}
	}

	private passesDateFilter(task: TaskItem): boolean {
		if (this.activeDateFilters.size === 0) return true;
		return this.activeDateFilters.has(dueBucket(task) as DateBucket);
	}

	/**
	 * Renders a section heading using Obsidian's native `.setting-item-heading`
	 * markup so it inherits the standard settings look (bold name, muted
	 * description, control on the right) without any bespoke styling.
	 */
	private renderHeading(
		parent: HTMLElement,
		title: string,
		opts: { subtitle?: string; count?: number } = {},
	): void {
		const head = parent.createDiv({ cls: 'setting-item setting-item-heading focus-first-heading' });
		const info = head.createDiv({ cls: 'setting-item-info' });
		info.createDiv({ text: title, cls: 'setting-item-name' });
		if (opts.subtitle) {
			info.createDiv({ text: opts.subtitle, cls: 'setting-item-description' });
		}
		const control = head.createDiv({ cls: 'setting-item-control' });
		if (opts.count !== undefined) {
			control.createSpan({ text: String(opts.count), cls: 'focus-first-quadrant-count' });
		}
	}

	private renderFocusTasks(container: HTMLElement): void {
		container.empty();
		const focusTag = this.plugin.settings.focusTag.trim().toLowerCase();
		if (!focusTag) { container.classList.add('focus-first-hidden'); return; }

		const focusTasks = this.tasks.filter(
			(t) => !t.completed
				&& t.tags.some((tag) => tag.toLowerCase() === focusTag)
				&& !isHiddenTask(t, this.plugin.settings)
				&& (this.plugin.settings.futureTasks !== 'hide' || !isFutureTask(t)),
		);

		if (focusTasks.length === 0) { container.classList.add('focus-first-hidden'); return; }
		container.classList.remove('focus-first-hidden');

		this.renderHeading(container, String(t().view.focusSectionTitle));

		// Render focus tasks through the exact same path as quadrant tasks so
		// both look and behave identically. Classify them to attach the
		// `quadrant` field that renderTask/drag-and-drop rely on, while keeping
		// the original focus order.
		const byQuadrant = classifyTasks(focusTasks, this.plugin.settings);
		const matrixByKey = new Map<string, MatrixTask>();
		for (const q of QUADRANT_ORDER) {
			for (const mt of byQuadrant[q]) {
				matrixByKey.set(`${mt.file.path}:${mt.lineNumber}`, mt);
			}
		}

		const list = container.createEl('ul', { cls: 'focus-first-task-list' });
		for (const task of focusTasks) {
			const mt = matrixByKey.get(`${task.file.path}:${task.lineNumber}`);
			// Focus tasks never show the "why here" reason (#31): they are here
			// because of the focus tag, not the quadrant classification.
			if (mt) this.renderTask(list, mt, { suppressWhyHere: true });
		}
	}

	private renderMatrix(contentEl: HTMLElement, container: HTMLElement): void {
		container.empty();

		const query = this.searchQuery.toLowerCase();
		const open = this.tasks
			.filter((task) => !task.completed)
			.filter((task) => !isHiddenTask(task, this.plugin.settings))
			.filter((task) => {
				if (!query) return true;
				const text = task.line.replace(/^[\s\-*]*\[.\]\s*/, '').toLowerCase();
				return text.includes(query) || task.file.basename.toLowerCase().includes(query);
			})
			.filter((task) => this.passesDateFilter(task))
			.filter((task) => this.plugin.settings.futureTasks !== 'hide' || !isFutureTask(task));

		const filtersActive = query !== '' || this.activeDateFilters.size > 0;

		if (open.length === 0) {
			if (filtersActive) {
				renderNoMatches(container, () => {
					this.searchQuery = '';
					this.activeDateFilters.clear();
					this.render();
				});
			} else {
				renderOnboarding(container);
			}
			return;
		}

		const quadrants = classifyTasks(open, this.plugin.settings);

		// Degenerate case: tasks exist but none are urgent or important (no due
		// dates / important priorities), so everything is in Eliminate. Explain why
		// instead of leaving the user with a matrix that looks broken.
		if (quadrants.do.length === 0 && quadrants.schedule.length === 0 && quadrants.delegate.length === 0
			&& quadrants.eliminate.length > 0) {
			renderEliminateHint(container);
		}

		const matrix = container.createDiv({ cls: 'focus-first-matrix' });

		for (const key of QUADRANT_ORDER) {
			const tasks = quadrants[key];
			const quadrant = t().view.quadrants[key];

			const cell = matrix.createDiv({ cls: `focus-first-quadrant focus-first-quadrant--${key}` });
			cell.setCssProps({ '--quadrant-color': this.plugin.settings.quadrants[key].color });
			makeDropTarget(cell, key, this.app, this.plugin.settings);
			this.renderHeading(cell, quadrant.title, { subtitle: quadrant.subtitle, count: tasks.length });

			if (tasks.length === 0) {
				const emptyEl = cell.createDiv({ cls: 'focus-first-quadrant-empty' });
				emptyEl.createEl('span', { cls: 'focus-first-quadrant-empty-icon' });
				emptyEl.createEl('p', { text: quadrant.emptyState, cls: 'focus-first-quadrant-empty-text' });
				continue;
			}

			const list = cell.createEl('ul', { cls: 'focus-first-task-list' });
			const sorted = sortTasks(tasks, this.plugin.settings.quadrants[key].sort);

			if (this.plugin.settings.groupByPrimary) {
				const primaryField = this.plugin.settings.quadrants[key].sort.primary;
				const groups = new Map<string, MatrixTask[]>();
				for (const task of sorted) {
					const gk = groupKey(task, primaryField);
					if (!groups.has(gk)) groups.set(gk, []);
					groups.get(gk)!.push(task);
				}
				const sortedKeys = [...groups.keys()].sort(groupOrder(primaryField));
				for (const gk of sortedKeys) {
					this.renderTaskGroup(list, groupLabel(gk, primaryField), groups.get(gk)!);
				}
			} else {
				for (const task of sorted) {
					this.renderTask(list, task);
				}
			}
		}
	}

	private renderTask(parent: HTMLElement, task: MatrixTask, opts: { suppressWhyHere?: boolean } = {}): void {
		renderTaskItem(parent, task, this.app, this.plugin.settings, opts);
	}

	private renderTaskGroup(list: HTMLElement, label: string, tasks: MatrixTask[]): void {
		const header = list.createEl('li', { cls: 'focus-first-group-header' });
		header.createEl('span', { text: label, cls: 'focus-first-group-header-label' });
		header.createEl('span', { cls: 'focus-first-group-header-line' });
		for (const task of tasks) {
			this.renderTask(list, task);
		}
	}
}

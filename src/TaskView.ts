import { ItemView, WorkspaceLeaf, TFile, setIcon, debounce } from 'obsidian';
import FocusFirstPlugin from './main';
import { scanTasks, TaskItem, isFutureTask, isHiddenTask } from './taskScanner';
import { classifyTasks, MatrixTask, Quadrant } from './matrixClassifier';
import { AxisMode, TaskSize, sizeTagList } from './settings';
import { isTasksPluginEnabled } from './tasksPlugin';
import { t } from './i18n';
import { renderTaskItem, taskTitle } from './taskRenderer';
import { sortTasks, groupKey, groupLabel, groupOrder, dueBucket, DueBucket } from './taskSorting';
import { renderNoMatches, renderOnboarding, renderEliminateHint } from './taskEmptyStates';
import { makeDropTarget, makeValueEffortDropTarget } from './taskDragDrop';

export const FOCUS_FIRST_VIEW_TYPE = 'focus-first-view';

// Wait this long after first use before asking for a star, so the nudge only
// reaches people who've had a fair chance to form an opinion.
const STAR_NUDGE_DELAY_DAYS = 14;
const REPO_URL = 'https://github.com/christian-luger-at/obsidian-focus-first';

const QUADRANT_ORDER: Quadrant[] = ['do', 'schedule', 'delegate', 'eliminate'];

// Every bucket dueBucket() can produce must be offered, otherwise tasks in the
// missing one silently vanish as soon as any date filter is active.
const DATE_FILTER_OPTIONS: DueBucket[] = [
	'__overdue__', '__today__', '__thisweek__', '__upcoming__', '__later__', '__nodate__',
];

const SIZE_FILTER_OPTIONS: TaskSize[] = ['small', 'medium', 'large'];

export class FocusFirstView extends ItemView {
	private plugin: FocusFirstPlugin;
	private tasks: TaskItem[] = [];
	private searchQuery = '';
	private activeDateFilters = new Set<DueBucket>();
	private activeSizeFilters = new Set<TaskSize>();
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

		// Axis selector (#36): a compact dropdown in the header, so switching the
		// matrix preset costs no extra vertical space.
		const axisSelect = headerActions.createEl('select', { cls: 'dropdown focus-first-axis-select' });
		axisSelect.setAttribute('aria-label', String(t().view.axes.label));
		const axisPresets: { mode: AxisMode; label: string }[] = [
			{ mode: 'eisenhower', label: String(t().view.axes.eisenhower) },
			{ mode: 'valueEffort', label: String(t().view.axes.valueEffort) },
		];
		for (const preset of axisPresets) {
			axisSelect.createEl('option', { text: preset.label, attr: { value: preset.mode } });
		}
		axisSelect.value = this.plugin.settings.axisMode;
		axisSelect.addEventListener('change', () => {
			this.plugin.settings.axisMode = axisSelect.value as AxisMode;
			void this.plugin.saveSettings();
			this.render();
		});

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

		// A one-time, dismissible nudge for a GitHub star, once someone's had
		// enough time with the plugin to have an opinion. Most installs come via
		// the in-app Community Plugins browser, so this is the only realistic way
		// to reach users who never see the README.
		const daysSinceFirstUse = (Date.now() - this.plugin.settings.firstUsedAt) / (1000 * 60 * 60 * 24);
		if (!this.plugin.settings.starNudgeDismissed && daysSinceFirstUse >= STAR_NUDGE_DELAY_DAYS) {
			const nudge = contentEl.createDiv({ cls: 'focus-first-star-nudge' });
			const icon = nudge.createSpan({ cls: 'focus-first-star-nudge-icon' });
			setIcon(icon, 'star');
			nudge.createSpan({ text: String(t().view.starNudge), cls: 'focus-first-star-nudge-text' });
			nudge.createEl('a', {
				text: String(t().view.starNudgeButton),
				cls: 'focus-first-star-nudge-link',
				href: REPO_URL,
				attr: { rel: 'noopener', target: '_blank' },
			});

			const dismissNudge = nudge.createEl('button', { cls: 'focus-first-warning-dismiss' });
			setIcon(dismissNudge, 'x');
			dismissNudge.setAttribute('aria-label', String(t().view.tasksPluginWarningDismiss));
			dismissNudge.addEventListener('click', () => {
				this.plugin.settings.starNudgeDismissed = true;
				void this.plugin.saveSettings();
				nudge.remove();
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
			|| this.activeDateFilters.size > 0
			|| this.activeSizeFilters.size > 0;
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
		const labels: Record<DueBucket, string> = {
			__overdue__:  g.overdue,
			__today__:    g.today,
			__thisweek__: g.thisWeek,
			__upcoming__: g.upcoming,
			__later__:    g.later,
			__nodate__:   g.noDate,
		};
		const dateGroup = panel.createDiv({ cls: 'focus-first-filter-group' });
		for (const bucket of DATE_FILTER_OPTIONS) {
			const label = dateGroup.createEl('label', { cls: 'focus-first-filter-option' });
			const cb = label.createEl('input');
			cb.type = 'checkbox';
			cb.checked = this.activeDateFilters.has(bucket);
			label.createSpan({ text: labels[bucket] });
			cb.addEventListener('change', () => {
				if (cb.checked) this.activeDateFilters.add(bucket);
				else this.activeDateFilters.delete(bucket);
				onChange();
			});
		}

		// Size filter (#30/#35): narrows to tasks of the chosen size(s), reusing the
		// #s/#m/#l tags. Only shown when the user has size tags configured. Checking
		// only "small" is the "quick wins" lens.
		if (sizeTagList(this.plugin.settings).length > 0) {
			const sizeGroup = panel.createDiv({ cls: 'focus-first-filter-group focus-first-size-filter-group' });
			const sizeLabels: Record<TaskSize, string> = {
				small: String(t().view.actions.sizeSmall),
				medium: String(t().view.actions.sizeMedium),
				large: String(t().view.actions.sizeLarge),
			};
			for (const size of SIZE_FILTER_OPTIONS) {
				const label = sizeGroup.createEl('label', { cls: 'focus-first-filter-option' });
				const cb = label.createEl('input');
				cb.type = 'checkbox';
				cb.checked = this.activeSizeFilters.has(size);
				label.createSpan({ text: sizeLabels[size] });
				cb.addEventListener('change', () => {
					if (cb.checked) this.activeSizeFilters.add(size);
					else this.activeSizeFilters.delete(size);
					onChange();
				});
			}
		}
	}

	private passesDateFilter(task: TaskItem): boolean {
		if (this.activeDateFilters.size === 0) return true;
		return this.activeDateFilters.has(dueBucket(task));
	}

	private passesSizeFilter(task: TaskItem): boolean {
		if (this.activeSizeFilters.size === 0) return true;
		return task.size !== undefined && this.activeSizeFilters.has(task.size);
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

		// Focus tasks render through the same path as quadrant tasks (classified to
		// attach the `quadrant` field), but ordered most-important-first and numbered
		// so daily-planning rituals (Eat the Frog, Ivy Lee, MITs) have structure — #1
		// is the natural "frog" (#34).
		const byQuadrant = classifyTasks(focusTasks, this.plugin.settings);
		const ordered: MatrixTask[] = [];
		for (const q of QUADRANT_ORDER) ordered.push(...byQuadrant[q]);

		// Base order is most-important-first (#34). A manual drag order (#37), stored
		// as stable per-task keys, then overrides it: tasks the user has placed by hand
		// come first in that order; anything not yet placed keeps the importance order
		// and follows (Array.prototype.sort is stable, so ties preserve it).
		const manualOrder = this.plugin.settings.focusOrder;
		const rank = (mt: MatrixTask) => {
			const i = manualOrder.indexOf(this.focusKey(mt.file.path, mt.line));
			return i === -1 ? Number.MAX_SAFE_INTEGER : i;
		};
		const sorted = sortTasks(ordered, { primary: 'priority', secondary: 'dueDate' })
			.sort((a, b) => rank(a) - rank(b));

		this.renderHeading(container, String(t().view.focusSectionTitle), { count: sorted.length });

		const target = this.plugin.settings.focusTargetCount;
		const keys = sorted.map((mt) => this.focusKey(mt.file.path, mt.line));
		const list = container.createEl('ul', { cls: 'focus-first-task-list' });
		sorted.forEach((mt, i) => {
			// A subtle divider marks where the shortlist runs past the daily target.
			if (target > 0 && i === target) {
				list.createEl('li', {
					cls: 'focus-first-focus-target-line',
					text: String(t().view.focusOverTarget),
				});
			}
			// Focus tasks never show the "why here" reason (#31): they are here
			// because of the focus tag, not the quadrant classification.
			const li = this.renderTask(list, mt, { suppressWhyHere: true, position: i + 1 });
			this.makeFocusReorderTarget(li, this.focusKey(mt.file.path, mt.line), keys);
		});
	}

	/** Stable per-task key for the manual focus order: file path + display title. */
	private focusKey(filePath: string, line: string): string {
		return `${filePath}::${taskTitle(line)}`;
	}

	/**
	 * Wires a focus row as a drop target for manual reordering (#37): dropping a
	 * dragged focus task onto this row places it just before or after this one,
	 * depending on which half of the row the pointer is over — so every gap,
	 * including above the first row and below the last, is reachable.
	 */
	private makeFocusReorderTarget(li: HTMLElement, targetKey: string, keys: string[]): void {
		// True when the pointer sits in the lower half of the row → drop after it.
		const isAfter = (e: DragEvent): boolean => {
			const rect = li.getBoundingClientRect();
			return e.clientY > rect.top + rect.height / 2;
		};
		const clearIndicator = () => li.classList.remove('focus-first-drop-before', 'focus-first-drop-after');
		li.addEventListener('dragover', (e) => {
			e.preventDefault();
			const after = isAfter(e);
			li.classList.toggle('focus-first-drop-after', after);
			li.classList.toggle('focus-first-drop-before', !after);
		});
		li.addEventListener('dragleave', (e) => {
			if (!li.contains(e.relatedTarget as Node)) clearIndicator();
		});
		li.addEventListener('drop', (e) => {
			e.preventDefault();
			clearIndicator();
			const raw = e.dataTransfer?.getData('application/json');
			if (!raw) return;
			let data: unknown;
			try { data = JSON.parse(raw); } catch { return; }
			if (typeof data !== 'object' || data === null) return;
			const { filePath, line } = data as { filePath?: unknown; line?: unknown };
			if (typeof filePath !== 'string' || typeof line !== 'string') return;
			this.reorderFocus(keys, this.focusKey(filePath, line), targetKey, isAfter(e));
		});
	}

	/**
	 * Rebuilds the manual focus order by moving `draggedKey` to just before (or
	 * after, when `after` is true) `targetKey`, then persists it. Rebuilding from
	 * the currently-shown keys keeps `focusOrder` pruned to tasks in focus.
	 */
	private reorderFocus(keys: string[], draggedKey: string, targetKey: string, after: boolean): void {
		if (draggedKey === targetKey) return;
		// Only reorder within the focus list — ignore drops from elsewhere.
		if (!keys.includes(draggedKey)) return;
		const without = keys.filter((k) => k !== draggedKey);
		const insertAt = without.indexOf(targetKey);
		if (insertAt === -1) return;
		without.splice(after ? insertAt + 1 : insertAt, 0, draggedKey);
		this.plugin.settings.focusOrder = without;
		void this.plugin.saveSettings();
		this.render();
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
			.filter((task) => this.passesSizeFilter(task))
			.filter((task) => this.plugin.settings.futureTasks !== 'hide' || !isFutureTask(task));

		const filtersActive = query !== '' || this.activeDateFilters.size > 0 || this.activeSizeFilters.size > 0;

		if (open.length === 0) {
			if (filtersActive) {
				renderNoMatches(container, () => {
					this.searchQuery = '';
					this.activeDateFilters.clear();
					this.activeSizeFilters.clear();
					this.render();
				});
			} else {
				renderOnboarding(container);
			}
			return;
		}

		const quadrants = classifyTasks(open, this.plugin.settings);
		const eisenhower = this.plugin.settings.axisMode === 'eisenhower';
		// Quadrant labels adapt to the active axes; colours and sort are shared slots.
		const quadrantLabels = eisenhower ? t().view.quadrants : t().view.quadrantsValueEffort;

		// Degenerate case (Eisenhower only): tasks exist but none are urgent or
		// important, so everything is in Eliminate. Explain why instead of leaving
		// the user with a matrix that looks broken. In Value/Effort the same pile-up
		// (all Time Sinks) has a different meaning, so the hint doesn't apply.
		if (eisenhower && quadrants.do.length === 0 && quadrants.schedule.length === 0
			&& quadrants.delegate.length === 0 && quadrants.eliminate.length > 0) {
			renderEliminateHint(container);
		}

		const matrix = container.createDiv({ cls: 'focus-first-matrix' });

		for (const key of QUADRANT_ORDER) {
			const tasks = quadrants[key];
			const quadrant = quadrantLabels[key];

			const cell = matrix.createDiv({ cls: `focus-first-quadrant focus-first-quadrant--${key}` });
			cell.setCssProps({ '--quadrant-color': this.plugin.settings.quadrants[key].color });
			// Drag-to-reclassify: Eisenhower writes the quadrant tag; Value/Effort
			// writes the value override tag (#highvalue/#lowvalue) plus the size tag
			// for the target effort.
			if (eisenhower) makeDropTarget(cell, key, this.app, this.plugin.settings);
			else makeValueEffortDropTarget(cell, key, this.app, this.plugin.settings);
			this.renderHeading(cell, quadrant.title, { subtitle: quadrant.subtitle, count: tasks.length });

			if (tasks.length === 0) {
				const emptyEl = cell.createDiv({ cls: 'focus-first-quadrant-empty' });
				emptyEl.createSpan({ cls: 'focus-first-quadrant-empty-icon' });
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

	private renderTask(parent: HTMLElement, task: MatrixTask, opts: { suppressWhyHere?: boolean; position?: number } = {}): HTMLElement {
		return renderTaskItem(parent, task, this.app, this.plugin.settings, opts);
	}

	private renderTaskGroup(list: HTMLElement, label: string, tasks: MatrixTask[]): void {
		const header = list.createEl('li', { cls: 'focus-first-group-header' });
		header.createSpan({ text: label, cls: 'focus-first-group-header-label' });
		header.createSpan({ cls: 'focus-first-group-header-line' });
		for (const task of tasks) {
			this.renderTask(list, task);
		}
	}
}

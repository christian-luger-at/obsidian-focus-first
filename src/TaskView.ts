import { ItemView, WorkspaceLeaf, TFile, setIcon, debounce } from 'obsidian';
import FocusFirstPlugin from './main';
import { scanTasks, TaskItem, isFutureTask } from './taskScanner';
import { resolveAction, moveLinear, moveSection, KeyAction } from './keyboardNav';
import { classifyTasks, MatrixTask, Quadrant } from './matrixClassifier';
import { SortField } from './settings';
import { isTasksPluginEnabled } from './tasksPlugin';
import { t } from './i18n';
import {
	renderTaskItem,
	openTaskFile,
	completeTaskLine,
	toggleFocusTagLine,
	toggleHideTagLine,
	removeTagFromLine,
} from './taskRenderer';

export const FOCUS_FIRST_VIEW_TYPE = 'focus-first-view';

const QUADRANT_ORDER: Quadrant[] = ['do', 'schedule', 'delegate', 'eliminate'];

type DateBucket = '__overdue__' | '__today__' | '__thisweek__' | '__upcoming__' | '__nodate__';

const DATE_FILTER_OPTIONS: DateBucket[] = ['__overdue__', '__today__', '__thisweek__', '__upcoming__', '__nodate__'];

export class FocusFirstView extends ItemView {
	private plugin: FocusFirstPlugin;
	private tasks: TaskItem[] = [];
	private searchQuery = '';
	private activeDateFilters = new Set<DateBucket>();
	private filtersVisible = false;
	// Keyboard selection: the `file:line` of the selected task, and whether the
	// view held focus across a re-render (so we can restore it, issue #11).
	private selectedKey: string | null = null;
	private restoreFocus = false;
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
		this.registerDomEvent(this.contentEl, 'keydown', (e) => this.handleKeydown(e));
		await this.refresh();
	}

	async refresh(): Promise<void> {
		this.tasks = await scanTasks(this.app, this.plugin.settings);
		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		// If a task was keyboard-focused, restore focus after the rebuild.
		const active = contentEl.ownerDocument?.activeElement ?? null;
		this.restoreFocus = !!active && typeof contentEl.contains === 'function' && contentEl.contains(active);
		contentEl.empty();

		const header = contentEl.createDiv({ cls: 'focus-first-header' });
		header.createEl('h4', { text: t().view.title });
		const headerActions = header.createDiv({ cls: 'focus-first-header-actions' });
		const addBtn = headerActions.createEl('button', { cls: 'clickable-icon focus-first-add-btn' });
		setIcon(addBtn, 'plus');
		addBtn.setAttribute('aria-label', String(t().quickAdd.addTaskButton));
		addBtn.addEventListener('click', () => { this.plugin.openQuickAdd(); });
		const refreshBtn = headerActions.createEl('button', { text: t().view.refresh, cls: 'mod-cta focus-first-refresh-btn' });

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

		// Search area groups search input + filter panel visually
		const searchArea = cardsWrapper.createDiv({ cls: 'focus-first-search-area' });
		const searchBar = searchArea.createDiv({ cls: 'focus-first-search-bar' });
		const searchInput = searchBar.createEl('input', {
			cls: 'focus-first-search-input',
			attr: {
				type: 'text',
				placeholder: t().view.searchPlaceholder,
				value: this.searchQuery,
			},
		});
		const filterToggle = searchBar.createEl('button', {
			cls: `focus-first-filter-toggle${this.filtersVisible ? ' is-open' : ''}`,
		});
		filterToggle.setAttribute('aria-label', String(t().view.filterToggle));
		filterToggle.setAttribute('title', String(t().view.filterToggle));
		const updateFilterToggle = () => {
			filterToggle.empty();
			setIcon(filterToggle, 'sliders-horizontal');
			if (this.activeDateFilters.size > 0) {
				filterToggle.createEl('span', {
					text: String(this.activeDateFilters.size),
					cls: 'focus-first-filter-badge',
				});
			}
			filterToggle.classList.toggle('has-active', this.activeDateFilters.size > 0);
		};
		updateFilterToggle();

		const filterPanel = searchArea.createDiv({
			cls: `focus-first-filter-panel${this.filtersVisible ? '' : ' focus-first-hidden'}`,
		});

		// Declare containers before closures reference them
		const focusContainer = cardsWrapper.createDiv({ cls: 'focus-first-focus-container' });
		const matrixContainer = contentEl.createDiv({ cls: 'focus-first-matrix-container' });

		this.renderFilterPanel(filterPanel, () => {
			updateFilterToggle();
			this.renderFocusTasks(focusContainer);
			this.renderMatrix(contentEl, matrixContainer);
		});

		filterToggle.addEventListener('click', () => {
			this.filtersVisible = !this.filtersVisible;
			filterPanel.classList.toggle('focus-first-hidden', !this.filtersVisible);
			filterToggle.classList.toggle('is-open', this.filtersVisible);
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

	private dueBucket(task: TaskItem): string {
		if (!task.dueDate) return '__nodate__';
		const today = new Date(); today.setHours(0, 0, 0, 0);
		const due = new Date(task.dueDate); due.setHours(0, 0, 0, 0);
		const diff = Math.floor((due.getTime() - today.getTime()) / 86400000);
		const dow = today.getDay();
		const daysToSunday = dow === 0 ? 0 : 7 - dow;
		if (diff < 0) return '__overdue__';
		if (diff === 0) return '__today__';
		if (diff <= daysToSunday) return '__thisweek__';
		if (diff <= 14) return '__upcoming__';
		return '__later__';
	}

	private passesDateFilter(task: TaskItem): boolean {
		if (this.activeDateFilters.size === 0) return true;
		return this.activeDateFilters.has(this.dueBucket(task) as DateBucket);
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

		const hideTag = this.plugin.settings.hideTag.trim().toLowerCase();
		const focusTasks = this.tasks.filter(
			(t) => !t.completed
				&& t.tags.some((tag) => tag.toLowerCase() === focusTag)
				&& (!hideTag || !t.tags.some((tag) => tag.toLowerCase() === hideTag))
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
		list.setAttribute('role', 'listbox');
		list.setAttribute('aria-label', String(t().view.focusSectionTitle));
		for (const task of focusTasks) {
			const mt = matrixByKey.get(`${task.file.path}:${task.lineNumber}`);
			if (mt) this.renderTask(list, mt);
		}
	}

	private toggleFocusTag(filePath: string, lineNumber: number, focusTag: string, add: boolean): Promise<void> {
		return toggleFocusTagLine(this.app, this.plugin.settings, filePath, lineNumber, focusTag, add);
	}

	private toggleHideTag(filePath: string, lineNumber: number, hideTag: string): Promise<void> {
		return toggleHideTagLine(this.app, this.plugin.settings, filePath, lineNumber, hideTag);
	}

	private completeTask(filePath: string, lineNumber: number): Promise<void> {
		return completeTaskLine(this.app, filePath, lineNumber);
	}

	private renderMatrix(contentEl: HTMLElement, container: HTMLElement): void {
		container.empty();

		const query = this.searchQuery.toLowerCase();
		const hideTag = this.plugin.settings.hideTag.trim().toLowerCase();
		const open = this.tasks
			.filter((task) => !task.completed)
			.filter((task) => !hideTag || !task.tags.some((tag) => tag.toLowerCase() === hideTag))
			.filter((task) => {
				if (!query) return true;
				const text = task.line.replace(/^[\s\-*]*\[.\]\s*/, '').toLowerCase();
				return text.includes(query) || task.file.basename.toLowerCase().includes(query);
			})
			.filter((task) => this.passesDateFilter(task))
			.filter((task) => this.plugin.settings.futureTasks !== 'hide' || !isFutureTask(task));

		if (open.length === 0) {
			container.createEl('p', { text: t().view.empty, cls: 'focus-first-empty' });
			this.markSelection();
			return;
		}

		const quadrants = classifyTasks(open, this.plugin.settings);
		const matrix = container.createDiv({ cls: 'focus-first-matrix' });

		for (const key of QUADRANT_ORDER) {
			const tasks = quadrants[key];
			const quadrant = t().view.quadrants[key];

			const cell = matrix.createDiv({ cls: `focus-first-quadrant focus-first-quadrant--${key}` });
			cell.setCssProps({ '--quadrant-color': this.plugin.settings.quadrants[key].color });
			this.makeDropTarget(cell, key);
			this.renderHeading(cell, quadrant.title, { subtitle: quadrant.subtitle, count: tasks.length });

			if (tasks.length === 0) {
				const emptyEl = cell.createDiv({ cls: 'focus-first-quadrant-empty' });
				emptyEl.createEl('span', { cls: 'focus-first-quadrant-empty-icon' });
				emptyEl.createEl('p', { text: quadrant.emptyState, cls: 'focus-first-quadrant-empty-text' });
				continue;
			}

			const list = cell.createEl('ul', { cls: 'focus-first-task-list' });
			list.setAttribute('role', 'listbox');
			list.setAttribute('aria-label', quadrant.title);
			const sorted = this.sortTasks(tasks, key);

			if (this.plugin.settings.groupByPrimary) {
				const primaryField = this.plugin.settings.quadrants[key].sort.primary;
				const groups = new Map<string, MatrixTask[]>();
				for (const task of sorted) {
					const gk = this.groupKey(task, primaryField);
					if (!groups.has(gk)) groups.set(gk, []);
					groups.get(gk)!.push(task);
				}
				const sortedKeys = [...groups.keys()].sort(this.groupOrder(primaryField));
				for (const gk of sortedKeys) {
					this.renderTaskGroup(list, this.groupLabel(gk, primaryField), groups.get(gk)!);
				}
			} else {
				for (const task of sorted) {
					this.renderTask(list, task);
				}
			}
		}

		this.markSelection();
	}

	private renderTask(parent: HTMLElement, task: MatrixTask): void {
		renderTaskItem(parent, task, this.app, this.plugin.settings);
	}

	// --- Keyboard navigation (issue #11) -----------------------------------

	/** All rendered task items in document order (focus section, then quadrants). */
	private taskItems(): HTMLElement[] {
		const el = this.contentEl as HTMLElement & { findAll?: (selector: string) => HTMLElement[] };
		return typeof el.findAll === 'function' ? el.findAll('.focus-first-task-item') : [];
	}

	private itemKey(el: HTMLElement): string {
		return `${el.getAttribute('data-file-path') ?? ''}:${el.getAttribute('data-line') ?? ''}`;
	}

	/** The section a task item belongs to, used for ←/→ section jumps. */
	private itemSection(el: HTMLElement): string {
		const quadrant = el.closest('.focus-first-quadrant');
		if (quadrant) {
			const match = /focus-first-quadrant--(\w+)/.exec(quadrant.className);
			return match?.[1] ? `q:${match[1]}` : 'q';
		}
		return el.closest('.focus-first-focus-container') ? 'focus' : '';
	}

	/**
	 * Applies the current selection to the rendered items: marks the selected one
	 * (class + aria + tabindex) and makes exactly one item tabbable so the list is
	 * reachable by Tab. Restores DOM focus if the view held it across a rebuild.
	 */
	private markSelection(): void {
		const items = this.taskItems();
		const restore = this.restoreFocus;
		this.restoreFocus = false;
		if (items.length === 0) return;

		let selected = this.selectedKey
			? items.find((el) => this.itemKey(el) === this.selectedKey)
			: undefined;
		if (!selected) this.selectedKey = null;

		items.forEach((el) => {
			const isSel = el === selected;
			el.classList.toggle('is-selected', isSel);
			el.setAttribute('aria-selected', String(isSel));
			el.tabIndex = isSel ? 0 : -1;
		});
		// Keep the list Tab-reachable even with nothing selected.
		const tabbable = selected ?? items[0];
		if (tabbable) tabbable.tabIndex = 0;

		if (restore && tabbable) {
			tabbable.focus();
			tabbable.scrollIntoView({ block: 'nearest' });
		}
	}

	private selectIndex(items: HTMLElement[], index: number): void {
		const el = items[index];
		if (!el) return;
		this.selectedKey = this.itemKey(el);
		items.forEach((item) => {
			const isSel = item === el;
			item.classList.toggle('is-selected', isSel);
			item.setAttribute('aria-selected', String(isSel));
			item.tabIndex = isSel ? 0 : -1;
		});
		el.focus();
		el.scrollIntoView({ block: 'nearest' });
	}

	private async openTaskAt(filePath: string, lineNumber: number): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (file instanceof TFile) {
			await openTaskFile(this.app, { file, lineNumber } as TaskItem);
		}
	}

	private handleKeydown(e: KeyboardEvent): void {
		// Don't hijack typing in the search box (or any input): the keyboard
		// shortcuts must only apply when focus is on the list, not a text field.
		const target = e.target as HTMLElement | null;
		if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
			return;
		}
		const action = resolveAction(e);
		if (!action) return;
		const items = this.taskItems();
		if (items.length === 0) return;

		let index = this.selectedKey
			? items.findIndex((el) => this.itemKey(el) === this.selectedKey)
			: -1;
		if (index < 0) index = 0;

		if (action.kind === 'move') {
			e.preventDefault();
			this.selectIndex(items, this.nextIndex(items, index, action));
			return;
		}

		const el = items[index];
		if (!el) return;
		const filePath = el.getAttribute('data-file-path') ?? '';
		const line = Number(el.getAttribute('data-line') ?? '0');
		if (!filePath) return;
		e.preventDefault();
		this.dispatchAction(action, el, filePath, line);
	}

	private nextIndex(items: HTMLElement[], index: number, action: KeyAction): number {
		if (action.kind !== 'move') return index;
		if (action.dir === 'up') return moveLinear(index, items.length, -1);
		if (action.dir === 'down') return moveLinear(index, items.length, 1);
		const sections = items.map((el) => this.itemSection(el));
		return moveSection(sections, index, action.dir === 'nextSection' ? 1 : -1);
	}

	private dispatchAction(action: KeyAction, el: HTMLElement, filePath: string, line: number): void {
		const settings = this.plugin.settings;
		switch (action.kind) {
			case 'open':
				void this.openTaskAt(filePath, line);
				break;
			case 'complete':
				void this.completeTask(filePath, line);
				break;
			case 'focus': {
				const focusTag = settings.focusTag.trim();
				if (!focusTag) break;
				void this.toggleFocusTag(filePath, line, focusTag, !el.classList.contains('is-focused'));
				break;
			}
			case 'hide': {
				const hideTag = settings.hideTag.trim();
				if (!hideTag) break;
				void this.toggleHideTag(filePath, line, hideTag);
				break;
			}
			case 'moveQuadrant':
				void this.moveTaskToQuadrant(filePath, line, action.quadrant);
				break;
		}
	}

	private static readonly PRIORITY_ORDER = ['🔺', '⏫', '🔼', '🔽', '⏬'];

	private compareFn(field: SortField): (a: MatrixTask, b: MatrixTask) => number {
		switch (field) {
			case 'priority':
				return (a, b) => {
					const ai = a.priority ? FocusFirstView.PRIORITY_ORDER.indexOf(a.priority) : 99;
					const bi = b.priority ? FocusFirstView.PRIORITY_ORDER.indexOf(b.priority) : 99;
					return ai - bi;
				};
			case 'dueDate':
				return (a, b) => {
					if (!a.dueDate && !b.dueDate) return 0;
					if (!a.dueDate) return 1;
					if (!b.dueDate) return -1;
					return a.dueDate.getTime() - b.dueDate.getTime();
				};
			case 'alpha':
				return (a, b) => {
					const textA = a.line.replace(/^[\s\-*]*\[.\]\s*/, '').toLowerCase();
					const textB = b.line.replace(/^[\s\-*]*\[.\]\s*/, '').toLowerCase();
					return textA.localeCompare(textB);
				};
		}
	}

	private sortTasks(tasks: MatrixTask[], quadrant: Quadrant): MatrixTask[] {
		const { primary, secondary } = this.plugin.settings.quadrants[quadrant].sort;
		const fns = [this.compareFn(primary), this.compareFn(secondary)];
		return [...tasks].sort((a, b) => {
			for (const fn of fns) {
				const r = fn(a, b);
				if (r !== 0) return r;
			}
			return 0;
		});
	}

	private groupKey(task: MatrixTask, field: SortField): string {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		switch (field) {
			case 'priority':
				return task.priority ?? '__none__';
			case 'dueDate': {
				if (!task.dueDate) return '__nodate__';
				const due = new Date(task.dueDate);
				due.setHours(0, 0, 0, 0);
				const diff = Math.floor((due.getTime() - today.getTime()) / 86_400_000);
				if (diff < 0) return '__overdue__';
				if (diff === 0) return '__today__';
				const dayOfWeek = today.getDay();
				const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
				if (diff <= daysToSunday) return '__thisweek__';
				if (diff <= 14) return '__upcoming__';
				return '__later__';
			}
			case 'alpha': {
				const text = task.line.replace(/^[\s\-*]*\[.\]\s*/, '').trim();
				return text.charAt(0).toUpperCase() || '#';
			}
		}
	}

	private groupLabel(key: string, field: SortField): string {
		const g = t().groups;
		if (field === 'priority') {
			if (key === '__none__') return g.noPriority;
			return key;
		}
		if (field === 'dueDate') {
			const map: Record<string, string> = {
				'__overdue__':  g.overdue,
				'__today__':    g.today,
				'__thisweek__': g.thisWeek,
				'__upcoming__': g.upcoming,
				'__later__':    g.later,
				'__nodate__':   g.noDate,
			};
			return map[key] ?? key;
		}
		return key;
	}

	private groupOrder(field: SortField): (a: string, b: string) => number {
		if (field === 'priority') {
			const order = [...FocusFirstView.PRIORITY_ORDER, '__none__'];
			return (a, b) => order.indexOf(a) - order.indexOf(b);
		}
		if (field === 'dueDate') {
			const order = ['__overdue__', '__today__', '__thisweek__', '__upcoming__', '__later__', '__nodate__'];
			return (a, b) => order.indexOf(a) - order.indexOf(b);
		}
		return (a, b) => a.localeCompare(b);
	}

	private renderTaskGroup(list: HTMLElement, label: string, tasks: MatrixTask[]): void {
		const header = list.createEl('li', { cls: 'focus-first-group-header' });
		header.createEl('span', { text: label, cls: 'focus-first-group-header-label' });
		header.createEl('span', { cls: 'focus-first-group-header-line' });
		for (const task of tasks) {
			this.renderTask(list, task);
		}
	}

	private makeDropTarget(cell: HTMLElement, targetQuadrant: Quadrant): void {
		cell.addEventListener('dragover', (e) => {
			e.preventDefault();
			cell.classList.add('is-drag-over');
		});
		cell.addEventListener('dragleave', (e) => {
			if (!cell.contains(e.relatedTarget as Node)) {
				cell.classList.remove('is-drag-over');
			}
		});
		cell.addEventListener('drop', (e) => {
			e.preventDefault();
			cell.classList.remove('is-drag-over');
			const raw = e.dataTransfer?.getData('application/json');
			if (!raw) return;

			// Defensively parse — a drop can carry foreign or malformed payloads.
			let data: unknown;
			try {
				data = JSON.parse(raw);
			} catch {
				return;
			}
			if (typeof data !== 'object' || data === null) return;
			const { filePath, lineNumber, quadrant: sourceQuadrant } = data as {
				filePath?: unknown;
				lineNumber?: unknown;
				quadrant?: unknown;
			};
			if (typeof filePath !== 'string' || typeof lineNumber !== 'number') return;
			if (sourceQuadrant === targetQuadrant) return;
			void this.moveTaskToQuadrant(filePath, lineNumber, targetQuadrant);
		});
	}

	private async moveTaskToQuadrant(filePath: string, lineNumber: number, targetQuadrant: Quadrant): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return;

		const content = await this.app.vault.read(file);
		const lines = content.split('\n');
		const line = lines[lineNumber];
		if (line === undefined) return;

		const { quadrants } = this.plugin.settings;
		const quadrantTags = (['do', 'schedule', 'delegate', 'eliminate'] as const)
			.map((key) => quadrants[key].tag.trim())
			.filter(Boolean);

		let newLine = line;
		for (const tag of quadrantTags) {
			newLine = removeTagFromLine(newLine, tag);
		}

		const targetTag = this.plugin.settings.quadrants[targetQuadrant].tag.trim();
		if (targetTag) {
			newLine = newLine.trimEnd() + ' ' + targetTag;
		}

		lines[lineNumber] = newLine;
		await this.app.vault.modify(file, lines.join('\n'));
	}

	private openTask(task: TaskItem): Promise<void> {
		return openTaskFile(this.app, task);
	}
}

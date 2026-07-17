import { ItemView, WorkspaceLeaf, TFile, setIcon, debounce, Platform } from 'obsidian';
import FocusFirstPlugin from './main';
import { scanTasks, TaskItem, isFutureTask, isHiddenTask } from './taskScanner';
import {
	classifyTasks, MatrixTask, Quadrant, matchesTriageFilter, isUnclassified,
	TriageFilter, TriageSystem,
} from './matrixClassifier';
import { t } from './i18n';
import { taskTitle, openTaskFile, sizeLabel, wireDetailHover } from './taskRenderer';
import { sortTasks } from './taskSorting';
import { renderNoMatches } from './taskEmptyStates';
import { moveTaskToQuadrant, moveTaskToValueEffort } from './taskDragDrop';
import { showUndoNotice } from './undo';

export const FOCUS_FIRST_TRIAGE_VIEW_TYPE = 'focus-first-triage-view';

const QUADRANT_ORDER: Quadrant[] = ['do', 'schedule', 'delegate', 'eliminate'];

/**
 * A dedicated, deliberately spare view for clearing the backlog of tasks no
 * matrix has placed yet. It is a flat list, not the 2×2 grid: the matrix hides
 * how many tasks are unjudged (they all pile into "Eliminate"), so this view
 * surfaces exactly those and lets you assign each to a slot with one click, from
 * a picker that appears on hover. Kept separate from the matrix view on purpose,
 * so neither screen is overloaded.
 *
 * No Add button and text-only search: this is a place to sort what already
 * exists, not to create or slice it.
 */
export class TriageView extends ItemView {
	private plugin: FocusFirstPlugin;
	private tasks: TaskItem[] = [];
	private searchQuery = '';
	private searchVisible = false;
	private triageScope: TriageFilter = 'both';
	private debouncedRefresh = debounce(() => this.refresh(), 500, true);

	constructor(leaf: WorkspaceLeaf, plugin: FocusFirstPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return FOCUS_FIRST_TRIAGE_VIEW_TYPE;
	}

	getDisplayText(): string {
		return String(t().view.triage.viewTitle);
	}

	getIcon(): string {
		return 'inbox';
	}

	async onOpen(): Promise<void> {
		this.contentEl.addClass('focus-first-view');
		this.contentEl.addClass('focus-first-triage-view');
		this.contentEl.style.setProperty('--focus-first-font-scale', String(this.plugin.settings.fontSize / 100));
		this.registerEvent(
			this.app.metadataCache.on('changed', (_file: TFile) => this.debouncedRefresh()),
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
		const tr = t().view.triage;

		const header = contentEl.createDiv({ cls: 'focus-first-header' });
		header.createEl('h4', { text: String(tr.viewTitle) });
		const headerActions = header.createDiv({ cls: 'focus-first-header-actions' });

		// Scope: which system's "unclassified" set to work through, or both at once.
		const scopeSelect = headerActions.createEl('select', { cls: 'dropdown focus-first-triage-scope' });
		scopeSelect.setAttribute('aria-label', String(tr.filterLabel));
		const scopes: { value: TriageFilter; label: string }[] = [
			{ value: 'both', label: String(tr.filterBoth) },
			{ value: 'eisenhower', label: String(tr.filterEisenhower) },
			{ value: 'valueEffort', label: String(tr.filterValueEffort) },
		];
		for (const s of scopes) {
			scopeSelect.createEl('option', { text: s.label, attr: { value: s.value } });
		}
		scopeSelect.value = this.triageScope;
		scopeSelect.addEventListener('change', () => {
			this.triageScope = scopeSelect.value as TriageFilter;
			this.render();
		});

		const searchToggleBtn = headerActions.createEl('button', { cls: 'mod-cta focus-first-search-toggle' });
		setIcon(searchToggleBtn, 'search');
		searchToggleBtn.createSpan({ text: String(t().view.searchToggle) });
		searchToggleBtn.setAttribute('aria-label', String(t().view.searchToggle));

		const refreshBtn = headerActions.createEl('button', { cls: 'focus-first-refresh-btn' });
		setIcon(refreshBtn, 'refresh-cw');
		refreshBtn.setAttribute('aria-label', String(t().view.refresh));
		refreshBtn.setAttribute('title', String(t().view.refresh));
		refreshBtn.addEventListener('click', () => { void this.refresh(); });

		// Text-only search: no date or size filters here; narrowing by hand is what
		// the matrix view is for; triage is about emptying the pile.
		this.searchVisible = this.searchVisible || this.searchQuery !== '';
		const searchArea = contentEl.createDiv({
			cls: `focus-first-search-area${this.searchVisible ? '' : ' focus-first-hidden'}`,
		});
		searchToggleBtn.classList.toggle('is-active', this.searchVisible);
		const searchBar = searchArea.createDiv({ cls: 'focus-first-search-bar' });
		const searchInput = searchBar.createEl('input', {
			cls: 'focus-first-search-input',
			attr: { type: 'text', placeholder: t().view.searchPlaceholder, value: this.searchQuery },
		});

		const listContainer = contentEl.createDiv({ cls: 'focus-first-triage-container' });

		searchToggleBtn.addEventListener('click', () => {
			this.searchVisible = !this.searchVisible;
			searchArea.classList.toggle('focus-first-hidden', !this.searchVisible);
			searchToggleBtn.classList.toggle('is-active', this.searchVisible);
			if (this.searchVisible) searchInput.focus();
		});
		searchInput.addEventListener('input', () => {
			this.searchQuery = searchInput.value;
			this.renderList(listContainer);
		});

		this.renderList(listContainer);
	}

	/** Removes any open hover popover that showTaskDetail moved onto the view root. */
	private closeStrayPopovers(): void {
		for (const el of this.contentEl.findAll('.focus-first-triage-detail')) {
			if (el.classList.contains('is-open')) el.remove();
		}
	}

	/** The system(s) whose slot buttons to offer, per the active scope. */
	private systems(): TriageSystem[] {
		return this.triageScope === 'both' ? ['eisenhower', 'valueEffort'] : [this.triageScope];
	}

	private candidates(): TaskItem[] {
		const query = this.searchQuery.toLowerCase();
		return this.tasks
			.filter((task) => !task.completed)
			.filter((task) => !isHiddenTask(task, this.plugin.settings))
			.filter((task) => this.plugin.settings.futureTasks !== 'hide' || !isFutureTask(task))
			.filter((task) => {
				if (!query) return true;
				const text = task.line.replace(/^[\s\-*]*\[.\]\s*/, '').toLowerCase();
				return text.includes(query) || task.file.basename.toLowerCase().includes(query);
			})
			.filter((task) => matchesTriageFilter(task, this.plugin.settings, this.triageScope));
	}

	private renderList(container: HTMLElement): void {
		// showTaskDetail reparents an open hover popover onto the view root to position
		// it; a re-render clears the list but not the root, so that popover would
		// linger. Drop any open stray first.
		this.closeStrayPopovers();
		container.empty();
		const tr = t().view.triage;
		const items = this.candidates();

		if (items.length === 0) {
			if (this.searchQuery !== '') {
				renderNoMatches(container, () => {
					this.searchQuery = '';
					this.render();
				});
			} else {
				container.createEl('p', { text: String(tr.empty), cls: 'focus-first-triage-empty' });
			}
			return;
		}

		// Sort by title (A→Z). classifyTasks only attaches the quadrant/manual fields
		// sortTasks and the row need; the slot they land in is irrelevant here.
		const byQuadrant = classifyTasks(items, this.plugin.settings);
		const flat: MatrixTask[] = [];
		for (const q of QUADRANT_ORDER) flat.push(...byQuadrant[q]);
		const sorted = sortTasks(flat, { primary: 'alpha', secondary: 'dueDate' });

		// The whole result list lives in a card box, like a matrix quadrant.
		const box = container.createDiv({ cls: 'focus-first-triage-box' });

		// Box header: title and count.
		const head = box.createDiv({ cls: 'setting-item setting-item-heading focus-first-heading' });
		const info = head.createDiv({ cls: 'setting-item-info' });
		info.createDiv({ text: String(tr.sectionTitle), cls: 'setting-item-name' });
		const headControl = head.createDiv({ cls: 'setting-item-control' });
		headControl.createSpan({ text: String(sorted.length), cls: 'focus-first-quadrant-count' });

		const list = box.createEl('ul', { cls: 'focus-first-task-list focus-first-triage-list' });
		for (const task of sorted) this.renderRow(list, task);
	}

	/**
	 * One triage row: a select checkbox, the task title (opens the note), badges
	 * showing which properties are already set, and the slot buttons. The buttons
	 * reveal on hover (like the matrix rows), but inline rather than in a floating
	 * popover, so the list still scrolls and nothing is covered. None of the matrix
	 * row's edit actions (complete, focus, hide, ...) appear: triage is only about
	 * placing the task.
	 */
	private renderRow(list: HTMLElement, task: MatrixTask): void {
		const li = list.createEl('li', { cls: 'focus-first-task-item focus-first-triage-item' });

		const title = li.createSpan({ cls: 'focus-first-task-text', text: taskTitle(task.line) });
		title.addEventListener('click', (e) => { e.stopPropagation(); void openTaskFile(this.app, task); });

		this.renderSignalBadges(li, task);

		// Mobile has no hover: a chevron marks the row, and tapping it (not the title,
		// which stops propagation) expands the picker inline.
		if (Platform.isMobile) {
			setIcon(li.createSpan({ cls: 'focus-first-expand-chevron' }), 'chevron-down');
			li.addEventListener('click', () => { li.classList.toggle('is-expanded'); });
		}

		// The picker lives in a floating detail popover revealed on hover, the same
		// mechanism the matrix rows use: the list stays compact and does not reflow,
		// and a row that slides under a still cursor does not open on its own.
		const detail = li.createDiv({ cls: 'focus-first-task-detail focus-first-triage-detail' });
		detail.createDiv({
			cls: 'focus-first-triage-hint',
			text: this.systems().length > 1
				? String(t().view.triage.pickerHintBoth)
				: String(t().view.triage.pickerHintOne),
		});
		this.buildSlotGrids(
			detail,
			(system, slot) => { void this.assign(task, system, slot); },
			this.currentSlots(task),
		);
		if (!Platform.isMobile) wireDetailHover(li, detail);
	}

	/**
	 * The signals already set on the task, as compact badges: priority, due date,
	 * size, and value tag. This is what makes it visible at a glance which axes are
	 * done and which the buttons still need to fill. Absent signals show nothing.
	 */
	private renderSignalBadges(li: HTMLElement, task: MatrixTask): void {
		const badges = li.createDiv({ cls: 'focus-first-triage-badges' });
		if (task.priority) {
			badges.createSpan({ cls: 'focus-first-triage-badge', text: task.priority });
		}
		if (task.dueDate) {
			badges.createSpan({ cls: 'focus-first-triage-badge', text: `📅 ${task.dueDate.toLocaleDateString()}` });
		}
		if (task.size) {
			badges.createSpan({ cls: 'focus-first-triage-badge', text: sizeLabel(task.size) });
		}
		const valueTag = this.valueTagOf(task);
		if (valueTag) {
			badges.createSpan({ cls: 'focus-first-triage-badge', text: valueTag });
		}
	}

	/** The high/low value tag present on the task, if any (shown as a badge). */
	private valueTagOf(task: MatrixTask): string | null {
		const high = this.plugin.settings.highValueTag.trim();
		const low = this.plugin.settings.lowValueTag.trim();
		const tags = task.tags.map((t) => t.toLowerCase());
		if (high && tags.includes(high.toLowerCase())) return high;
		if (low && tags.includes(low.toLowerCase())) return low;
		return null;
	}

	/**
	 * Renders the target picker for the active system(s) as a mini 2×2 quadrant
	 * grid, laid out and coloured exactly like the matrix: the user clicks the
	 * quadrant they mean, rather than reading a row of buttons. With scope "both",
	 * one grid per system under its label, so one pass can classify for either.
	 */
	private buildSlotGrids(
		container: HTMLElement,
		onAssign: (system: TriageSystem, slot: Quadrant) => void,
		current?: Partial<Record<TriageSystem, Quadrant>>,
	): void {
		const systems = this.systems();
		const axisLabels = t().view.axes;
		for (const system of systems) {
			const labels = system === 'eisenhower' ? t().view.quadrants : t().view.quadrantsValueEffort;
			const chosen = current?.[system];
			const group = container.createDiv({ cls: 'focus-first-slot-group' });
			if (systems.length > 1) {
				group.createSpan({
					cls: 'focus-first-slot-group-label',
					text: system === 'eisenhower' ? String(axisLabels.eisenhower) : String(axisLabels.valueEffort),
				});
			}
			// The four cells in matrix order (do, schedule / delegate, eliminate) fill
			// a 2-column grid, so their positions mirror the matrix quadrants.
			const grid = group.createDiv({ cls: 'focus-first-slot-grid' });
			for (const q of QUADRANT_ORDER) {
				// The cell this system's value is already set to is marked, so with both
				// systems shown it is clear which one has a choice and which is still open.
				const isCurrent = chosen === q;
				// A div, not a <button>: Obsidian's heavy default button styling would
				// otherwise override the quadrant tint and colour (the matrix cells are
				// divs for the same reason). role/tabindex keep it keyboard-operable.
				const cell = grid.createDiv({
					cls: `focus-first-slot-btn focus-first-slot-btn--${q}${isCurrent ? ' is-current' : ''}`,
					text: labels[q].title,
				});
				cell.setCssProps({ '--quadrant-color': this.plugin.settings.quadrants[q].color });
				cell.setAttribute('role', 'button');
				cell.setAttribute('tabindex', '0');
				// aria-label alone drives Obsidian's own tooltip (the axes as its detail);
				// a `title` too would stack a second, native OS tooltip on top.
				const verb = isCurrent ? t().view.triage.currentChoice : t().view.triage.assignTo;
				cell.setAttribute('aria-label', `${verb}: ${labels[q].title} (${labels[q].subtitle})`);
				cell.addEventListener('click', (e) => { e.stopPropagation(); onAssign(system, q); });
				cell.addEventListener('keydown', (e) => {
					if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAssign(system, q); }
				});
			}
		}
	}

	/**
	 * The quadrant each system has already placed the task in, for systems where it
	 * is fully classified. Used to mark the chosen cell in the picker; systems still
	 * open contribute nothing, so the open ones read as "no choice yet".
	 */
	private currentSlots(task: MatrixTask): Partial<Record<TriageSystem, Quadrant>> {
		const out: Partial<Record<TriageSystem, Quadrant>> = {};
		for (const system of ['eisenhower', 'valueEffort'] as TriageSystem[]) {
			if (isUnclassified(task, this.plugin.settings, system)) continue;
			// Classify with the system's own preset, independent of the global
			// axisMode: otherwise, when the matrix view is in Value/Effort mode, the
			// Eisenhower override tag (#do, ...) is ignored and the marking falls back
			// to the priority/date-derived quadrant (Eliminate for a bare task).
			const byQuadrant = classifyTasks([task], { ...this.plugin.settings, axisMode: system });
			for (const q of QUADRANT_ORDER) {
				if (byQuadrant[q].length > 0) { out[system] = q; break; }
			}
		}
		return out;
	}

	private async assign(task: MatrixTask, system: TriageSystem, slot: Quadrant): Promise<void> {
		const { settings } = this.plugin;
		const { path } = task.file;
		// No expected-line guard here (unlike the matrix drag): a triage click is a
		// deliberate action on the row the user is pointing at, and the guard would
		// otherwise drop a second assignment whenever the re-scanned line still lags
		// the just-written one (setting the other system, or changing an already-set
		// one). The write always targets this row's line.
		const snap = system === 'eisenhower'
			? await moveTaskToQuadrant(this.app, settings, path, task.lineNumber, slot)
			: await moveTaskToValueEffort(this.app, settings, path, task.lineNumber, slot);
		showUndoNotice(this.app, String(t().view.triage.assigned), snap);
		// Re-render now: vault.modify has already refreshed the read cache, and the
		// tags are parsed from that content, so the row reflects the change at once.
		// (The metadataCache "changed" event only fires a debounced refresh 500ms
		// later, which on its own feels like nothing happened.)
		await this.refresh();
	}
}

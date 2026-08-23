import {
	App,
	PluginSettingTab,
	Setting,
	SettingDefinitionGroup,
	SettingDefinitionItem,
	TFolder,
	TFile,
	AbstractInputSuggest,
	setIcon,
} from 'obsidian';
import FocusFirstPlugin from './main';
import { t } from './i18n';

export type TaskScope = 'all' | 'folder';

export type SortField = 'priority' | 'dueDate' | 'alpha';

/** How to treat tasks whose start/scheduled date is still in the future. */
export type FutureTasksMode = 'show' | 'dim' | 'hide';

/** Where quick-added tasks are written. */
export type QuickAddTarget = 'inbox' | 'active';

export interface QuadrantSort {
	primary: SortField;
	secondary: SortField;
}

export interface QuadrantSettings {
	tag: string;
	color: string;
	sort: QuadrantSort;
}

export interface QuadrantConfig {
	do: QuadrantSettings;
	schedule: QuadrantSettings;
	delegate: QuadrantSettings;
	eliminate: QuadrantSettings;
}

// Priority values as used by the Obsidian Tasks plugin
export const PRIORITY_OPTIONS = [
	{ value: '🔺', label: '🔺 Highest' },
	{ value: '⏫', label: '⏫ High' },
	{ value: '🔼', label: '🔼 Medium' },
	{ value: '🔽', label: '🔽 Low' },
	{ value: '⏬', label: '⏬ Lowest' },
] as const;

export type Priority = (typeof PRIORITY_OPTIONS)[number]['value'];

/** Coarse task size / effort. Deliberately three buckets, never minute estimates. */
export type TaskSize = 'small' | 'medium' | 'large';

/** Which two axes drive the 2×2 matrix (#36). */
export type AxisMode = 'eisenhower' | 'valueEffort';

/** Where the Value axis gets its value from, in the Value/Effort matrix (#36). */
export type ValueSource = 'priority' | 'manualTag';

/** The open, configurable tags that mark a task's size (defaults #s / #m / #l). */
export interface SizeTags {
	small: string;
	medium: string;
	large: string;
}

/** The configured size tags, trimmed and with empties dropped, in size order. */
export function sizeTagList(settings: FocusFirstSettings): string[] {
	return [settings.sizeTags.small, settings.sizeTags.medium, settings.sizeTags.large]
		.map((tag) => tag.trim())
		.filter(Boolean);
}

export interface FocusFirstSettings {
	taskScope: TaskScope;
	taskFolder: string;
	/** Whether indented subtasks are scanned as their own matrix items. */
	showSubtasks: boolean;
	urgencyDays: number;
	importantPriorities: Priority[];
	quadrants: QuadrantConfig;
	groupByPrimary: boolean;
	focusTag: string;
	/** Optional daily target for the focus shortlist (0 = no target). */
	focusTargetCount: number;
	/**
	 * Manual order of the focus shortlist, as stable per-task keys
	 * (`${filePath}::${title}`). Tasks not listed here fall back to the
	 * importance sort and are appended. Rewritten on every drag-reorder, so it
	 * only ever holds keys for tasks currently in focus.
	 */
	focusOrder: string[];
	hideTag: string;
	/** Open, configurable tags marking task size / effort (foundation for #35). */
	sizeTags: SizeTags;
	/** Which two axes drive the matrix: Eisenhower or Value/Effort (#36). */
	axisMode: AxisMode;
	/** Where the Value axis reads value from in the Value/Effort matrix (#36). */
	valueSource: ValueSource;
	/** Override tag that forces high value, always winning over the source (#36). */
	highValueTag: string;
	/** Override tag that forces low value, always winning over the source (#36). */
	lowValueTag: string;
	/** Which sizes count as "low effort" on the effort axis (#36). */
	lowEffortSizes: TaskSize[];
	futureTasks: FutureTasksMode;
	quickAddTarget: QuickAddTarget;
	quickAddInbox: string;
	/** Whether the detail popover shows the "why here" classification reason. */
	showWhyHere: boolean;
	fontSize: number;
	/** Set once the user dismisses the "Tasks plugin not enabled" notice. */
	tasksPluginWarningDismissed: boolean;
}

export const DEFAULT_SETTINGS: FocusFirstSettings = {
	taskScope: 'all',
	taskFolder: '',
	showSubtasks: true,
	urgencyDays: 3,
	importantPriorities: ['🔺', '⏫'],
	quadrants: {
		do:       { tag: '#do',       color: '#c92a2a', sort: { primary: 'dueDate',  secondary: 'priority' } },
		schedule: { tag: '#schedule', color: '#1864ab', sort: { primary: 'priority', secondary: 'dueDate'  } },
		delegate: { tag: '#delegate', color: '#e67700', sort: { primary: 'dueDate',  secondary: 'priority' } },
		eliminate:{ tag: '#eliminate',color: '#868e96', sort: { primary: 'alpha',    secondary: 'priority' } },
	},
	groupByPrimary: true,
	focusTag: '#focus',
	focusTargetCount: 0,
	focusOrder: [],
	hideTag: '#hide',
	sizeTags: { small: '#s', medium: '#m', large: '#l' },
	axisMode: 'eisenhower',
	valueSource: 'priority',
	highValueTag: '#highvalue',
	lowValueTag: '#lowvalue',
	lowEffortSizes: ['small'],
	futureTasks: 'show',
	quickAddTarget: 'inbox',
	quickAddInbox: '',
	showWhyHere: true,
	fontSize: 100,
	tasksPluginWarningDismissed: false,
};

export class FolderSuggest extends AbstractInputSuggest<TFolder> {
	private inputEl: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.inputEl = inputEl;
	}

	getSuggestions(query: string): TFolder[] {
		const lower = query.toLowerCase();
		return this.app.vault
			.getAllLoadedFiles()
			.filter((f): f is TFolder => f instanceof TFolder && f.path.toLowerCase().contains(lower))
			.slice(0, 20);
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.setText(folder.path);
	}

	selectSuggestion(folder: TFolder): void {
		this.inputEl.value = folder.path;
		this.inputEl.trigger('input');
		this.close();
	}
}

/** Autocomplete for a Markdown note path (used by the inbox target fields). */
export class FileSuggest extends AbstractInputSuggest<TFile> {
	private inputEl: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.inputEl = inputEl;
	}

	getSuggestions(query: string): TFile[] {
		const lower = query.toLowerCase();
		return this.app.vault
			.getMarkdownFiles()
			.filter((f) => f.path.toLowerCase().contains(lower))
			.slice(0, 20);
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.setText(file.path);
	}

	selectSuggestion(file: TFile): void {
		this.inputEl.value = file.path;
		this.inputEl.trigger('input');
		this.close();
	}
}

/**
 * Focus First's entry in Settings → Community plugins.
 *
 * Implements both settings APIs on purpose:
 *
 * - `getSettingDefinitions()` is Obsidian 1.13+'s declarative API. Obsidian
 *   renders the tab from it and, the point of the exercise, indexes every
 *   setting for the settings search added in that release.
 * - `display()` is the imperative pre-1.13 API. It is deprecated, but its own
 *   docs say to "only implement display() as a fallback for plugins that need
 *   to support Obsidian versions older than 1.13.0" - manifest.json's
 *   minAppVersion is 1.12.0, so this plugin is exactly that case. On 1.13+ it
 *   is never called (a non-empty getSettingDefinitions() takes precedence).
 *
 * Two renderers for one screen is a drift risk, so everything with no
 * equivalent declarative control type (the folder/file pickers with their
 * suggesters, the multi-select pill groups, the colour field with its reset
 * button, the collapsible quadrant blocks) lives in one shared helper that
 * both paths call, rather than being written out twice. What is unavoidably
 * duplicated is the plain inputs' names, descriptions, and options: the
 * declarative path lists them as data, display() passes them to Setting.
 *
 * The declarative path is built against the official 1.13.1 type definitions,
 * not guessed, but it is unverified against a running 1.13 build: 1.13 is still
 * Catalyst-only early access at the time of writing, and the test suite
 * exercises display() (which is what a 1.12 install runs) plus
 * getSettingDefinitions()' own shape and its getControlValue/setControlValue
 * backing.
 */
export class FocusFirstSettingTab extends PluginSettingTab {
	plugin: FocusFirstPlugin;

	// The four per-quadrant detail blocks are collapsed by default — they're the
	// biggest contributor to clutter. They are the only collapsible sections.
	private collapsedSections = new Set<string>([
		'quadrant-do', 'quadrant-schedule', 'quadrant-delegate', 'quadrant-eliminate',
	]);

	constructor(app: App, plugin: FocusFirstPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/**
	 * Renders a plain section: a heading row followed by a body container that
	 * the caller fills via `render`. No collapse behavior.
	 */
	private createSection(
		containerEl: HTMLElement,
		title: string,
		render: (body: HTMLElement) => void,
	): void {
		new Setting(containerEl).setName(title).setHeading();
		const body = containerEl.createDiv({ cls: 'focus-first-section-body' });
		render(body);
	}

	/**
	 * Renders a collapsible section: a clickable heading row with a chevron, and a
	 * body container that the caller fills via `render`. Collapsed state persists
	 * for the lifetime of this tab instance (per Obsidian settings-dialog session).
	 */
	private createCollapsibleSection(
		containerEl: HTMLElement,
		key: string,
		title: string,
		render: (body: HTMLElement) => void,
	): void {
		// `toggle` is assigned below, after `body` and `setCollapsed` exist, but the
		// header (created first so it stays above the body in the DOM) needs a
		// callback now — so we forward through this mutable reference.
		let toggle: () => void = () => {};

		let chevron: { setIcon: (icon: string) => unknown } | undefined;
		const headerSetting = new Setting(containerEl)
			.setName(title)
			.setHeading()
			.addExtraButton((btn) => {
				chevron = btn;
				btn.setIcon(this.collapsedSections.has(key) ? 'chevron-right' : 'chevron-down');
				btn.setTooltip(t().settings.toggleSection);
				btn.onClick(() => toggle());
			});
		headerSetting.settingEl.addClass('focus-first-section-header');
		headerSetting.settingEl.addEventListener('click', (e) => {
			// Avoid double-toggling when the click originated on the chevron button itself
			if ((e.target as HTMLElement).closest('.extra-setting-button')) return;
			toggle();
		});

		const body = containerEl.createDiv({ cls: 'focus-first-section-body' });

		const setCollapsed = (collapsed: boolean) => {
			body.classList.toggle('focus-first-hidden', collapsed);
		};
		setCollapsed(this.collapsedSections.has(key));

		toggle = () => {
			const collapsed = !this.collapsedSections.has(key);
			if (collapsed) {
				this.collapsedSections.add(key);
			} else {
				this.collapsedSections.delete(key);
			}
			setCollapsed(collapsed);
			chevron?.setIcon(collapsed ? 'chevron-right' : 'chevron-down');
		};

		render(body);
	}

	// --- Shared widget helpers --------------------------------------------------
	//
	// Everything below is called by BOTH display() (pre-1.13) and a `render`
	// definition in getSettingDefinitions() (1.13+), so the two paths cannot drift
	// apart. These are the settings with no equivalent declarative control type
	// (pickers with suggesters, multi-select pills, the colour field with its reset
	// button, the collapsible quadrant blocks), so they stay imperative either way.

	/**
	 * Task-folder field: text input with a folder suggester, plus the "no folder
	 * chosen" error line. Returns an updater for that error line, which the caller
	 * also invokes when the scope changes.
	 */
	private renderTaskFolderField(setting: Setting): () => void {
		const errorEl = setting.settingEl.parentElement!.createEl('p', {
			text: t().settings.taskFolder.error,
			cls: 'focus-first-setting-error',
		});
		setting.settingEl.after(errorEl);

		const updateError = () => {
			// Error only when the folder scope is active and the folder is empty.
			const showError = this.plugin.settings.taskScope === 'folder'
				&& this.plugin.settings.taskFolder.trim() === '';
			errorEl.classList.toggle('focus-first-hidden', !showError);
		};

		setting.addText((text) => {
			text
				.setPlaceholder(t().settings.taskFolder.placeholder)
				.setValue(this.plugin.settings.taskFolder)
				.onChange(async (value) => {
					text.inputEl.classList.toggle('is-invalid', value.trim() === '');
					this.plugin.settings.taskFolder = value;
					await this.plugin.saveSettings();
					updateError();
				});
			new FolderSuggest(this.app, text.inputEl);
		});

		updateError();
		return updateError;
	}

	/** Important-priority pills (multi-select), plus the "none selected" error line. */
	private renderPriorityPills(setting: Setting): void {
		const pillGroup = setting.controlEl.createDiv({ cls: 'focus-first-pill-group' });
		const errorEl = setting.settingEl.parentElement!.createEl('p', {
			text: t().settings.importantPriorities.error,
			cls: 'focus-first-setting-error',
		});
		setting.settingEl.after(errorEl);

		const updateError = () => {
			errorEl.classList.toggle('focus-first-hidden', this.plugin.settings.importantPriorities.length > 0);
		};

		for (const option of PRIORITY_OPTIONS) {
			const pill = pillGroup.createEl('button', { text: option.label, cls: 'focus-first-pill' });
			if (this.plugin.settings.importantPriorities.includes(option.value)) {
				pill.classList.add('is-active');
			}
			pill.addEventListener('click', () => { void (async () => {
				const current = this.plugin.settings.importantPriorities;
				const isActive = current.includes(option.value);
				this.plugin.settings.importantPriorities = isActive
					? current.filter((p) => p !== option.value)
					: [...current, option.value];
				pill.classList.toggle('is-active', !isActive);
				await this.plugin.saveSettings();
				updateError();
			})(); });
		}

		updateError();
	}

	/** Low-effort size pills (multi-select) for the Value/Effort preset (#36). */
	private renderLowEffortPills(setting: Setting): void {
		const sizePills = setting.controlEl.createDiv({ cls: 'focus-first-pill-group' });
		const sizeOptions: { value: TaskSize; label: string }[] = [
			{ value: 'small', label: String(t().view.actions.sizeSmall) },
			{ value: 'medium', label: String(t().view.actions.sizeMedium) },
			{ value: 'large', label: String(t().view.actions.sizeLarge) },
		];
		for (const option of sizeOptions) {
			const pill = sizePills.createEl('button', { text: option.label, cls: 'focus-first-pill' });
			if (this.plugin.settings.lowEffortSizes.includes(option.value)) pill.classList.add('is-active');
			pill.addEventListener('click', () => { void (async () => {
				const current = this.plugin.settings.lowEffortSizes;
				const isActive = current.includes(option.value);
				this.plugin.settings.lowEffortSizes = isActive
					? current.filter((s) => s !== option.value)
					: [...current, option.value];
				pill.classList.toggle('is-active', !isActive);
				await this.plugin.saveSettings();
				this.plugin.refreshViews();
			})(); });
		}
	}

	/** Quick-add inbox note field: text input with a Markdown-file suggester. */
	private renderQuickAddInboxField(setting: Setting): void {
		setting.addText((text) => {
			text
				.setPlaceholder(t().settings.quickAddInbox.placeholder)
				.setValue(this.plugin.settings.quickAddInbox)
				.onChange(async (value) => {
					this.plugin.settings.quickAddInbox = value.trim();
					await this.plugin.saveSettings();
				});
			new FileSuggest(this.app, text.inputEl);
		});
	}

	/** Reset-everything button. `afterReset` re-renders whichever path is active. */
	private renderResetButton(setting: Setting, afterReset: () => void): void {
		setting.addButton((button) =>
			button
				.setButtonText(t().settings.resetAll.button)
				// setDestructive() replaces this in 1.13, but this helper also runs on
				// the display() path, i.e. on the 1.12 minAppVersion where the new
				// method does not exist yet. Swap once minAppVersion reaches 1.13.
				// eslint-disable-next-line @typescript-eslint/no-deprecated
				.setWarning()
				.onClick(async () => {
					await this.plugin.resetSettings();
					afterReset();
				}),
		);
	}

	/**
	 * The four settings inside one quadrant's collapsible block: colour (with its
	 * reset button), tag, and the two sort fields. Only the collapsible chrome
	 * around it differs between the two render paths, so just the body is shared.
	 */
	private renderQuadrantBody(qBody: HTMLElement, key: keyof QuadrantConfig): void {
		const q = this.plugin.settings.quadrants[key];

		new Setting(qBody)
			.setName(t().settings.quadrantColor.name)
			.setDesc(t().settings.quadrantColor.desc)
			.addText((text) => {
				text.inputEl.type = 'color';
				text.inputEl.value = q.color;
				text.inputEl.classList.add('focus-first-color-input');
				text.inputEl.addEventListener('input', () => {
					this.plugin.settings.quadrants[key].color = text.inputEl.value;
					void this.plugin.saveSettings();
				});

				const resetBtn = text.inputEl.parentElement?.createEl('button', {
					cls: 'focus-first-color-reset',
					attr: { title: t().settings.quadrantColor.reset, type: 'button' },
				});
				if (resetBtn) {
					setIcon(resetBtn, 'rotate-ccw');
					resetBtn.addEventListener('click', () => {
						const defaultColor = DEFAULT_SETTINGS.quadrants[key].color;
						this.plugin.settings.quadrants[key].color = defaultColor;
						text.inputEl.value = defaultColor;
						void this.plugin.saveSettings();
					});
				}
			});

		new Setting(qBody)
			.setName(t().settings.quadrantTag.name)
			.setDesc(t().settings.quadrantTag.desc)
			.addText((text) =>
				text
					.setPlaceholder(`#${key}`)
					.setValue(q.tag)
					.onChange(async (value) => {
						this.plugin.settings.quadrants[key].tag = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		const sortFieldOptions: Record<SortField, string> = {
			priority: t().settings.sortField.priority,
			dueDate:  t().settings.sortField.dueDate,
			alpha:    t().settings.sortField.alpha,
		};

		new Setting(qBody)
			.setName(t().settings.sortPrimary.name)
			.setDesc(t().settings.sortPrimary.desc)
			.addDropdown((drop) => {
				for (const [value, optLabel] of Object.entries(sortFieldOptions)) {
					drop.addOption(value, optLabel);
				}
				return drop
					.setValue(q.sort.primary)
					.onChange(async (value) => {
						this.plugin.settings.quadrants[key].sort.primary = value as SortField;
						await this.plugin.saveSettings();
					});
			});

		new Setting(qBody)
			.setName(t().settings.sortSecondary.name)
			.setDesc(t().settings.sortSecondary.desc)
			.addDropdown((drop) => {
				for (const [value, optLabel] of Object.entries(sortFieldOptions)) {
					drop.addOption(value, optLabel);
				}
				return drop
					.setValue(q.sort.secondary)
					.onChange(async (value) => {
						this.plugin.settings.quadrants[key].sort.secondary = value as SortField;
						await this.plugin.saveSettings();
					});
			});
	}

	/**
	 * The 1.13+ counterpart to createCollapsibleSection(): builds the same
	 * chevron header and body, but onto a `Setting` the framework hands us rather
	 * than into a container we create. Body content comes from the shared
	 * renderQuadrantBody() either way.
	 */
	private renderQuadrantSection(setting: Setting, key: keyof QuadrantConfig, label: string): void {
		const sectionKey = `quadrant-${key}`;

		setting.setName(label).setHeading();
		setting.settingEl.addClass('focus-first-section-header');

		let toggle: () => void = () => {};
		let chevron: { setIcon: (icon: string) => unknown } | undefined;
		setting.addExtraButton((btn) => {
			chevron = btn;
			btn.setIcon(this.collapsedSections.has(sectionKey) ? 'chevron-right' : 'chevron-down');
			btn.setTooltip(t().settings.toggleSection);
			btn.onClick(() => toggle());
		});
		setting.settingEl.addEventListener('click', (e) => {
			// Avoid double-toggling when the click originated on the chevron button itself
			if ((e.target as HTMLElement).closest('.extra-setting-button')) return;
			toggle();
		});

		const qBody = setting.settingEl.parentElement!.createDiv({ cls: 'focus-first-section-body' });
		setting.settingEl.after(qBody);

		const setCollapsed = (collapsed: boolean) => {
			qBody.classList.toggle('focus-first-hidden', collapsed);
		};
		setCollapsed(this.collapsedSections.has(sectionKey));

		toggle = () => {
			const collapsed = !this.collapsedSections.has(sectionKey);
			if (collapsed) {
				this.collapsedSections.add(sectionKey);
			} else {
				this.collapsedSections.delete(sectionKey);
			}
			setCollapsed(collapsed);
			chevron?.setIcon(collapsed ? 'chevron-right' : 'chevron-down');
		};

		this.renderQuadrantBody(qBody, key);
	}

	// --- Declarative settings (Obsidian 1.13+) ----------------------------------

	/**
	 * Every `control.key` getSettingDefinitions() hands out, as a dotted path into
	 * FocusFirstSettings. Kept as an explicit list so an unknown key fails loudly
	 * (see getControlValue) instead of silently reading or writing nothing.
	 */
	private static readonly CONTROL_KEYS: ReadonlySet<string> = new Set([
		'taskScope', 'showSubtasks', 'urgencyDays', 'futureTasks', 'groupByPrimary',
		'focusTag', 'focusTargetCount', 'hideTag',
		'sizeTags.small', 'sizeTags.medium', 'sizeTags.large',
		'valueSource', 'highValueTag', 'lowValueTag',
		'quickAddTarget', 'fontSize', 'showWhyHere',
	]);

	/** Keys whose change has to reach an open view, mirroring display()'s own onChange handlers. */
	private static readonly REFRESH_VIEWS_KEYS: ReadonlySet<string> = new Set([
		'futureTasks', 'focusTargetCount',
		'sizeTags.small', 'sizeTags.medium', 'sizeTags.large',
		'valueSource', 'highValueTag', 'lowValueTag', 'showWhyHere',
	]);

	/** Keys another setting's `visible` predicate depends on, so the row appears at once. */
	private static readonly REFRESH_DOM_KEYS: ReadonlySet<string> = new Set(['taskScope', 'quickAddTarget']);

	private static assertKnownKey(key: string): void {
		if (FocusFirstSettingTab.CONTROL_KEYS.has(key)) return;
		// Unreachable in practice: Obsidian only asks for keys getSettingDefinitions()
		// itself handed out. A hit means a definition gained a control.key without
		// being added above, which should fail loudly rather than fall through to
		// super.getControlValue() (a 1.13-only API that reads app.vault.getConfig,
		// meaningless for this plugin's own settings).
		throw new Error(`Focus First: no setting registered for control key "${key}"`);
	}

	getControlValue(key: string): unknown {
		FocusFirstSettingTab.assertKnownKey(key);
		return key.split('.').reduce<unknown>(
			(node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
			this.plugin.settings,
		);
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		FocusFirstSettingTab.assertKnownKey(key);
		// Every string control here is a tag or an enum, all of which display()
		// stores trimmed; keep the two paths writing identical values.
		const stored = typeof value === 'string' ? value.trim() : value;

		const parts = key.split('.');
		const last = parts.pop() as string;
		let target = this.plugin.settings as unknown as Record<string, unknown>;
		for (const part of parts) target = target[part] as Record<string, unknown>;
		target[last] = stored;

		await this.plugin.saveSettings();
		if (FocusFirstSettingTab.REFRESH_VIEWS_KEYS.has(key)) this.plugin.refreshViews();
		if (key === 'fontSize') this.plugin.applyFontSize();
		if (FocusFirstSettingTab.REFRESH_DOM_KEYS.has(key)) {
			// 1.13-only API, but this method is only ever called by 1.13+ itself (on
			// older builds display() runs instead and nothing here executes), so the
			// call cannot be reached on the 1.12 minAppVersion the linter checks.
			// eslint-disable-next-line obsidianmd/no-unsupported-api
			this.refreshDomState();
		}
	}

	/**
	 * The 1.13+ declarative shape, mirroring display() below section for section
	 * (same headings, names, descriptions, and order). Plain inputs become
	 * `control` definitions backed by getControlValue()/setControlValue();
	 * everything with no equivalent control type delegates to the very same
	 * helpers display() calls, so the two paths cannot drift.
	 */
	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			this.taskSourcesGroup(),
			this.classificationGroup(),
			this.quadrantsGroup(),
			this.tagsGroup(),
			this.valueEffortGroup(),
			this.quickAddGroup(),
			this.appearanceGroup(),
			this.resetGroup(),
		];
	}

	private taskSourcesGroup(): SettingDefinitionGroup {
		return {
			type: 'group',
			heading: t().settings.taskSourcesHeading,
			items: [
				{
					name: t().settings.taskScope.name,
					desc: t().settings.taskScope.desc,
					control: {
						type: 'dropdown',
						key: 'taskScope',
						options: { all: t().settings.taskScope.optionAll, folder: t().settings.taskScope.optionFolder },
					},
				},
				{
					name: t().settings.taskFolder.name,
					desc: t().settings.taskFolder.desc,
					// display() hides this row with a CSS class; declaratively the
					// framework owns that, re-evaluated via refreshDomState() above.
					visible: () => this.plugin.settings.taskScope === 'folder',
					render: (setting) => { this.renderTaskFolderField(setting); },
				},
				{
					name: t().settings.showSubtasks.name,
					desc: t().settings.showSubtasks.desc,
					control: { type: 'toggle', key: 'showSubtasks' },
				},
			],
		};
	}

	private classificationGroup(): SettingDefinitionGroup {
		return {
			type: 'group',
			heading: t().settings.classificationHeading,
			items: [
				{
					// display() opens this section with a plain hint paragraph. A group
					// has no description of its own, so it becomes a searchable-off row
					// carrying just that text.
					name: t().settings.matrixDesc,
					searchable: false,
					render: (setting) => {
						setting.settingEl.empty();
						setting.settingEl.createEl('p', { text: t().settings.matrixDesc, cls: 'focus-first-setting-hint' });
					},
				},
				{
					name: t().settings.urgencyDays.name,
					desc: t().settings.urgencyDays.desc,
					control: {
						type: 'number',
						key: 'urgencyDays',
						placeholder: '3',
						min: 0,
						max: 364,
						step: 1,
						// Unparseable input falls back to this, i.e. keeps the current
						// value, matching display()'s "don't save when invalid".
						defaultValue: this.plugin.settings.urgencyDays,
						validate: (value) =>
							!Number.isInteger(value) || value < 0 || value >= 365 ? t().settings.urgencyDays.error : undefined,
					},
				},
				{
					name: t().settings.importantPriorities.name,
					desc: t().settings.importantPriorities.desc,
					render: (setting) => { this.renderPriorityPills(setting); },
				},
				{
					name: t().settings.futureTasks.name,
					desc: t().settings.futureTasks.desc,
					control: {
						type: 'dropdown',
						key: 'futureTasks',
						options: {
							show: t().settings.futureTasks.optionShow,
							dim: t().settings.futureTasks.optionDim,
							hide: t().settings.futureTasks.optionHide,
						},
					},
				},
			],
		};
	}

	private quadrantsGroup(): SettingDefinitionGroup {
		const quadrantDefs: { key: keyof QuadrantConfig; label: string }[] = [
			{ key: 'do',       label: t().view.quadrants.do.title },
			{ key: 'schedule', label: t().view.quadrants.schedule.title },
			{ key: 'delegate', label: t().view.quadrants.delegate.title },
			{ key: 'eliminate',label: t().view.quadrants.eliminate.title },
		];

		return {
			type: 'group',
			heading: t().settings.quadrantsHeading,
			items: [
				{
					name: t().settings.groupByPrimary.name,
					desc: t().settings.groupByPrimary.desc,
					control: { type: 'toggle', key: 'groupByPrimary' },
				},
				...quadrantDefs.map((def) => {
					const label = `${def.label} — ${t().view.quadrants[def.key].subtitle}`;
					return {
						name: label,
						render: (setting: Setting) => this.renderQuadrantSection(setting, def.key, label),
					};
				}),
			],
		};
	}

	private tagsGroup(): SettingDefinitionGroup {
		return {
			type: 'group',
			heading: t().settings.tagsHeading,
			items: [
				{
					name: t().settings.focusTag.name,
					desc: t().settings.focusTag.desc,
					control: { type: 'text', key: 'focusTag', placeholder: DEFAULT_SETTINGS.focusTag },
				},
				{
					name: t().settings.focusTargetCount.name,
					desc: t().settings.focusTargetCount.desc,
					// No upper bound and no validate: display() clamps junk to 0, and
					// the shortlist only ever compares this with `> 0`.
					control: { type: 'number', key: 'focusTargetCount', placeholder: '0', min: 0, step: 1, defaultValue: 0 },
				},
				{
					name: t().settings.hideTag.name,
					desc: t().settings.hideTag.desc,
					control: { type: 'text', key: 'hideTag', placeholder: DEFAULT_SETTINGS.hideTag },
				},
				{
					name: t().settings.sizeTagSmall,
					desc: t().settings.sizeTagsDesc,
					control: { type: 'text', key: 'sizeTags.small', placeholder: DEFAULT_SETTINGS.sizeTags.small },
				},
				{
					name: t().settings.sizeTagMedium,
					control: { type: 'text', key: 'sizeTags.medium', placeholder: DEFAULT_SETTINGS.sizeTags.medium },
				},
				{
					name: t().settings.sizeTagLarge,
					control: { type: 'text', key: 'sizeTags.large', placeholder: DEFAULT_SETTINGS.sizeTags.large },
				},
			],
		};
	}

	private valueEffortGroup(): SettingDefinitionGroup {
		return {
			type: 'group',
			heading: t().settings.valueEffortHeading,
			items: [
				{
					name: t().settings.valueSource.name,
					desc: t().settings.valueSource.desc,
					control: {
						type: 'dropdown',
						key: 'valueSource',
						options: {
							priority: t().settings.valueSource.optionPriority,
							manualTag: t().settings.valueSource.optionManualTag,
						},
					},
				},
				{
					name: t().settings.highValueTag.name,
					desc: t().settings.highValueTag.desc,
					control: { type: 'text', key: 'highValueTag', placeholder: DEFAULT_SETTINGS.highValueTag },
				},
				{
					name: t().settings.lowValueTag.name,
					desc: t().settings.lowValueTag.desc,
					control: { type: 'text', key: 'lowValueTag', placeholder: DEFAULT_SETTINGS.lowValueTag },
				},
				{
					name: t().settings.lowEffortSizes.name,
					desc: t().settings.lowEffortSizes.desc,
					render: (setting) => { this.renderLowEffortPills(setting); },
				},
			],
		};
	}

	private quickAddGroup(): SettingDefinitionGroup {
		return {
			type: 'group',
			heading: t().settings.quickAddHeading,
			items: [
				{
					name: t().settings.quickAddTarget.name,
					desc: t().settings.quickAddTarget.desc,
					control: {
						type: 'dropdown',
						key: 'quickAddTarget',
						options: {
							inbox: t().settings.quickAddTarget.optionInbox,
							active: t().settings.quickAddTarget.optionActive,
						},
					},
				},
				{
					name: t().settings.quickAddInbox.name,
					desc: t().settings.quickAddInbox.desc,
					visible: () => this.plugin.settings.quickAddTarget === 'inbox',
					render: (setting) => { this.renderQuickAddInboxField(setting); },
				},
			],
		};
	}

	private appearanceGroup(): SettingDefinitionGroup {
		return {
			type: 'group',
			heading: t().settings.appearanceHeading,
			items: [
				{
					name: t().settings.fontSize.name,
					desc: t().settings.fontSize.desc,
					control: { type: 'slider', key: 'fontSize', min: 70, max: 150, step: 10 },
				},
				{
					name: t().settings.showWhyHere.name,
					desc: t().settings.showWhyHere.desc,
					control: { type: 'toggle', key: 'showWhyHere' },
				},
			],
		};
	}

	private resetGroup(): SettingDefinitionGroup {
		return {
			type: 'group',
			heading: t().settings.resetHeading,
			items: [
				{
					name: t().settings.resetAll.name,
					desc: t().settings.resetAll.desc,
					render: (setting) => {
						this.renderResetButton(setting, () => {
							// Reset changes every value at once, so the whole tab has to be
							// rebuilt. Same 1.13-only-but-unreachable-on-1.12 reasoning as
							// refreshDomState() in setControlValue() above.
							// eslint-disable-next-line obsidianmd/no-unsupported-api
							this.update();
						});
					},
				},
			],
		};
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.createSection(containerEl, t().settings.taskSourcesHeading, (body) => {
			// The folder field is always rendered and just shown/hidden based on the
			// scope, so switching the scope doesn't require re-rendering the tab.
			let updateFolderVisibility: () => void = () => {};

			new Setting(body)
				.setName(t().settings.taskScope.name)
				.setDesc(t().settings.taskScope.desc)
				.addDropdown((drop) =>
					drop
						.addOption('all', t().settings.taskScope.optionAll)
						.addOption('folder', t().settings.taskScope.optionFolder)
						.setValue(this.plugin.settings.taskScope)
						.onChange(async (value: string) => {
							this.plugin.settings.taskScope = value as TaskScope;
							await this.plugin.saveSettings();
							updateFolderVisibility();
						}),
				);

			const folderSetting = new Setting(body)
				.setName(t().settings.taskFolder.name)
				.setDesc(t().settings.taskFolder.desc);
			const updateFolderError = this.renderTaskFolderField(folderSetting);

			updateFolderVisibility = () => {
				const isFolder = this.plugin.settings.taskScope === 'folder';
				folderSetting.settingEl.classList.toggle('focus-first-hidden', !isFolder);
				updateFolderError();
			};
			updateFolderVisibility();

			new Setting(body)
				.setName(t().settings.showSubtasks.name)
				.setDesc(t().settings.showSubtasks.desc)
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.showSubtasks)
						.onChange(async (value) => {
							this.plugin.settings.showSubtasks = value;
							await this.plugin.saveSettings();
						}),
				);
		});

		this.createSection(containerEl, t().settings.classificationHeading, (body) => {
			body.createEl('p', { text: t().settings.matrixDesc, cls: 'focus-first-setting-hint' });

			const urgencySetting = new Setting(body)
				.setName(t().settings.urgencyDays.name)
				.setDesc(t().settings.urgencyDays.desc)
				.addText((text) => {
					text
						.setPlaceholder('3')
						.setValue(String(this.plugin.settings.urgencyDays))
						.onChange(async (value) => {
							const parsed = parseInt(value, 10);
							const valid = !isNaN(parsed) && parsed >= 0 && parsed < 365;
							text.inputEl.classList.toggle('is-invalid', !valid);
							errorEl.classList.toggle('focus-first-hidden', valid);
							if (valid) {
								this.plugin.settings.urgencyDays = parsed;
								await this.plugin.saveSettings();
							}
						});
					text.inputEl.setAttribute('type', 'number');
					text.inputEl.setAttribute('min', '0');
					text.inputEl.setAttribute('max', '364');
				});

			const errorEl = body.createEl('p', {
				text: t().settings.urgencyDays.error,
				cls: 'focus-first-setting-error',
			});
			errorEl.classList.add('focus-first-hidden');
			urgencySetting.settingEl.after(errorEl);

			this.renderPriorityPills(
				new Setting(body)
					.setName(t().settings.importantPriorities.name)
					.setDesc(t().settings.importantPriorities.desc),
			);

			new Setting(body)
				.setName(t().settings.futureTasks.name)
				.setDesc(t().settings.futureTasks.desc)
				.addDropdown((drop) =>
					drop
						.addOption('show', t().settings.futureTasks.optionShow)
						.addOption('dim', t().settings.futureTasks.optionDim)
						.addOption('hide', t().settings.futureTasks.optionHide)
						.setValue(this.plugin.settings.futureTasks)
						.onChange(async (value: string) => {
							this.plugin.settings.futureTasks = value as FutureTasksMode;
							await this.plugin.saveSettings();
							this.plugin.refreshViews();
						}),
				);
		});

		this.createSection(containerEl, t().settings.quadrantsHeading, (body) => {
			new Setting(body)
				.setName(t().settings.groupByPrimary.name)
				.setDesc(t().settings.groupByPrimary.desc)
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.groupByPrimary)
						.onChange(async (value) => {
							this.plugin.settings.groupByPrimary = value;
							await this.plugin.saveSettings();
						}),
				);

			const quadrantDefs: { key: keyof QuadrantConfig; label: string }[] = [
				{ key: 'do',       label: t().view.quadrants.do.title },
				{ key: 'schedule', label: t().view.quadrants.schedule.title },
				{ key: 'delegate', label: t().view.quadrants.delegate.title },
				{ key: 'eliminate',label: t().view.quadrants.eliminate.title },
			];

			for (const def of quadrantDefs) {
				this.createCollapsibleSection(
					body,
					`quadrant-${def.key}`,
					`${def.label} — ${t().view.quadrants[def.key].subtitle}`,
					(qBody) => this.renderQuadrantBody(qBody, def.key),
				);
			}
		});

		this.createSection(containerEl, t().settings.tagsHeading, (body) => {
			new Setting(body)
				.setName(t().settings.focusTag.name)
				.setDesc(t().settings.focusTag.desc)
				.addText((text) =>
					text
						.setPlaceholder(DEFAULT_SETTINGS.focusTag)
						.setValue(this.plugin.settings.focusTag)
						.onChange(async (value) => {
							this.plugin.settings.focusTag = value.trim();
							await this.plugin.saveSettings();
						}),
				);

			new Setting(body)
				.setName(t().settings.focusTargetCount.name)
				.setDesc(t().settings.focusTargetCount.desc)
				.addText((text) => {
					text
						.setPlaceholder('0')
						.setValue(String(this.plugin.settings.focusTargetCount))
						.onChange(async (value) => {
							const parsed = parseInt(value, 10);
							this.plugin.settings.focusTargetCount = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
							await this.plugin.saveSettings();
							this.plugin.refreshViews();
						});
					text.inputEl.setAttribute('type', 'number');
					text.inputEl.setAttribute('min', '0');
				});

			new Setting(body)
				.setName(t().settings.hideTag.name)
				.setDesc(t().settings.hideTag.desc)
				.addText((text) =>
					text
						.setPlaceholder(DEFAULT_SETTINGS.hideTag)
						.setValue(this.plugin.settings.hideTag)
						.onChange(async (value) => {
							this.plugin.settings.hideTag = value.trim();
							await this.plugin.saveSettings();
						}),
				);

			new Setting(body)
				.setName(t().settings.sizeTagSmall)
				.setDesc(t().settings.sizeTagsDesc)
				.addText((text) =>
					text
						.setPlaceholder(DEFAULT_SETTINGS.sizeTags.small)
						.setValue(this.plugin.settings.sizeTags.small)
						.onChange(async (value) => {
							this.plugin.settings.sizeTags.small = value.trim();
							await this.plugin.saveSettings();
							this.plugin.refreshViews();
						}),
				);

			new Setting(body)
				.setName(t().settings.sizeTagMedium)
				.addText((text) =>
					text
						.setPlaceholder(DEFAULT_SETTINGS.sizeTags.medium)
						.setValue(this.plugin.settings.sizeTags.medium)
						.onChange(async (value) => {
							this.plugin.settings.sizeTags.medium = value.trim();
							await this.plugin.saveSettings();
							this.plugin.refreshViews();
						}),
				);

			new Setting(body)
				.setName(t().settings.sizeTagLarge)
				.addText((text) =>
					text
						.setPlaceholder(DEFAULT_SETTINGS.sizeTags.large)
						.setValue(this.plugin.settings.sizeTags.large)
						.onChange(async (value) => {
							this.plugin.settings.sizeTags.large = value.trim();
							await this.plugin.saveSettings();
							this.plugin.refreshViews();
						}),
				);
		});

		// Advanced escape hatch for the Value/Effort preset (#36). The axis itself is
		// switched in the view header; this only configures how value and effort are
		// resolved. Presets stay the primary UX — this is deliberately secondary.
		this.createSection(containerEl, t().settings.valueEffortHeading, (body) => {
			new Setting(body)
				.setName(t().settings.valueSource.name)
				.setDesc(t().settings.valueSource.desc)
				.addDropdown((drop) =>
					drop
						.addOption('priority', t().settings.valueSource.optionPriority)
						.addOption('manualTag', t().settings.valueSource.optionManualTag)
						.setValue(this.plugin.settings.valueSource)
						.onChange(async (value: string) => {
							this.plugin.settings.valueSource = value as ValueSource;
							await this.plugin.saveSettings();
							this.plugin.refreshViews();
						}),
				);

			new Setting(body)
				.setName(t().settings.highValueTag.name)
				.setDesc(t().settings.highValueTag.desc)
				.addText((text) =>
					text
						.setPlaceholder(DEFAULT_SETTINGS.highValueTag)
						.setValue(this.plugin.settings.highValueTag)
						.onChange(async (value) => {
							this.plugin.settings.highValueTag = value.trim();
							await this.plugin.saveSettings();
							this.plugin.refreshViews();
						}),
				);

			new Setting(body)
				.setName(t().settings.lowValueTag.name)
				.setDesc(t().settings.lowValueTag.desc)
				.addText((text) =>
					text
						.setPlaceholder(DEFAULT_SETTINGS.lowValueTag)
						.setValue(this.plugin.settings.lowValueTag)
						.onChange(async (value) => {
							this.plugin.settings.lowValueTag = value.trim();
							await this.plugin.saveSettings();
							this.plugin.refreshViews();
						}),
				);

			this.renderLowEffortPills(
				new Setting(body)
					.setName(t().settings.lowEffortSizes.name)
					.setDesc(t().settings.lowEffortSizes.desc),
			);
		});

		this.createSection(containerEl, t().settings.quickAddHeading, (body) => {
			// The inbox path field is always rendered and shown/hidden by target, so
			// switching the target doesn't require re-rendering the whole tab.
			let updateInboxVisibility: () => void = () => {};

			new Setting(body)
				.setName(t().settings.quickAddTarget.name)
				.setDesc(t().settings.quickAddTarget.desc)
				.addDropdown((drop) =>
					drop
						.addOption('inbox', t().settings.quickAddTarget.optionInbox)
						.addOption('active', t().settings.quickAddTarget.optionActive)
						.setValue(this.plugin.settings.quickAddTarget)
						.onChange(async (value: string) => {
							this.plugin.settings.quickAddTarget = value as QuickAddTarget;
							await this.plugin.saveSettings();
							updateInboxVisibility();
						}),
				);

			const inboxSetting = new Setting(body)
				.setName(t().settings.quickAddInbox.name)
				.setDesc(t().settings.quickAddInbox.desc);
			this.renderQuickAddInboxField(inboxSetting);

			updateInboxVisibility = () => {
				const isInbox = this.plugin.settings.quickAddTarget === 'inbox';
				inboxSetting.settingEl.classList.toggle('focus-first-hidden', !isInbox);
			};
			updateInboxVisibility();
		});

		this.createSection(containerEl, t().settings.appearanceHeading, (body) => {
			new Setting(body)
				.setName(t().settings.fontSize.name)
				.setDesc(t().settings.fontSize.desc)
				.addSlider((slider) =>
					slider
						.setLimits(70, 150, 10)
						.setValue(this.plugin.settings.fontSize)
						.onChange(async (value) => {
							this.plugin.settings.fontSize = value;
							await this.plugin.saveSettings();
							this.plugin.applyFontSize();
						}),
				);

			new Setting(body)
				.setName(t().settings.showWhyHere.name)
				.setDesc(t().settings.showWhyHere.desc)
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.showWhyHere)
						.onChange(async (value) => {
							this.plugin.settings.showWhyHere = value;
							await this.plugin.saveSettings();
							this.plugin.refreshViews();
						}),
				);
		});

		this.createSection(containerEl, t().settings.resetHeading, (body) => {
			this.renderResetButton(
				new Setting(body)
					.setName(t().settings.resetAll.name)
					.setDesc(t().settings.resetAll.desc),
				// Deprecated since 1.13, deliberately: this is the pre-1.13 path, and
				// re-running it is how that path rebuilds the tab. The 1.13 path uses
				// update() instead (see resetGroup()).
				// eslint-disable-next-line @typescript-eslint/no-deprecated
				() => this.display(),
			);
		});
	}
}

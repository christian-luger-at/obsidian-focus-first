import { App, PluginSettingTab, Setting, TFolder, TFile, AbstractInputSuggest, setIcon } from 'obsidian';
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
	/**
	 * Epoch ms of the plugin's first load, used to delay the star nudge until
	 * someone has had a fair chance to form an opinion. 0 = not yet recorded;
	 * `main.ts` fills it in on the first `onload()` after this field existed.
	 */
	firstUsedAt: number;
	/** Set once the user dismisses the "star on GitHub" nudge. */
	starNudgeDismissed: boolean;
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
	firstUsedAt: 0,
	starNudgeDismissed: false,
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
				.setDesc(t().settings.taskFolder.desc)
				.addText((text) => {
					text
						.setPlaceholder(t().settings.taskFolder.placeholder)
						.setValue(this.plugin.settings.taskFolder)
						.onChange(async (value) => {
							const empty = value.trim() === '';
							text.inputEl.classList.toggle('is-invalid', empty);
							this.plugin.settings.taskFolder = value;
							await this.plugin.saveSettings();
							updateFolderVisibility();
						});
					new FolderSuggest(this.app, text.inputEl);
				});

			const folderErrorEl = body.createEl('p', {
				text: t().settings.taskFolder.error,
				cls: 'focus-first-setting-error',
			});
			folderSetting.settingEl.after(folderErrorEl);

			updateFolderVisibility = () => {
				const isFolder = this.plugin.settings.taskScope === 'folder';
				folderSetting.settingEl.classList.toggle('focus-first-hidden', !isFolder);
				// Error only when the folder scope is active and the folder is empty.
				const showError = isFolder && this.plugin.settings.taskFolder.trim() === '';
				folderErrorEl.classList.toggle('focus-first-hidden', !showError);
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

			const prioritySetting = new Setting(body)
				.setName(t().settings.importantPriorities.name)
				.setDesc(t().settings.importantPriorities.desc);

			const pillGroup = prioritySetting.controlEl.createDiv({ cls: 'focus-first-pill-group' });

			const priorityErrorEl = body.createEl('p', {
				text: t().settings.importantPriorities.error,
				cls: 'focus-first-setting-error',
			});
			priorityErrorEl.classList.add('focus-first-hidden');
			prioritySetting.settingEl.after(priorityErrorEl);

			const updatePills = () => {
				const noneSelected = this.plugin.settings.importantPriorities.length === 0;
				priorityErrorEl.classList.toggle('focus-first-hidden', !noneSelected);
			};

			for (const option of PRIORITY_OPTIONS) {
				const pill = pillGroup.createEl('button', {
					text: option.label,
					cls: 'focus-first-pill',
				});
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
					updatePills();
				})(); });
			}

			updatePills();

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

			const sortFieldOptions: Record<SortField, string> = {
				priority: t().settings.sortField.priority,
				dueDate:  t().settings.sortField.dueDate,
				alpha:    t().settings.sortField.alpha,
			};

			const quadrantDefs: { key: keyof QuadrantConfig; label: string }[] = [
				{ key: 'do',       label: t().view.quadrants.do.title },
				{ key: 'schedule', label: t().view.quadrants.schedule.title },
				{ key: 'delegate', label: t().view.quadrants.delegate.title },
				{ key: 'eliminate',label: t().view.quadrants.eliminate.title },
			];

			for (const def of quadrantDefs) {
				const q = this.plugin.settings.quadrants[def.key];

				this.createCollapsibleSection(
					body,
					`quadrant-${def.key}`,
					`${def.label} — ${t().view.quadrants[def.key].subtitle}`,
					(qBody) => {
						new Setting(qBody)
							.setName(t().settings.quadrantColor.name)
							.setDesc(t().settings.quadrantColor.desc)
							.addText((text) => {
								text.inputEl.type = 'color';
								text.inputEl.value = q.color;
								text.inputEl.classList.add('focus-first-color-input');
								text.inputEl.addEventListener('input', () => {
									this.plugin.settings.quadrants[def.key].color = text.inputEl.value;
									void this.plugin.saveSettings();
								});

								const resetBtn = text.inputEl.parentElement?.createEl('button', {
									cls: 'focus-first-color-reset',
									attr: { title: t().settings.quadrantColor.reset, type: 'button' },
								});
								if (resetBtn) {
									setIcon(resetBtn, 'rotate-ccw');
									resetBtn.addEventListener('click', () => {
										const defaultColor = DEFAULT_SETTINGS.quadrants[def.key].color;
										this.plugin.settings.quadrants[def.key].color = defaultColor;
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
									.setPlaceholder(`#${def.key}`)
									.setValue(q.tag)
									.onChange(async (value) => {
										this.plugin.settings.quadrants[def.key].tag = value.trim();
										await this.plugin.saveSettings();
									}),
							);

						new Setting(qBody)
							.setName(t().settings.sortPrimary.name)
							.setDesc(t().settings.sortPrimary.desc)
							.addDropdown((drop) => {
								for (const [value, label] of Object.entries(sortFieldOptions)) {
									drop.addOption(value, label);
								}
								return drop
									.setValue(q.sort.primary)
									.onChange(async (value) => {
										this.plugin.settings.quadrants[def.key].sort.primary = value as SortField;
										await this.plugin.saveSettings();
									});
							});

						new Setting(qBody)
							.setName(t().settings.sortSecondary.name)
							.setDesc(t().settings.sortSecondary.desc)
							.addDropdown((drop) => {
								for (const [value, label] of Object.entries(sortFieldOptions)) {
									drop.addOption(value, label);
								}
								return drop
									.setValue(q.sort.secondary)
									.onChange(async (value) => {
										this.plugin.settings.quadrants[def.key].sort.secondary = value as SortField;
										await this.plugin.saveSettings();
									});
							});
					},
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

			const sizeSetting = new Setting(body)
				.setName(t().settings.lowEffortSizes.name)
				.setDesc(t().settings.lowEffortSizes.desc);
			const sizePills = sizeSetting.controlEl.createDiv({ cls: 'focus-first-pill-group' });
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
				.setDesc(t().settings.quickAddInbox.desc)
				.addText((text) => {
					text
						.setPlaceholder(t().settings.quickAddInbox.placeholder)
						.setValue(this.plugin.settings.quickAddInbox)
						.onChange(async (value) => {
							this.plugin.settings.quickAddInbox = value.trim();
							await this.plugin.saveSettings();
						});
					new FileSuggest(this.app, text.inputEl);
				});

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
			new Setting(body)
				.setName(t().settings.resetAll.name)
				.setDesc(t().settings.resetAll.desc)
				.addButton((button) =>
					button
						.setButtonText(t().settings.resetAll.button)
						.setWarning()
						.onClick(async () => {
							await this.plugin.resetSettings();
							this.display();
						}),
				);
		});
	}
}

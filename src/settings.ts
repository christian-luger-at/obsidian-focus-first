import { App, PluginSettingTab, Setting, TFolder, AbstractInputSuggest, setIcon } from 'obsidian';
import FocusFirstPlugin from './main';
import { t } from './i18n';

export type TaskScope = 'all' | 'folder';

export type SortField = 'priority' | 'dueDate' | 'alpha';

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

export interface FocusFirstSettings {
	taskScope: TaskScope;
	taskFolder: string;
	urgencyDays: number;
	importantPriorities: Priority[];
	quadrants: QuadrantConfig;
	groupByPrimary: boolean;
	focusTag: string;
	hideTag: string;
	fontSize: number;
	/** Set once the user dismisses the "Tasks plugin not enabled" notice. */
	tasksPluginWarningDismissed: boolean;
}

export const DEFAULT_SETTINGS: FocusFirstSettings = {
	taskScope: 'all',
	taskFolder: '',
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
	hideTag: '#hide',
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
		});

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
		});

		this.createSection(containerEl, t().settings.focusHeading, (body) => {
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
		});

		this.createSection(containerEl, t().settings.hideHeading, (body) => {
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
		});

		this.createSection(containerEl, t().settings.matrixHeading, (body) => {
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

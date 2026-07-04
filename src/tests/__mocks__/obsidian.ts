// Minimal Obsidian stubs for unit/integration tests.
// Only the symbols used by settings.ts and taskScanner.ts are implemented.

export class PluginSettingTab {
	app: unknown;
	constructor(app: unknown, _plugin: unknown) {
		this.app = app;
	}
}

export interface MockCommand {
	id: string;
	name: string;
	callback?: () => unknown;
}

export class Plugin {
	app: unknown;
	lastRibbonCb?: () => unknown;
	lastCommand?: MockCommand;
	lastViewCreator?: (leaf: unknown) => unknown;
	lastSettingTab?: unknown;

	constructor(app: unknown, _manifest: unknown) {
		this.app = app;
	}
	addRibbonIcon(_icon: string, _title: string, cb: () => unknown) {
		this.lastRibbonCb = cb;
		return {} as HTMLElement;
	}
	addCommand(cmd: MockCommand) { this.lastCommand = cmd; }
	addSettingTab(tab: unknown) { this.lastSettingTab = tab; }
	registerView(_type: string, viewCreator: (leaf: unknown) => unknown) { this.lastViewCreator = viewCreator; }
	registerEvent(_eventRef: unknown) {}
	lastCodeBlockLang?: string;
	lastCodeBlockProcessor?: (source: string, el: unknown, ctx: unknown) => unknown;
	registerMarkdownCodeBlockProcessor(lang: string, processor: (source: string, el: unknown, ctx: unknown) => unknown) {
		this.lastCodeBlockLang = lang;
		this.lastCodeBlockProcessor = processor;
	}
	async loadData(): Promise<unknown> { return undefined; }
	async saveData(_data: unknown): Promise<void> {}
}

export class MarkdownRenderChild {
	containerEl: HTMLElement;
	constructor(containerEl: HTMLElement) {
		this.containerEl = containerEl;
	}
	registerEvent(_eventRef: unknown) {}
	register(_cb: () => unknown) {}
	onload() {}
	onunload() {}
}

// ---------------------------------------------------------------------------
// Setting instance registry — lets tests look up created settings by index or
// by inspecting lastDropdown / lastText. Call clearCreatedSettings() in beforeEach.
// ---------------------------------------------------------------------------

export const createdSettings: Setting[] = [];
export function clearCreatedSettings(): void { createdSettings.length = 0; }

export class Setting {
	private _mockEl = (): MockEl => ({
		createEl: (_tag: string, _o?: unknown) => ({
			classList: { add: () => {}, toggle: () => {}, contains: () => false },
			addEventListener: (_event: string, _handler: unknown) => {},
			style: { display: '' },
		}),
		createDiv: (_o?: unknown) => this._mockEl(),
		after: (_el: unknown) => {},
		style: { display: '' },
		classList: { add: () => {}, toggle: () => {}, contains: () => false },
		addClass: (_cls: string) => {},
		addEventListener: (_event: string, _handler: unknown) => {},
	});

	settingEl = this._mockEl();
	controlEl = this._mockEl();

	name = '';
	lastDropdown?: DropdownComponent;
	lastText?: TextComponent;
	lastToggle?: ToggleComponent;
	lastButton?: ButtonComponent;
	lastExtraButton?: ExtraButtonComponent;

	constructor(_containerEl: unknown) {
		createdSettings.push(this);
	}

	setName(v: string) { this.name = v; return this; }
	setDesc(_v: string) { return this; }
	setHeading() { return this; }

	addDropdown(cb: (d: DropdownComponent) => void) {
		this.lastDropdown = new DropdownComponent();
		cb(this.lastDropdown);
		return this;
	}

	addText(cb: (t: TextComponent) => void) {
		this.lastText = new TextComponent();
		cb(this.lastText);
		return this;
	}

	addSlider(cb: (s: SliderComponent) => void) {
		cb(new SliderComponent());
		return this;
	}

	addToggle(cb: (t: ToggleComponent) => void) {
		this.lastToggle = new ToggleComponent();
		cb(this.lastToggle);
		return this;
	}

	addButton(cb: (b: ButtonComponent) => void) {
		this.lastButton = new ButtonComponent();
		cb(this.lastButton);
		return this;
	}

	addExtraButton(cb: (b: ExtraButtonComponent) => void) {
		this.lastExtraButton = new ExtraButtonComponent();
		cb(this.lastExtraButton);
		return this;
	}
}

interface MockEl {
	createEl: (tag: string, o?: unknown) => unknown;
	createDiv: (o?: unknown) => MockEl;
	after: (el: unknown) => void;
	style: { display: string };
	classList: { add: () => void; toggle: () => void; contains: () => boolean };
	addClass: (cls: string) => void;
	addEventListener: (event: string, handler: unknown) => void;
}

export class ButtonComponent {
	private _onClick?: () => unknown;
	setButtonText(_v: string) { return this; }
	setWarning() { return this; }
	setCta() { return this; }
	onClick(cb: () => unknown) { this._onClick = cb; return this; }
	async simulate(): Promise<void> { await this._onClick?.(); }
}

export class ExtraButtonComponent {
	private _onClick?: () => unknown;
	setIcon(_icon: string) { return this; }
	setTooltip(_text: string) { return this; }
	onClick(cb: () => unknown) { this._onClick = cb; return this; }
	async simulate(): Promise<void> { await this._onClick?.(); }
}

export class SliderComponent {
	private _value = 0;
	private _onChange?: (v: number) => unknown;
	setLimits(_min: number, _max: number, _step: number) { return this; }
	setValue(v: number) { this._value = v; return this; }
	getValue() { return this._value; }
	setDynamicTooltip() { return this; }
	onChange(cb: (v: number) => unknown) { this._onChange = cb; return this; }
	async simulate(v: number): Promise<void> { this._value = v; await this._onChange?.(v); }
}

export class ToggleComponent {
	private _value = false;
	private _onChange?: (v: boolean) => unknown;
	setValue(v: boolean) { this._value = v; return this; }
	getValue() { return this._value; }
	onChange(cb: (v: boolean) => unknown) { this._onChange = cb; return this; }
	async simulate(v: boolean): Promise<void> { this._value = v; await this._onChange?.(v); }
}

export class DropdownComponent {
	private _value = '';
	private _onChange?: (v: string) => unknown;
	addOption(_value: string, _display: string) { return this; }
	setValue(v: string) { this._value = v; return this; }
	getValue() { return this._value; }
	onChange(cb: (v: string) => unknown) { this._onChange = cb; return this; }
	async simulate(v: string): Promise<void> { this._value = v; await this._onChange?.(v); }
}

export class TextComponent {
	inputEl = {
		value: '',
		type: '',
		classList: {
			add: (_cls: string) => {},
			toggle: (_cls: string, _force?: boolean) => {},
			contains: (_cls: string) => false,
		},
		setAttribute: (_k: string, _v: string) => {},
		addEventListener: (_event: string, _cb: () => void) => {},
	} as unknown as HTMLInputElement;

	private _onChange?: (v: string) => unknown;

	setPlaceholder(_v: string) { return this; }
	setValue(v: string) { this.inputEl.value = v; return this; }
	getValue() { return this.inputEl.value; }
	onChange(cb: (v: string) => unknown) { this._onChange = cb; return this; }
	async simulate(v: string): Promise<void> { this.inputEl.value = v; await this._onChange?.(v); }
}

export class AbstractInputSuggest<T> {
	constructor(_app: unknown, _inputEl: HTMLInputElement) {}
	getSuggestions(_q: string): T[] { return []; }
	renderSuggestion(_item: T, _el: HTMLElement): void {}
	selectSuggestion(_item: T): void {}
	close() {}
}

export class TFolder {
	path: string;
	constructor(path: string) { this.path = path; }
}

export class TFile {
	path: string;
	basename: string;
	constructor(path: string) {
		this.path = path;
		this.basename = path.split('/').pop()?.replace('.md', '') ?? path;
	}
}

export class ItemView {
	app: unknown;
	leaf: unknown;
	contentEl = { style: { setProperty: (_k: string, _v: string) => {} } } as unknown as HTMLElement;
	constructor(leaf: { app?: unknown }) {
		this.leaf = leaf;
		this.app = leaf?.app;
	}
	registerEvent(_eventRef: unknown) {}
}

export class MarkdownView {}

export function setIcon(_el: HTMLElement, _icon: string): void {}

export function debounce<T extends (...args: never[]) => void>(fn: T, _wait: number, _resetTimer?: boolean): T {
	return fn;
}

export function moment(date?: Date) {
	return {
		locale: () => 'en',
		format: (_fmt: string) => (date ? date.toLocaleDateString() : ''),
	};
}
moment.locale = () => 'en';

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
	// Provided by Obsidian's Component/Plugin base class; no-op unless overridden.
	onunload() {}
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

export const MarkdownRenderer = {
	async render(_app: unknown, _markdown: string, _el: unknown, _sourcePath: string, _component: unknown): Promise<void> {},
};

// ---------------------------------------------------------------------------
// Setting instance registry — lets tests look up created settings by index or
// by inspecting lastDropdown / lastText. Call clearCreatedSettings() in beforeEach.
// ---------------------------------------------------------------------------

export const createdSettings: Setting[] = [];
export function clearCreatedSettings(): void { createdSettings.length = 0; }

export class Setting {
	settingEl = new FakeDomEl();
	controlEl = new FakeDomEl();

	name = '';
	lastDropdown?: DropdownComponent;
	lastText?: TextComponent;
	lastToggle?: ToggleComponent;
	lastButton?: ButtonComponent;
	lastExtraButton?: ExtraButtonComponent;
	lastSlider?: SliderComponent;

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
		this.lastSlider = new SliderComponent();
		cb(this.lastSlider);
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

// Minimal fake DOM element that records event listeners and children so tests
// can dispatch events (e.g. the color <input> and its reset button).
export class FakeDomEl {
	tag: string;
	value = '';
	type = '';
	parentElement: FakeDomEl | null = null;
	children: FakeDomEl[] = [];
	private _classes = new Set<string>();
	private _listeners: Record<string, Array<(e?: unknown) => void>> = {};
	classList = {
		add: (c: string) => { this._classes.add(c); },
		remove: (c: string) => { this._classes.delete(c); },
		toggle: (c: string, force?: boolean) => {
			const on = force ?? !this._classes.has(c);
			if (on) this._classes.add(c); else this._classes.delete(c);
		},
		contains: (c: string) => this._classes.has(c),
	};
	text = '';
	style: Record<string, string> = {};
	constructor(tag = 'div') { this.tag = tag; }
	setAttribute(_k: string, _v: string) {}
	addClass(c: string) { this._classes.add(c); }
	setText(t: string) { this.text = t; }
	getText() { return this.text; }
	after(_el: unknown) {}
	empty() { this.children = []; }
	addEventListener(event: string, cb: (e?: unknown) => void) { (this._listeners[event] ??= []).push(cb); }
	dispatch(event: string, e?: unknown) { for (const cb of this._listeners[event] ?? []) cb(e); }
	createDiv(o?: { cls?: string; text?: string }) { return this.createEl('div', o); }
	createEl(tag: string, o?: { cls?: string; text?: string }) {
		const el = new FakeDomEl(tag);
		if (o?.cls) for (const c of o.cls.split(' ').filter(Boolean)) el.classList.add(c);
		if (o?.text) el.text = o.text;
		el.parentElement = this;
		this.children.push(el);
		return el;
	}
	/** First descendant (or self) carrying the class — test helper. */
	findByClass(cls: string): FakeDomEl | undefined {
		if (this._classes.has(cls)) return this;
		for (const child of this.children) {
			const found = child.findByClass(cls);
			if (found) return found;
		}
		return undefined;
	}
}

export class TextComponent {
	inputEl = ((): HTMLInputElement => {
		const el = new FakeDomEl('input');
		el.parentElement = new FakeDomEl('div');
		return el as unknown as HTMLInputElement;
	})();

	private _onChange?: (v: string) => unknown;

	setPlaceholder(_v: string) { return this; }
	setValue(v: string) { this.inputEl.value = v; return this; }
	getValue() { return this.inputEl.value; }
	onChange(cb: (v: string) => unknown) { this._onChange = cb; return this; }
	async simulate(v: string): Promise<void> { this.inputEl.value = v; await this._onChange?.(v); }
}

export class AbstractInputSuggest<T> {
	protected app: unknown;
	constructor(app: unknown, _inputEl: HTMLInputElement) { this.app = app; }
	getSuggestions(_q: string): T[] { return []; }
	renderSuggestion(_item: T, _el: HTMLElement): void {}
	selectSuggestion(_item: T): void {}
	close() {}
}

// Obsidian augments String with `contains`; emulate it for the test env.
if (typeof (String.prototype as unknown as { contains?: unknown }).contains !== 'function') {
	(String.prototype as unknown as { contains: (s: string) => boolean }).contains =
		function (this: string, s: string) { return this.indexOf(s) !== -1; };
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

// Minimal Menu stub. Instances register in `createdMenus` so tests can find the
// menu opened by a click, inspect its items, and invoke their onClick handlers.
export const createdMenus: Menu[] = [];
export function clearCreatedMenus(): void { createdMenus.length = 0; }

export class MenuItem {
	title = '';
	checked = false;
	isLabel = false;
	callback?: () => void;
	setTitle(v: string) { this.title = v; return this; }
	setIcon(_v: string) { return this; }
	setChecked(v: boolean | null) { this.checked = !!v; return this; }
	setIsLabel(v: boolean) { this.isLabel = !!v; return this; }
	onClick(cb: () => void) { this.callback = cb; return this; }
}

export class Menu {
	items: MenuItem[] = [];
	constructor() { createdMenus.push(this); }
	addItem(cb: (item: MenuItem) => void) { const item = new MenuItem(); cb(item); this.items.push(item); return this; }
	addSeparator() { return this; }
	showAtMouseEvent(_e: unknown) { return this; }
	showAtPosition(_p: unknown) { return this; }
}

// Mutable so tests can flip the platform to exercise the mobile action layout.
export const Platform = { isMobile: false };

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

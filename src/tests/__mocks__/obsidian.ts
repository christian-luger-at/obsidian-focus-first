// Minimal Obsidian stubs for unit/integration tests.
// Only the symbols used by settings.ts and taskScanner.ts are implemented.

export class PluginSettingTab {
	app: unknown;
	constructor(app: unknown, _plugin: unknown) {
		this.app = app;
	}
}

export class Setting {
	private el: { children: unknown[] } = { children: [] };
	setName(_v: string) { return this; }
	setDesc(_v: string) { return this; }
	addDropdown(cb: (d: DropdownComponent) => void) {
		cb(new DropdownComponent());
		return this;
	}
	addText(cb: (t: TextComponent) => void) {
		cb(new TextComponent());
		return this;
	}
}

export class DropdownComponent {
	private _value = '';
	private _onChange?: (v: string) => void;
	addOption(_value: string, _display: string) { return this; }
	setValue(v: string) { this._value = v; return this; }
	getValue() { return this._value; }
	onChange(cb: (v: string) => void) { this._onChange = cb; return this; }
	// Test helper: simulate user picking a value
	simulate(v: string) { this._value = v; this._onChange?.(v); }
}

export class TextComponent {
	inputEl = { value: '' } as HTMLInputElement;
	private _onChange?: (v: string) => void;
	setPlaceholder(_v: string) { return this; }
	setValue(v: string) { this.inputEl.value = v; return this; }
	getValue() { return this.inputEl.value; }
	onChange(cb: (v: string) => void) { this._onChange = cb; return this; }
	simulate(v: string) { this.inputEl.value = v; this._onChange?.(v); }
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

export function moment() {
	return { locale: () => 'en' };
}
moment.locale = () => 'en';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_SETTINGS, FokusFirstSettings, TaskScope, Priority } from '../settings';
import type { FokusFirstSettingTab as FokusFirstSettingTabType } from '../settings';
import { createdSettings, clearCreatedSettings } from './__mocks__/obsidian';
import type { DropdownComponent, TextComponent, ToggleComponent } from './__mocks__/obsidian';
import type { ExtraButtonComponent } from './__mocks__/obsidian';

// ---------------------------------------------------------------------------
// Unit tests — DEFAULT_SETTINGS
// ---------------------------------------------------------------------------

describe('DEFAULT_SETTINGS', () => {
	it('sets taskScope to "all"', () => {
		expect(DEFAULT_SETTINGS.taskScope).toBe('all');
	});

	it('sets taskFolder to an empty string', () => {
		expect(DEFAULT_SETTINGS.taskFolder).toBe('');
	});
});

// ---------------------------------------------------------------------------
// Unit tests — settings shape
// ---------------------------------------------------------------------------

describe('FokusFirstSettings type contract', () => {
	it('accepts scope "all" with no folder', () => {
		const s: FokusFirstSettings = { ...DEFAULT_SETTINGS, taskScope: 'all', taskFolder: '' };
		expect(s.taskScope).toBe('all');
	});

	it('accepts scope "folder" with a folder path', () => {
		const s: FokusFirstSettings = { ...DEFAULT_SETTINGS, taskScope: 'folder', taskFolder: 'Work/Tasks' };
		expect(s.taskScope).toBe('folder');
		expect(s.taskFolder).toBe('Work/Tasks');
	});
});

// ---------------------------------------------------------------------------
// Integration tests — FokusFirstSettingTab rendering & persistence
// ---------------------------------------------------------------------------

// We need to mock `obsidian` before importing SettingTab
vi.mock('obsidian', () => import('./__mocks__/obsidian'));

// Re-import AFTER mock is registered so the module uses the stub
const { FokusFirstSettingTab } = await import('../settings');

function makePlugin(overrides: Partial<FokusFirstSettings> = {}) {
	// Deep-copy nested objects so tests can't mutate DEFAULT_SETTINGS via shared references
	const settings: FokusFirstSettings = {
		...DEFAULT_SETTINGS,
		quadrants: {
			do:       { ...DEFAULT_SETTINGS.quadrants.do,       sort: { ...DEFAULT_SETTINGS.quadrants.do.sort } },
			schedule: { ...DEFAULT_SETTINGS.quadrants.schedule, sort: { ...DEFAULT_SETTINGS.quadrants.schedule.sort } },
			delegate: { ...DEFAULT_SETTINGS.quadrants.delegate, sort: { ...DEFAULT_SETTINGS.quadrants.delegate.sort } },
			eliminate:{ ...DEFAULT_SETTINGS.quadrants.eliminate,sort: { ...DEFAULT_SETTINGS.quadrants.eliminate.sort } },
		},
		...overrides,
	};
	const saved: FokusFirstSettings[] = [];

	const plugin = {
		settings,
		app: {
			vault: {
				getAllLoadedFiles: () => [],
			},
		},
		saveSettings: vi.fn(async () => {
			saved.push({ ...plugin.settings });
		}),
		_saved: saved,
	};
	return plugin;
}

function makeTab(plugin: ReturnType<typeof makePlugin>): FokusFirstSettingTabType {
	// @ts-expect-error — stub app, not a real Obsidian App
	const tab = new FokusFirstSettingTab(plugin.app, plugin);
	// Provide a minimal containerEl so Setting constructors don't throw
	const mockClassList = () => ({ add: vi.fn(), toggle: vi.fn(), remove: vi.fn() });
	const mockEl = (): Record<string, unknown> => ({
		createEl: vi.fn(() => mockEl()),
		createDiv: vi.fn(() => mockEl()),
		setText: vi.fn(),
		classList: mockClassList(),
		style: { display: '' },
		after: vi.fn(),
		addEventListener: vi.fn(),
	});
	tab.containerEl = {
		empty: vi.fn(),
		...mockEl(),
	} as unknown as HTMLElement;
	return tab;
}

describe('FokusFirstSettingTab — scope dropdown', () => {
	it('calls display() without throwing when scope is "all"', () => {
		const plugin = makePlugin({ taskScope: 'all' });
		const tab = makeTab(plugin);
		expect(() => tab.display()).not.toThrow();
	});

	it('calls display() without throwing when scope is "folder"', () => {
		const plugin = makePlugin({ taskScope: 'folder', taskFolder: 'Notes' });
		const tab = makeTab(plugin);
		expect(() => tab.display()).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Integration tests — saveSettings is called when values change
// ---------------------------------------------------------------------------

describe('FokusFirstSettingTab — persistence', () => {
	let plugin: ReturnType<typeof makePlugin>;

	beforeEach(() => {
		plugin = makePlugin({ taskScope: 'all', taskFolder: '' });
	});

	it('persists taskScope when the dropdown changes', async () => {
		// Directly mutate as the setting tab would and call saveSettings
		plugin.settings.taskScope = 'folder';
		await plugin.saveSettings();

		expect(plugin.saveSettings).toHaveBeenCalledOnce();
		expect(plugin._saved[0]?.taskScope).toBe('folder');
	});

	it('persists taskFolder when the text input changes', async () => {
		plugin.settings.taskScope = 'folder';
		plugin.settings.taskFolder = 'Projects/Work';
		await plugin.saveSettings();

		expect(plugin._saved[0]?.taskFolder).toBe('Projects/Work');
	});

	it('persists multiple changes independently', async () => {
		plugin.settings.taskScope = 'folder';
		await plugin.saveSettings();

		plugin.settings.taskFolder = 'Archive';
		await plugin.saveSettings();

		expect(plugin._saved).toHaveLength(2);
		expect(plugin._saved[1]?.taskFolder).toBe('Archive');
	});

	it('switching back to "all" does not lose other settings', async () => {
		plugin.settings.taskScope = 'folder';
		plugin.settings.taskFolder = 'Work';
		await plugin.saveSettings();

		plugin.settings.taskScope = 'all';
		await plugin.saveSettings();

		expect(plugin._saved[1]?.taskScope).toBe('all');
		expect(plugin._saved[1]?.taskFolder).toBe('Work'); // folder value preserved
	});
});

// ---------------------------------------------------------------------------
// Unit tests — urgencyDays
// ---------------------------------------------------------------------------

describe('DEFAULT_SETTINGS — urgencyDays', () => {
	it('defaults to 3 days', () => {
		expect(DEFAULT_SETTINGS.urgencyDays).toBe(3);
	});
});

describe('urgencyDays — validation logic', () => {
	function isValid(value: number): boolean {
		return !isNaN(value) && value >= 0 && value < 365;
	}

	it('accepts 0', () => expect(isValid(0)).toBe(true));
	it('accepts 3 (default)', () => expect(isValid(3)).toBe(true));
	it('accepts 364 (max allowed)', () => expect(isValid(364)).toBe(true));
	it('rejects 365', () => expect(isValid(365)).toBe(false));
	it('rejects negative numbers', () => expect(isValid(-1)).toBe(false));
	it('rejects NaN', () => expect(isValid(NaN)).toBe(false));
});

describe('urgencyDays persistence', () => {
	it('saves a custom urgency threshold', async () => {
		const plugin = makePlugin();
		plugin.settings.urgencyDays = 7;
		await plugin.saveSettings();
		expect(plugin._saved[0]?.urgencyDays).toBe(7);
	});

	it('saves 0 (always urgent)', async () => {
		const plugin = makePlugin();
		plugin.settings.urgencyDays = 0;
		await plugin.saveSettings();
		expect(plugin._saved[0]?.urgencyDays).toBe(0);
	});

	it('saves 364 (maximum allowed value)', async () => {
		const plugin = makePlugin();
		plugin.settings.urgencyDays = 364;
		await plugin.saveSettings();
		expect(plugin._saved[0]?.urgencyDays).toBe(364);
	});
});

// ---------------------------------------------------------------------------
// Unit tests — importantPriorities
// ---------------------------------------------------------------------------

describe('DEFAULT_SETTINGS — importantPriorities', () => {
	it('defaults to Highest and High', () => {
		expect(DEFAULT_SETTINGS.importantPriorities).toEqual(['🔺', '⏫']);
	});
});

describe('importantPriorities — pill toggle logic', () => {
	it('adds a priority when not present', () => {
		const current: Priority[] = ['🔺'];
		const result = current.concat('🔼' as Priority);
		expect(result).toContain('🔼');
	});

	it('removes a priority when already active', () => {
		const current = ['🔺', '⏫'] as Priority[];
		const result = current.filter((p) => p !== '⏫');
		expect(result).not.toContain('⏫');
		expect(result).toContain('🔺');
	});

	it('reports empty when all are deselected', () => {
		const result: Priority[] = [];
		expect(result.length === 0).toBe(true);
	});

	it('accepts all available priority values', () => {
		const all: Priority[] = ['🔺', '⏫', '🔼', '🔽', '⏬'];
		expect(all).toHaveLength(5);
	});
});

describe('importantPriorities persistence', () => {
	it('saves an added priority', async () => {
		const plugin = makePlugin();
		plugin.settings.importantPriorities = ['🔺', '⏫', '🔼'];
		await plugin.saveSettings();
		expect(plugin._saved[0]?.importantPriorities).toContain('🔼');
	});

	it('saves a removed priority', async () => {
		const plugin = makePlugin();
		plugin.settings.importantPriorities = ['🔺'];
		await plugin.saveSettings();
		expect(plugin._saved[0]?.importantPriorities).not.toContain('⏫');
	});

	it('saves an empty list', async () => {
		const plugin = makePlugin();
		plugin.settings.importantPriorities = [];
		await plugin.saveSettings();
		expect(plugin._saved[0]?.importantPriorities).toHaveLength(0);
	});

	it('saves all priority values', async () => {
		const plugin = makePlugin();
		const all: Priority[] = ['🔺', '⏫', '🔼', '🔽', '⏬'];
		plugin.settings.importantPriorities = all;
		await plugin.saveSettings();
		expect(plugin._saved[0]?.importantPriorities).toEqual(all);
	});
});

// ---------------------------------------------------------------------------
// Integration tests — loadSettings merges with defaults
// ---------------------------------------------------------------------------

describe('loadSettings — merges persisted data with defaults', () => {
	it('fills missing keys from DEFAULT_SETTINGS', () => {
		// Simulate what loadSettings does: Object.assign({}, DEFAULT_SETTINGS, persisted)
		const persisted = { taskScope: 'folder' as TaskScope };
		const merged: FokusFirstSettings = Object.assign({}, DEFAULT_SETTINGS, persisted);

		expect(merged.taskScope).toBe('folder');
		expect(merged.taskFolder).toBe('');  // filled from defaults
		expect(merged.mySetting).toBe('default');
	});

	it('fully persisted data overrides all defaults', () => {
		const persisted: FokusFirstSettings = {
			mySetting: 'custom',
			taskScope: 'folder',
			taskFolder: 'MyFolder',
			urgencyDays: 7,
			importantPriorities: ['🔺'],
			quadrants: {
				do:       { tag: '#do',       color: '#e03131', sort: { primary: 'priority', secondary: 'dueDate' } },
				schedule: { tag: '#schedule', color: '#1971c2', sort: { primary: 'dueDate',  secondary: 'priority' } },
				delegate: { tag: '#delegate', color: '#e8590c', sort: { primary: 'dueDate',  secondary: 'priority' } },
				eliminate:{ tag: '#eliminate',color: '#868e96', sort: { primary: 'priority', secondary: 'alpha'    } },
			},
			groupByPrimary: false,
			focusTag: '#focus',
			hideTag: '#hide',
			fontSize: 120,
		};
		const merged = Object.assign({}, DEFAULT_SETTINGS, persisted);

		expect(merged).toEqual(persisted);
	});

	it('empty persisted object returns all defaults', () => {
		const merged = Object.assign({}, DEFAULT_SETTINGS, {});
		expect(merged).toEqual(DEFAULT_SETTINGS);
	});
});

// ---------------------------------------------------------------------------
// Helpers for onChange callback tests
// ---------------------------------------------------------------------------

function makeTabWithDisplay(overrides: Partial<FokusFirstSettings> = {}) {
	const plugin = makePlugin(overrides);
	const tab = makeTab(plugin);
	clearCreatedSettings();
	tab.display();
	return { plugin, tab };
}

// Find the single dropdown created during display()
function scopeDropdown(): DropdownComponent | undefined {
	return createdSettings.find((s) => s.lastDropdown)?.lastDropdown;
}

// Find a text input by its initial value
function textByValue(value: string): TextComponent | undefined {
	return createdSettings.find((s) => s.lastText?.inputEl.value === value)?.lastText;
}

// Find a toggle by its setting name
function toggleByName(name: string): ToggleComponent | undefined {
	return createdSettings.find((s) => s.name === name && s.lastToggle)?.lastToggle;
}

// ---------------------------------------------------------------------------
// onChange — scope dropdown
// ---------------------------------------------------------------------------

describe('FokusFirstSettingTab — scope dropdown onChange', () => {
	it('sets taskScope to "folder" and saves', async () => {
		const { plugin } = makeTabWithDisplay({ taskScope: 'all' });
		await scopeDropdown()?.simulate('folder');
		expect(plugin.settings.taskScope).toBe('folder');
		expect(plugin.saveSettings).toHaveBeenCalled();
	});

	it('sets taskScope back to "all" and saves', async () => {
		const { plugin } = makeTabWithDisplay({ taskScope: 'folder', taskFolder: 'Work' });
		await scopeDropdown()?.simulate('all');
		expect(plugin.settings.taskScope).toBe('all');
		expect(plugin.saveSettings).toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// onChange — folder text input
// ---------------------------------------------------------------------------

describe('FokusFirstSettingTab — folder text onChange', () => {
	it('saves a non-empty folder path', async () => {
		const { plugin } = makeTabWithDisplay({ taskScope: 'folder', taskFolder: '' });
		const folderText = textByValue('');
		await folderText?.simulate('Work/Tasks');
		expect(plugin.settings.taskFolder).toBe('Work/Tasks');
		expect(plugin.saveSettings).toHaveBeenCalled();
	});

	it('saves an empty folder path (user cleared the input)', async () => {
		const { plugin } = makeTabWithDisplay({ taskScope: 'folder', taskFolder: 'Work' });
		const folderText = textByValue('Work');
		await folderText?.simulate('');
		expect(plugin.settings.taskFolder).toBe('');
		expect(plugin.saveSettings).toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// onChange — urgencyDays text input
// ---------------------------------------------------------------------------

describe('FokusFirstSettingTab — urgencyDays text onChange', () => {
	it('saves a valid number', async () => {
		const { plugin } = makeTabWithDisplay();
		await textByValue('3')?.simulate('7');
		expect(plugin.settings.urgencyDays).toBe(7);
		expect(plugin.saveSettings).toHaveBeenCalled();
	});

	it('saves 0 (minimum valid value)', async () => {
		const { plugin } = makeTabWithDisplay();
		await textByValue('3')?.simulate('0');
		expect(plugin.settings.urgencyDays).toBe(0);
		expect(plugin.saveSettings).toHaveBeenCalled();
	});

	it('saves 364 (maximum valid value)', async () => {
		const { plugin } = makeTabWithDisplay();
		await textByValue('3')?.simulate('364');
		expect(plugin.settings.urgencyDays).toBe(364);
		expect(plugin.saveSettings).toHaveBeenCalled();
	});

	it('does NOT save when value is 365 (out of range)', async () => {
		const { plugin } = makeTabWithDisplay();
		await textByValue('3')?.simulate('365');
		expect(plugin.settings.urgencyDays).toBe(3); // unchanged
		expect(plugin.saveSettings).not.toHaveBeenCalled();
	});

	it('does NOT save when value is negative', async () => {
		const { plugin } = makeTabWithDisplay();
		await textByValue('3')?.simulate('-1');
		expect(plugin.settings.urgencyDays).toBe(3);
		expect(plugin.saveSettings).not.toHaveBeenCalled();
	});

	it('does NOT save when value is not a number', async () => {
		const { plugin } = makeTabWithDisplay();
		await textByValue('3')?.simulate('abc');
		expect(plugin.settings.urgencyDays).toBe(3);
		expect(plugin.saveSettings).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// onChange — quadrant tag text inputs
// ---------------------------------------------------------------------------

describe('FokusFirstSettingTab — quadrant tag onChange', () => {
	it('saves the "do" tag', async () => {
		const { plugin } = makeTabWithDisplay();
		await textByValue('#do')?.simulate('#jetzt');
		expect(plugin.settings.quadrants.do.tag).toBe('#jetzt');
		expect(plugin.saveSettings).toHaveBeenCalled();
	});

	it('saves the "schedule" tag', async () => {
		const { plugin } = makeTabWithDisplay();
		await textByValue('#schedule')?.simulate('#bald');
		expect(plugin.settings.quadrants.schedule.tag).toBe('#bald');
		expect(plugin.saveSettings).toHaveBeenCalled();
	});

	it('saves the "delegate" tag', async () => {
		const { plugin } = makeTabWithDisplay();
		await textByValue('#delegate')?.simulate('#delegieren');
		expect(plugin.settings.quadrants.delegate.tag).toBe('#delegieren');
		expect(plugin.saveSettings).toHaveBeenCalled();
	});

	it('saves the "eliminate" tag', async () => {
		const { plugin } = makeTabWithDisplay();
		await textByValue('#eliminate')?.simulate('#irgendwann');
		expect(plugin.settings.quadrants.eliminate.tag).toBe('#irgendwann');
		expect(plugin.saveSettings).toHaveBeenCalled();
	});

	it('trims whitespace from the saved tag value', async () => {
		const { plugin } = makeTabWithDisplay();
		await textByValue('#do')?.simulate('  #clean  ');
		expect(plugin.settings.quadrants.do.tag).toBe('#clean');
		expect(plugin.saveSettings).toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// Unit tests — focusTag default
// ---------------------------------------------------------------------------

describe('DEFAULT_SETTINGS — focusTag', () => {
	it('defaults to "#focus"', () => {
		expect(DEFAULT_SETTINGS.focusTag).toBe('#focus');
	});
});

// ---------------------------------------------------------------------------
// Unit tests — groupByPrimary default
// ---------------------------------------------------------------------------

describe('DEFAULT_SETTINGS — groupByPrimary', () => {
	it('defaults to true', () => {
		expect(DEFAULT_SETTINGS.groupByPrimary).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Unit tests — quadrant defaults
// ---------------------------------------------------------------------------

describe('DEFAULT_SETTINGS — quadrant structure', () => {
	it('has all four quadrants', () => {
		const keys = Object.keys(DEFAULT_SETTINGS.quadrants);
		expect(keys).toEqual(expect.arrayContaining(['do', 'schedule', 'delegate', 'eliminate']));
		expect(keys).toHaveLength(4);
	});

	it('each quadrant has tag, color, and sort fields', () => {
		for (const key of ['do', 'schedule', 'delegate', 'eliminate'] as const) {
			const q = DEFAULT_SETTINGS.quadrants[key];
			expect(typeof q.tag).toBe('string');
			expect(typeof q.color).toBe('string');
			expect(typeof q.sort.primary).toBe('string');
			expect(typeof q.sort.secondary).toBe('string');
		}
	});

	it('default tags match quadrant keys prefixed with #', () => {
		expect(DEFAULT_SETTINGS.quadrants.do.tag).toBe('#do');
		expect(DEFAULT_SETTINGS.quadrants.schedule.tag).toBe('#schedule');
		expect(DEFAULT_SETTINGS.quadrants.delegate.tag).toBe('#delegate');
		expect(DEFAULT_SETTINGS.quadrants.eliminate.tag).toBe('#eliminate');
	});

	it('default colors are valid hex strings', () => {
		const hexColor = /^#[0-9a-f]{6}$/i;
		for (const key of ['do', 'schedule', 'delegate', 'eliminate'] as const) {
			expect(DEFAULT_SETTINGS.quadrants[key].color).toMatch(hexColor);
		}
	});

	it('"do" quadrant defaults to red (#c92a2a)', () => {
		expect(DEFAULT_SETTINGS.quadrants.do.color).toBe('#c92a2a');
	});

	it('"schedule" quadrant defaults to blue (#1864ab)', () => {
		expect(DEFAULT_SETTINGS.quadrants.schedule.color).toBe('#1864ab');
	});

	it('"delegate" quadrant defaults to amber (#e67700)', () => {
		expect(DEFAULT_SETTINGS.quadrants.delegate.color).toBe('#e67700');
	});

	it('"eliminate" quadrant defaults to neutral gray (#868e96, readable in dark mode)', () => {
		expect(DEFAULT_SETTINGS.quadrants.eliminate.color).toBe('#868e96');
	});

	it('all quadrant colors are distinct', () => {
		const quadrantKeys = ['do', 'schedule', 'delegate', 'eliminate'] as const;
		const colors = quadrantKeys.map((key) => DEFAULT_SETTINGS.quadrants[key].color);
		const unique = new Set(colors);
		expect(unique.size).toBe(colors.length);
	});

	it('all quadrant colors are valid hex values', () => {
		for (const key of ['do', 'schedule', 'delegate', 'eliminate'] as const) {
			expect(DEFAULT_SETTINGS.quadrants[key].color).toMatch(/^#[0-9a-f]{6}$/i);
		}
	});

	it('"do" quadrant sorts by dueDate first, then priority', () => {
		expect(DEFAULT_SETTINGS.quadrants.do.sort.primary).toBe('dueDate');
		expect(DEFAULT_SETTINGS.quadrants.do.sort.secondary).toBe('priority');
	});

	it('"schedule" quadrant sorts by priority first, then dueDate', () => {
		expect(DEFAULT_SETTINGS.quadrants.schedule.sort.primary).toBe('priority');
		expect(DEFAULT_SETTINGS.quadrants.schedule.sort.secondary).toBe('dueDate');
	});

	it('"delegate" quadrant sorts by dueDate first, then priority', () => {
		expect(DEFAULT_SETTINGS.quadrants.delegate.sort.primary).toBe('dueDate');
		expect(DEFAULT_SETTINGS.quadrants.delegate.sort.secondary).toBe('priority');
	});

	it('"eliminate" quadrant sorts by alphabetical first, then priority', () => {
		expect(DEFAULT_SETTINGS.quadrants.eliminate.sort.primary).toBe('alpha');
		expect(DEFAULT_SETTINGS.quadrants.eliminate.sort.secondary).toBe('priority');
	});

	it('primary and secondary sort defaults are different for every quadrant', () => {
		for (const key of ['do', 'schedule', 'delegate', 'eliminate'] as const) {
			const { primary, secondary } = DEFAULT_SETTINGS.quadrants[key].sort;
			expect(primary).not.toBe(secondary);
		}
	});
});

// ---------------------------------------------------------------------------
// onChange — focusTag text input
// ---------------------------------------------------------------------------

describe('FokusFirstSettingTab — focusTag onChange', () => {
	it('saves a custom focus tag', async () => {
		const { plugin } = makeTabWithDisplay();
		await textByValue('#focus')?.simulate('#star');
		expect(plugin.settings.focusTag).toBe('#star');
		expect(plugin.saveSettings).toHaveBeenCalled();
	});

	it('saves an empty string (disabling focus tag)', async () => {
		const { plugin } = makeTabWithDisplay();
		await textByValue('#focus')?.simulate('');
		expect(plugin.settings.focusTag).toBe('');
		expect(plugin.saveSettings).toHaveBeenCalled();
	});

	it('trims whitespace from the saved focus tag', async () => {
		const { plugin } = makeTabWithDisplay();
		await textByValue('#focus')?.simulate('  #highlight  ');
		expect(plugin.settings.focusTag).toBe('#highlight');
		expect(plugin.saveSettings).toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// onChange — groupByPrimary toggle
// ---------------------------------------------------------------------------

describe('FokusFirstSettingTab — groupByPrimary toggle onChange', () => {
	it('saves true when toggled on', async () => {
		const { plugin } = makeTabWithDisplay({ groupByPrimary: false });
		await toggleByName('Group by primary criterion')?.simulate(true);
		expect(plugin.settings.groupByPrimary).toBe(true);
		expect(plugin.saveSettings).toHaveBeenCalled();
	});

	it('saves false when toggled off', async () => {
		const { plugin } = makeTabWithDisplay({ groupByPrimary: true });
		await toggleByName('Group by primary criterion')?.simulate(false);
		expect(plugin.settings.groupByPrimary).toBe(false);
		expect(plugin.saveSettings).toHaveBeenCalled();
	});

	it('toggle reflects the current setting value', () => {
		makeTabWithDisplay({ groupByPrimary: true });
		const toggle = toggleByName('Group by primary criterion');
		expect(toggle?.getValue()).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// onChange — sort dropdowns
// ---------------------------------------------------------------------------

describe('FokusFirstSettingTab — sort dropdowns onChange', () => {
	it('saves primary sort for the "do" quadrant', async () => {
		// display() creates the "do" quadrant first; its "Primary sort" dropdown is the first match
		const { plugin } = makeTabWithDisplay();
		const allPrimary = createdSettings.filter((s) => s.name === 'Primary sort' && s.lastDropdown);
		await allPrimary[0]?.lastDropdown?.simulate('dueDate');
		expect(plugin.settings.quadrants.do.sort.primary).toBe('dueDate');
		expect(plugin.saveSettings).toHaveBeenCalled();
	});

	it('saves secondary sort for the "do" quadrant', async () => {
		const { plugin } = makeTabWithDisplay();
		const allSecondary = createdSettings.filter((s) => s.name === 'Secondary sort' && s.lastDropdown);
		await allSecondary[0]?.lastDropdown?.simulate('alpha');
		expect(plugin.settings.quadrants.do.sort.secondary).toBe('alpha');
		expect(plugin.saveSettings).toHaveBeenCalled();
	});

	it('saves primary sort for the "schedule" quadrant independently', async () => {
		const { plugin } = makeTabWithDisplay();
		const allPrimary = createdSettings.filter((s) => s.name === 'Primary sort' && s.lastDropdown);
		await allPrimary[1]?.lastDropdown?.simulate('alpha');
		expect(plugin.settings.quadrants.schedule.sort.primary).toBe('alpha');
		expect(plugin.settings.quadrants.do.sort.primary).toBe('dueDate'); // unchanged
	});

	it('primary and secondary dropdowns are independent', async () => {
		const { plugin } = makeTabWithDisplay();
		const allPrimary   = createdSettings.filter((s) => s.name === 'Primary sort'   && s.lastDropdown);
		const allSecondary = createdSettings.filter((s) => s.name === 'Secondary sort' && s.lastDropdown);
		await allPrimary[0]?.lastDropdown?.simulate('alpha');
		await allSecondary[0]?.lastDropdown?.simulate('dueDate');
		expect(plugin.settings.quadrants.do.sort.primary).toBe('alpha');
		expect(plugin.settings.quadrants.do.sort.secondary).toBe('dueDate');
	});

	it('four quadrants each have a primary and secondary sort dropdown', () => {
		makeTabWithDisplay();
		const primaryCount   = createdSettings.filter((s) => s.name === 'Primary sort'   && s.lastDropdown).length;
		const secondaryCount = createdSettings.filter((s) => s.name === 'Secondary sort' && s.lastDropdown).length;
		expect(primaryCount).toBe(4);
		expect(secondaryCount).toBe(4);
	});

	it('saves sort for "delegate" quadrant independently', async () => {
		const { plugin } = makeTabWithDisplay();
		const allPrimary = createdSettings.filter((s) => s.name === 'Primary sort' && s.lastDropdown);
		await allPrimary[2]?.lastDropdown?.simulate('priority');
		expect(plugin.settings.quadrants.delegate.sort.primary).toBe('priority');
		expect(plugin.settings.quadrants.do.sort.primary).toBe('dueDate'); // unchanged
		expect(plugin.settings.quadrants.schedule.sort.primary).toBe('priority'); // unchanged
	});

	it('saves sort for "eliminate" quadrant independently', async () => {
		const { plugin } = makeTabWithDisplay();
		const allSecondary = createdSettings.filter((s) => s.name === 'Secondary sort' && s.lastDropdown);
		await allSecondary[3]?.lastDropdown?.simulate('dueDate');
		expect(plugin.settings.quadrants.eliminate.sort.secondary).toBe('dueDate');
		expect(plugin.settings.quadrants.do.sort.secondary).toBe('priority'); // unchanged
	});
});

// ---------------------------------------------------------------------------
// Unit tests — DEFAULT_SETTINGS importantPriorities
// ---------------------------------------------------------------------------

describe('DEFAULT_SETTINGS — importantPriorities', () => {
	it('defaults to highest and high priority', () => {
		expect(DEFAULT_SETTINGS.importantPriorities).toEqual(['🔺', '⏫']);
	});

	it('contains only valid priority emoji', () => {
		const valid = new Set(['🔺', '⏫', '🔼', '🔽', '⏬']);
		for (const p of DEFAULT_SETTINGS.importantPriorities) {
			expect(valid.has(p)).toBe(true);
		}
	});

	it('has no duplicates', () => {
		const set = new Set(DEFAULT_SETTINGS.importantPriorities);
		expect(set.size).toBe(DEFAULT_SETTINGS.importantPriorities.length);
	});
});

// ---------------------------------------------------------------------------
// Unit tests — DEFAULT_SETTINGS shape completeness
// ---------------------------------------------------------------------------

describe('DEFAULT_SETTINGS — shape completeness', () => {
	it('has all required top-level keys', () => {
		const keys: (keyof typeof DEFAULT_SETTINGS)[] = [
			'taskScope', 'taskFolder', 'urgencyDays', 'importantPriorities',
			'quadrants', 'groupByPrimary', 'focusTag',
		];
		for (const key of keys) {
			expect(DEFAULT_SETTINGS).toHaveProperty(key);
		}
	});

	it('urgencyDays is a non-negative integer', () => {
		expect(Number.isInteger(DEFAULT_SETTINGS.urgencyDays)).toBe(true);
		expect(DEFAULT_SETTINGS.urgencyDays).toBeGreaterThanOrEqual(0);
	});

	it('focusTag starts with #', () => {
		expect(DEFAULT_SETTINGS.focusTag.startsWith('#')).toBe(true);
	});

	it('all quadrant tags start with #', () => {
		for (const key of ['do', 'schedule', 'delegate', 'eliminate'] as const) {
			expect(DEFAULT_SETTINGS.quadrants[key].tag.startsWith('#')).toBe(true);
		}
	});
});

// ---------------------------------------------------------------------------
// Integration — color default values per quadrant
// ---------------------------------------------------------------------------

describe('DEFAULT_SETTINGS — quadrant color semantics', () => {
	it('"do" is redder than "schedule"', () => {
		const doRed   = parseInt(DEFAULT_SETTINGS.quadrants.do.color.slice(1, 3), 16);
		const schedRed = parseInt(DEFAULT_SETTINGS.quadrants.schedule.color.slice(1, 3), 16);
		expect(doRed).toBeGreaterThan(schedRed);
	});

	it('"eliminate" color has equal or lower saturation than others (darkish gray)', () => {
		const hex = DEFAULT_SETTINGS.quadrants.eliminate.color;
		const r = parseInt(hex.slice(1, 3), 16);
		const g = parseInt(hex.slice(3, 5), 16);
		const b = parseInt(hex.slice(5, 7), 16);
		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		const saturation = max === 0 ? 0 : (max - min) / max;
		expect(saturation).toBeLessThan(0.3);
	});
});

// ---------------------------------------------------------------------------
// Integration — Reset-all button
// ---------------------------------------------------------------------------

describe('FokusFirstSettingTab — reset-all button', () => {
	it('calls plugin.resetSettings() and re-renders when clicked', async () => {
		const plugin = makePlugin({ taskFolder: 'Custom' });
		// resetSettings is not part of the plugin stub created by makePlugin —
		// add it here so we can assert it was invoked.
		const resetSpy = vi.fn(async () => {
			plugin.settings.taskFolder = '';
		});
		(plugin as unknown as { resetSettings: () => Promise<void> }).resetSettings = resetSpy;

		const tab = makeTab(plugin);
		const displaySpy = vi.spyOn(tab, 'display');
		clearCreatedSettings();
		tab.display();

		const resetButton = createdSettings.find((s) => s.lastButton)?.lastButton;
		expect(resetButton).toBeDefined();
		await resetButton?.simulate();

		expect(resetSpy).toHaveBeenCalledOnce();
		// display() is called once by us, then again by the click handler
		expect(displaySpy).toHaveBeenCalledTimes(2);
	});
});

// ---------------------------------------------------------------------------
// Integration — collapsible quadrant sections
// ---------------------------------------------------------------------------

describe('FokusFirstSettingTab — collapsible quadrant sections', () => {
	it('renders a chevron extra-button for each of the four quadrant sub-sections', () => {
		makeTabWithDisplay();
		const chevronCount = createdSettings.filter((s) => s.lastExtraButton).length;
		expect(chevronCount).toBe(4);
	});

	it('clicking a quadrant chevron toggles its icon between collapsed and expanded', async () => {
		makeTabWithDisplay();
		const chevrons = createdSettings
			.filter((s) => s.lastExtraButton)
			.map((s) => s.lastExtraButton as ExtraButtonComponent);

		// Quadrant sub-sections start collapsed by default
		const first = chevrons[0];
		expect(first).toBeDefined();
		const setIconSpy = vi.spyOn(first!, 'setIcon');

		await first?.simulate();

		expect(setIconSpy).toHaveBeenCalledWith('chevron-down');
	});

	it('clicking the same chevron twice returns it to the collapsed icon', async () => {
		makeTabWithDisplay();
		const first = createdSettings.find((s) => s.lastExtraButton)?.lastExtraButton as ExtraButtonComponent;
		const setIconSpy = vi.spyOn(first, 'setIcon');

		await first.simulate();
		await first.simulate();

		expect(setIconSpy).toHaveBeenLastCalledWith('chevron-right');
	});
});

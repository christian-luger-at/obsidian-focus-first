/**
 * Tests for tasksPlugin.ts — detecting the Tasks plugin and its API surfaces,
 * read defensively from the (untyped) app.plugins structure.
 */
import { describe, it, expect } from 'vitest';
import {
	TASKS_PLUGIN_ID,
	isTasksPluginEnabled,
	getTasksApi,
	getTasksCreateApi,
} from '../tasksPlugin';

function appWith(apiV1: unknown, enabled = true) {
	return {
		plugins: {
			enabledPlugins: new Set(enabled ? [TASKS_PLUGIN_ID] : []),
			plugins: { [TASKS_PLUGIN_ID]: { apiV1 } },
		},
	} as never;
}

describe('isTasksPluginEnabled', () => {
	it('is true when the plugin id is in enabledPlugins', () => {
		expect(isTasksPluginEnabled(appWith({}, true))).toBe(true);
	});

	it('is false when it is not enabled', () => {
		expect(isTasksPluginEnabled(appWith({}, false))).toBe(false);
	});

	it('is false when app.plugins is missing', () => {
		expect(isTasksPluginEnabled({} as never)).toBe(false);
	});
});

describe('getTasksApi', () => {
	it('returns the api when executeToggleTaskDoneCommand exists', () => {
		const toggle = () => '';
		const api = getTasksApi(appWith({ executeToggleTaskDoneCommand: toggle }));
		expect(api?.executeToggleTaskDoneCommand).toBe(toggle);
	});

	it('returns null when the method is missing', () => {
		expect(getTasksApi(appWith({ createTaskLineModal: () => Promise.resolve('') }))).toBeNull();
	});

	it('returns null when the plugin is absent', () => {
		expect(getTasksApi({} as never)).toBeNull();
	});
});

describe('getTasksCreateApi', () => {
	it('returns the api when createTaskLineModal exists', () => {
		const create = () => Promise.resolve('- [ ] x');
		const api = getTasksCreateApi(appWith({ createTaskLineModal: create }));
		expect(api?.createTaskLineModal).toBe(create);
	});

	it('returns null when the method is missing', () => {
		expect(getTasksCreateApi(appWith({ executeToggleTaskDoneCommand: () => '' }))).toBeNull();
	});

	it('returns null when the plugin is absent', () => {
		expect(getTasksCreateApi({} as never)).toBeNull();
	});
});

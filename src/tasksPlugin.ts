import { App } from 'obsidian';

export const TASKS_PLUGIN_ID = 'obsidian-tasks-plugin';

/**
 * Whether the community Tasks plugin is installed and enabled.
 *
 * `app.plugins` is not part of Obsidian's public API typings, but there is no
 * official way to detect whether another plugin is enabled. We read it
 * defensively (optional chaining + fallback) so a future API change can only
 * make this return false, never throw.
 */
export function isTasksPluginEnabled(app: App): boolean {
	const plugins = (app as unknown as {
		plugins?: { enabledPlugins?: Set<string> };
	}).plugins;
	return plugins?.enabledPlugins?.has(TASKS_PLUGIN_ID) ?? false;
}

/**
 * The slice of the Tasks plugin's public API (apiV1) we use. Toggling a task
 * "done" through it means the Tasks plugin applies the user's own done-date and
 * status settings and, for recurring (`🔁`) tasks, generates the next
 * occurrence — behaviour we can't safely reproduce ourselves.
 */
export interface TasksApi {
	/**
	 * Returns the replacement text for `line` (from note `path`) after toggling
	 * its done state. For a recurring task this is multiple lines (the next
	 * occurrence plus the completed line), newline-separated.
	 */
	executeToggleTaskDoneCommand: (line: string, path: string) => string;
}

export interface TasksCreateApi {
	/**
	 * Opens the Tasks plugin's own "Create task" dialog (date pickers, priority,
	 * recurrence, etc.) and resolves with the composed Markdown task line, or an
	 * empty string if the user cancelled.
	 */
	createTaskLineModal: () => Promise<string>;
}

/** The raw apiV1 object of the Tasks plugin, if present. */
function rawTasksApi(app: App): Record<string, unknown> | undefined {
	return (app as unknown as {
		plugins?: { plugins?: Record<string, { apiV1?: Record<string, unknown> }> };
	}).plugins?.plugins?.[TASKS_PLUGIN_ID]?.apiV1;
}

/**
 * The Tasks plugin's toggle API, or null if the plugin is absent or doesn't
 * expose the method. Read defensively (this is not part of Obsidian's public
 * typings) so a future change can only make it return null, never throw.
 */
export function getTasksApi(app: App): TasksApi | null {
	const api = rawTasksApi(app);
	return api && typeof api.executeToggleTaskDoneCommand === 'function'
		? (api as unknown as TasksApi)
		: null;
}

/** The Tasks plugin's "create task" dialog API, or null if unavailable. */
export function getTasksCreateApi(app: App): TasksCreateApi | null {
	const api = rawTasksApi(app);
	return api && typeof api.createTaskLineModal === 'function'
		? (api as unknown as TasksCreateApi)
		: null;
}

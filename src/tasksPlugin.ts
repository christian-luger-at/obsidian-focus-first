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

/**
 * The Tasks plugin's apiV1, or null if the plugin is absent or doesn't expose
 * the method. Read defensively (this is not part of Obsidian's public typings)
 * so a future change can only make it return null, never throw.
 */
export function getTasksApi(app: App): TasksApi | null {
	const plugin = (app as unknown as {
		plugins?: { plugins?: Record<string, { apiV1?: TasksApi }> };
	}).plugins?.plugins?.[TASKS_PLUGIN_ID];
	const api = plugin?.apiV1;
	return api && typeof api.executeToggleTaskDoneCommand === 'function' ? api : null;
}

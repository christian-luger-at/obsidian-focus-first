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

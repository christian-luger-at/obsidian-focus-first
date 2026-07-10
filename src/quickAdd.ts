/**
 * Pure helpers plus the vault append behind the quick-add dialog (issue #8):
 * turning the typed input into a task line, resolving where it should go, and
 * appending it to that note (creating the note and its folder if needed).
 */
import { App, TFile } from 'obsidian';
import { FocusFirstSettings } from './settings';

export type QuickAddResult = 'added' | 'empty' | 'no-target';

/**
 * Builds a `- [ ] …` task line from the raw input, appending any quick-modifier
 * tags that aren't already present. The input (including inline Tasks syntax) is
 * kept verbatim.
 */
export function buildTaskLine(input: string, tags: string[] = []): string {
	let body = input.trim();
	// The Tasks plugin's create dialog may return a full checkbox line; strip an
	// existing prefix so we can re-apply the checkbox and tags consistently.
	const prefixed = /^[-*+]\s+\[.\]\s*(.*)$/.exec(body);
	if (prefixed) body = (prefixed[1] ?? '').trim();
	const present = new Set(body.split(/\s+/).map((token) => token.toLowerCase()));
	const extra = tags.filter((tag) => tag && !present.has(tag.toLowerCase()));
	return `- [ ] ${[body, ...extra].join(' ').trim()}`;
}

/**
 * Whether a quick-added task has a place to go without asking: the `active` mode
 * needs no file, while the `inbox` mode needs a configured inbox note. Used to
 * decide if the first-use inbox-setup dialog should appear (issue #24).
 */
export function isInboxConfigured(settings: FocusFirstSettings): boolean {
	return settings.quickAddTarget !== 'inbox' || settings.quickAddInbox.trim() !== '';
}

/** Normalizes an inbox path: falls back to `Inbox.md` and ensures a `.md` suffix. */
export function normalizeInboxPath(path: string): string {
	const trimmed = path.trim() || 'Inbox.md';
	return trimmed.toLowerCase().endsWith('.md') ? trimmed : `${trimmed}.md`;
}

/**
 * The note a quick-added task should be written to, or null when the target is
 * the active note but there is none.
 */
export function resolveTargetPath(
	settings: FocusFirstSettings,
	activeFilePath: string | null,
): string | null {
	if (settings.quickAddTarget === 'active') return activeFilePath;
	return normalizeInboxPath(settings.quickAddInbox);
}

async function ensureFolder(app: App, filePath: string): Promise<void> {
	const slash = filePath.lastIndexOf('/');
	if (slash <= 0) return;
	const folder = filePath.slice(0, slash);
	if (!app.vault.getAbstractFileByPath(folder)) {
		await app.vault.createFolder(folder).catch(() => {});
	}
}

/**
 * Appends `line` as a new line to the note at `path`, creating the note (and any
 * missing parent folder) if it doesn't exist. Existing content is preserved,
 * with a newline inserted only when needed.
 */
export async function appendTaskLine(app: App, path: string, line: string): Promise<void> {
	const existing = app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFile) {
		const content = await app.vault.read(existing);
		const base = content.length === 0 || content.endsWith('\n') ? content : `${content}\n`;
		await app.vault.modify(existing, `${base}${line}\n`);
		return;
	}
	await ensureFolder(app, path);
	await app.vault.create(path, `${line}\n`);
}

/**
 * Resolves the target note (from settings + the active file), builds the task
 * line, and appends it. Returns what happened so callers can show the right
 * feedback. Shared by the fallback dialog and the Tasks-plugin create flow.
 */
export async function commitTask(
	app: App,
	settings: FocusFirstSettings,
	rawText: string,
	tags: string[] = [],
): Promise<QuickAddResult> {
	if (!rawText.trim()) return 'empty';
	const activePath = app.workspace.getActiveFile()?.path ?? null;
	const target = resolveTargetPath(settings, activePath);
	if (!target) return 'no-target';
	await appendTaskLine(app, target, buildTaskLine(rawText, tags));
	return 'added';
}

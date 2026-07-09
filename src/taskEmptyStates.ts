import { t } from './i18n';

/** Shared info/empty panel: optional title, body, code example, clear button. */
function renderInfoPanel(
	container: HTMLElement,
	wrapperCls: string,
	title: string,
	body: string,
	opts: { example?: boolean; onClear?: () => void } = {},
): void {
	const panel = container.createDiv({ cls: wrapperCls });
	if (title) panel.createEl('p', { text: title, cls: 'focus-first-info-title' });
	if (body) panel.createEl('p', { text: body, cls: 'focus-first-info-body' });
	if (opts.example) {
		const pre = panel.createEl('pre', { cls: 'focus-first-info-example' });
		pre.createEl('code', { text: String(t().view.emptyStates.example) });
	}
	if (opts.onClear) {
		const onClear = opts.onClear;
		const btn = panel.createEl('button', {
			text: t().view.emptyStates.clearFilters,
			cls: 'focus-first-info-clear',
		});
		btn.addEventListener('click', () => onClear());
	}
}

/** Empty because search/filters exclude everything — offer to clear them. */
export function renderNoMatches(container: HTMLElement, onClear: () => void): void {
	const s = t().view.emptyStates;
	renderInfoPanel(container, 'focus-first-empty focus-first-empty--no-matches',
		String(s.noMatches), '', { onClear });
}

/** Empty because there are no tasks at all — explain where tasks come from. */
export function renderOnboarding(container: HTMLElement): void {
	const s = t().view.emptyStates;
	renderInfoPanel(container, 'focus-first-empty focus-first-empty--onboarding',
		String(s.onboardingTitle), String(s.onboardingBody), { example: true });
}

/** Tasks exist but all fall into Eliminate — explain why (no dates/priorities). */
export function renderEliminateHint(container: HTMLElement): void {
	const s = t().view.emptyStates;
	renderInfoPanel(container, 'focus-first-eliminate-hint',
		String(s.eliminateHintTitle), String(s.eliminateHintBody), { example: true });
}

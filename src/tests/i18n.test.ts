import { describe, it, expect, afterEach, vi } from 'vitest';

vi.mock('obsidian', () => import('./__mocks__/obsidian'));

const { t } = await import('../i18n');
const { moment } = (await import('obsidian')) as unknown as { moment: { locale: () => string } };

describe('i18n — locale selection', () => {
	const originalLocale = moment.locale;
	afterEach(() => { moment.locale = originalLocale; });

	it('returns English strings by default', () => {
		moment.locale = () => 'en';
		expect(t().commands.openView.name).toBe('Open Focus First');
	});

	it('returns German strings when the app locale starts with "de"', () => {
		moment.locale = () => 'de-DE';
		expect(t().commands.openView.name).toBe('Focus First öffnen');
	});
});

/**
 * Tests for dateUtils.ts (issues #25, #26). These are timezone-independent by
 * construction: parseIsoDate builds from local calendar components and
 * daysBetween compares via Date.UTC, so they hold in any TZ. Run the whole
 * suite under e.g. TZ=America/New_York to guard against regressions.
 */
import { describe, it, expect } from 'vitest';
import { parseIsoDate, daysBetween } from '../dateUtils';

describe('parseIsoDate', () => {
	it('parses to the local calendar day, not UTC (issue #25)', () => {
		const d = parseIsoDate('2026-07-11')!;
		expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 7, 11]);
		expect(d.getHours()).toBe(0);
	});

	it('returns undefined for malformed input', () => {
		expect(parseIsoDate('not-a-date')).toBeUndefined();
		expect(parseIsoDate('2026-7-1')).toBeUndefined();
	});
});

describe('daysBetween', () => {
	const d = (iso: string) => parseIsoDate(iso)!;

	it('counts whole calendar days', () => {
		expect(daysBetween(d('2026-07-11'), d('2026-07-11'))).toBe(0);
		expect(daysBetween(d('2026-07-11'), d('2026-07-12'))).toBe(1);
		expect(daysBetween(d('2026-07-11'), d('2026-07-10'))).toBe(-1);
		expect(daysBetween(d('2026-07-01'), d('2026-07-31'))).toBe(30);
	});

	it('stays exact across a DST transition (issue #26)', () => {
		// US spring-forward is 2026-03-08; the local day is only 23h long.
		expect(daysBetween(d('2026-03-08'), d('2026-03-09'))).toBe(1);
		// US fall-back is 2026-11-01; that local day is 25h long.
		expect(daysBetween(d('2026-11-01'), d('2026-11-02'))).toBe(1);
	});

	it('uses only the calendar day, ignoring the time of day', () => {
		const morning = new Date(2026, 6, 11, 8, 30);
		const nextEvening = new Date(2026, 6, 12, 23, 45);
		expect(daysBetween(morning, nextEvening)).toBe(1);
	});
});

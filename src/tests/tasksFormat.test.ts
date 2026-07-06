import { describe, it, expect } from 'vitest';
import { canonicalizeTaskLine } from '../tasksFormat';

describe('canonicalizeTaskLine', () => {
	it('moves priority and due date after the description and tags', () => {
		const line = '- [ ] Send the signed vendor contract back 📅 2026-07-05 ⏫ #focus #do';
		expect(canonicalizeTaskLine(line)).toBe(
			'- [ ] Send the signed vendor contract back #focus #do ⏫ 📅 2026-07-05',
		);
	});

	it('keeps already-canonical lines equivalent', () => {
		const line = '- [ ] Fix production bug #focus #do #hide 🔺 📅 2026-06-28';
		expect(canonicalizeTaskLine(line)).toBe(
			'- [ ] Fix production bug #focus #do #hide 🔺 📅 2026-06-28',
		);
	});

	it('orders multiple dates canonically (created, start, scheduled, due, done)', () => {
		const line = '- [ ] Task ✅ 2026-01-05 📅 2026-01-04 ➕ 2026-01-01 ⏳ 2026-01-03 🛫 2026-01-02';
		expect(canonicalizeTaskLine(line)).toBe(
			'- [ ] Task ➕ 2026-01-01 🛫 2026-01-02 ⏳ 2026-01-03 📅 2026-01-04 ✅ 2026-01-05',
		);
	});

	it('places priority before recurrence and dates', () => {
		const line = '- [ ] Water plants 🔁 every week 📅 2026-05-01 🔼';
		expect(canonicalizeTaskLine(line)).toBe(
			'- [ ] Water plants 🔼 🔁 every week 📅 2026-05-01',
		);
	});

	it('preserves the checkbox status character', () => {
		expect(canonicalizeTaskLine('- [x] Done task ⏫ 📅 2026-07-05')).toBe(
			'- [x] Done task ⏫ 📅 2026-07-05',
		);
	});

	it('normalizes the list marker and indentation to a flat "- [ ]"', () => {
		expect(canonicalizeTaskLine('    * [ ] Nested item ⏫')).toBe('- [ ] Nested item ⏫');
	});

	it('leaves a task without metadata unchanged (aside from marker)', () => {
		expect(canonicalizeTaskLine('- [ ] Just a plain task #focus')).toBe(
			'- [ ] Just a plain task #focus',
		);
	});

	it('returns non-task lines unchanged', () => {
		expect(canonicalizeTaskLine('Just a paragraph')).toBe('Just a paragraph');
		expect(canonicalizeTaskLine('- A bullet, not a task')).toBe('- A bullet, not a task');
	});
});

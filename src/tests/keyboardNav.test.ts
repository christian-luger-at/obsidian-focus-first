/**
 * Tests for keyboardNav.ts — the pure selection-movement and key-to-action
 * dispatch logic behind keyboard navigation in the view (issue #11).
 */
import { describe, it, expect } from 'vitest';
import { resolveAction, moveLinear, moveSection } from '../keyboardNav';

describe('resolveAction', () => {
	it('maps arrow keys to move actions', () => {
		expect(resolveAction({ key: 'ArrowUp' })).toEqual({ kind: 'move', dir: 'up' });
		expect(resolveAction({ key: 'ArrowDown' })).toEqual({ kind: 'move', dir: 'down' });
		expect(resolveAction({ key: 'ArrowLeft' })).toEqual({ kind: 'move', dir: 'prevSection' });
		expect(resolveAction({ key: 'ArrowRight' })).toEqual({ kind: 'move', dir: 'nextSection' });
	});

	it('maps task-action keys', () => {
		expect(resolveAction({ key: 'Enter' })).toEqual({ kind: 'open' });
		expect(resolveAction({ key: 'c' })).toEqual({ kind: 'complete' });
		expect(resolveAction({ key: ' ' })).toEqual({ kind: 'complete' });
		expect(resolveAction({ key: 'f' })).toEqual({ kind: 'focus' });
		expect(resolveAction({ key: 'h' })).toEqual({ kind: 'hide' });
	});

	it('maps digit keys to the matching quadrant move', () => {
		expect(resolveAction({ key: '1' })).toEqual({ kind: 'moveQuadrant', quadrant: 'do' });
		expect(resolveAction({ key: '2' })).toEqual({ kind: 'moveQuadrant', quadrant: 'schedule' });
		expect(resolveAction({ key: '3' })).toEqual({ kind: 'moveQuadrant', quadrant: 'delegate' });
		expect(resolveAction({ key: '4' })).toEqual({ kind: 'moveQuadrant', quadrant: 'eliminate' });
	});

	it('ignores unknown keys and modifier combos', () => {
		expect(resolveAction({ key: 'z' })).toBeNull();
		expect(resolveAction({ key: 'c', ctrlKey: true })).toBeNull();
		expect(resolveAction({ key: 'ArrowDown', metaKey: true })).toBeNull();
		expect(resolveAction({ key: '1', altKey: true })).toBeNull();
	});
});

describe('moveLinear', () => {
	it('moves within bounds', () => {
		expect(moveLinear(1, 5, 1)).toBe(2);
		expect(moveLinear(3, 5, -1)).toBe(2);
	});

	it('clamps at the ends', () => {
		expect(moveLinear(0, 5, -1)).toBe(0);
		expect(moveLinear(4, 5, 1)).toBe(4);
	});

	it('returns -1 for an empty list', () => {
		expect(moveLinear(0, 0, 1)).toBe(-1);
	});
});

describe('moveSection', () => {
	// Two sections: A (indices 0-1) and B (indices 2-4).
	const sections = ['A', 'A', 'B', 'B', 'B'];

	it('jumps forward to the first item of the next section', () => {
		expect(moveSection(sections, 0, 1)).toBe(2);
		expect(moveSection(sections, 1, 1)).toBe(2);
	});

	it('jumps back to the first item of the previous section', () => {
		expect(moveSection(sections, 3, -1)).toBe(0);
		expect(moveSection(sections, 2, -1)).toBe(0);
	});

	it('stays put at the boundaries', () => {
		expect(moveSection(sections, 0, -1)).toBe(0);
		expect(moveSection(sections, 4, 1)).toBe(4);
	});

	it('handles three sections when jumping from the middle', () => {
		const three = ['A', 'B', 'B', 'C'];
		expect(moveSection(three, 2, 1)).toBe(3); // B -> C
		expect(moveSection(three, 2, -1)).toBe(0); // B -> A
	});

	it('returns the index unchanged for an empty list', () => {
		expect(moveSection([], 0, 1)).toBe(0);
	});
});

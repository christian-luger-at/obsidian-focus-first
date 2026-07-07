/**
 * Pure keyboard-navigation helpers for the Focus First view (issue #11): mapping
 * a key press to an action, and computing the next selection index for linear
 * (↑/↓) and section (←/→) movement. Kept DOM-free so the movement and dispatch
 * logic can be unit-tested without a rendered view.
 */
import { Quadrant } from './matrixClassifier';

export type KeyAction =
	| { kind: 'move'; dir: 'up' | 'down' | 'prevSection' | 'nextSection' }
	| { kind: 'open' }
	| { kind: 'complete' }
	| { kind: 'focus' }
	| { kind: 'hide' }
	| { kind: 'moveQuadrant'; quadrant: Quadrant };

/**
 * Maps a keyboard event to an action, or null when the key isn't a shortcut (so
 * Obsidian handles it). Modifier combos are ignored to avoid clashing with
 * Obsidian hotkeys while the view is focused.
 */
export function resolveAction(
	event: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean },
): KeyAction | null {
	if (event.ctrlKey || event.metaKey || event.altKey) return null;
	switch (event.key) {
		case 'ArrowUp': return { kind: 'move', dir: 'up' };
		case 'ArrowDown': return { kind: 'move', dir: 'down' };
		case 'ArrowLeft': return { kind: 'move', dir: 'prevSection' };
		case 'ArrowRight': return { kind: 'move', dir: 'nextSection' };
		case 'Enter': return { kind: 'open' };
		case ' ':
		case 'c': return { kind: 'complete' };
		case 'f': return { kind: 'focus' };
		case 'h': return { kind: 'hide' };
		case '1': return { kind: 'moveQuadrant', quadrant: 'do' };
		case '2': return { kind: 'moveQuadrant', quadrant: 'schedule' };
		case '3': return { kind: 'moveQuadrant', quadrant: 'delegate' };
		case '4': return { kind: 'moveQuadrant', quadrant: 'eliminate' };
		default: return null;
	}
}

/** Clamps `index + delta` into `[0, count - 1]`; returns -1 for an empty list. */
export function moveLinear(index: number, count: number, delta: number): number {
	if (count === 0) return -1;
	return Math.max(0, Math.min(count - 1, index + delta));
}

/**
 * The index of the first item in the previous (`dir = -1`) or next (`dir = 1`)
 * distinct section, given each item's section key. Stays put when there is no
 * section in that direction.
 */
export function moveSection(sections: string[], index: number, dir: 1 | -1): number {
	if (sections.length === 0 || index < 0 || index >= sections.length) return index;
	const current = sections[index];

	if (dir === 1) {
		for (let i = index + 1; i < sections.length; i++) {
			if (sections[i] !== current) return i;
		}
		return index;
	}

	// Walk back to a different section, then to the start of that section.
	let i = index - 1;
	while (i >= 0 && sections[i] === current) i--;
	if (i < 0) return index;
	const prev = sections[i];
	while (i - 1 >= 0 && sections[i - 1] === prev) i--;
	return i;
}

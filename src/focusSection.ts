import { Quadrant } from './matrixClassifier';

/** A selectable Focus First data section: the focus list or one quadrant. */
export type FocusSection = 'focus' | Quadrant;

const QUADRANTS: Quadrant[] = ['do', 'schedule', 'delegate', 'eliminate'];

export function isFocusSection(value: string): value is FocusSection {
	return value === 'focus' || (QUADRANTS as string[]).includes(value);
}

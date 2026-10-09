import { copy } from '@/constants/copy';

/** What stands in place of a hidden number. No sign, no digits, no suffix. */
export const BALANCE_MASK = '••••';

/** A number with an optional `$` and a compact suffix (`1.2K` leaks scale). */
const FIGURE = /\$?\d[\d,]*(?:\.\d+)?(?:[KMBT](?![A-Za-z]))?/g;

/** A whole figure field: anything holding a digit becomes the mask. */
export function maskFigure(text: string): string;
export function maskFigure(text: string | null): string | null;
export function maskFigure(text: string | null): string | null {
  if (text === null) return null;
  return /\d/.test(text) ? BALANCE_MASK : text;
}

/** A sentence that carries figures: each number becomes the mask in place. */
export function maskFiguresInline(text: string): string {
  return text.replace(FIGURE, BALANCE_MASK);
}

/**
 * The screen-reader reading of a drawn value: each mask reads as the approved
 * label, never as bullets, and the words around it (symbol, time) still read.
 */
export function spokenFigure(text: string): string {
  return text.split(BALANCE_MASK).join(copy.profile.preferencesBalanceHidden);
}

/** An explicit label only where the drawn text is masked; else the text reads itself. */
export function maskedFigureLabel(
  text: string | null | undefined,
): string | undefined {
  return text != null && text.includes(BALANCE_MASK)
    ? spokenFigure(text)
    : undefined;
}

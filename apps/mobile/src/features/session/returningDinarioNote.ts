import type { PreferenceStorage } from '@/src/lib/analyticsPreference';
import { PARI_MARK_INK } from '@/src/ui/brand/pariMarkSource';
import {
  QUIET_HEADLINE_TOP,
  QUIET_MARK_GET_STARTED,
} from '@/src/ui/quiet/quietMarkPresentation';

export const DINARIO_LEFTOVER_KEYS = Object.freeze([
  'dinario_install_id',
  'dinario_install_reported',
  '@dinario/onboarding_seen',
] as const);

/** Device-scoped, once per install. Sign-out never clears it. */
export const RETURNING_DINARIO_NOTE_SEEN_KEY =
  '@corso/returningDinarioNote/seen';

export const RETURNING_DINARIO_NOTE_HREF = '/(auth)/returning';

export type DinarioLeftoverStorage = Pick<PreferenceStorage, 'getItem'>;

export async function hasDinarioLeftovers(
  storage: DinarioLeftoverStorage,
): Promise<boolean> {
  for (const key of DINARIO_LEFTOVER_KEYS) {
    try {
      if ((await storage.getItem(key)) != null) return true;
    } catch {
      // Absent. Try the next key.
    }
  }
  return false;
}

export async function readReturningDinarioNoteSeen(
  storage: DinarioLeftoverStorage,
): Promise<boolean> {
  try {
    return (await storage.getItem(RETURNING_DINARIO_NOTE_SEEN_KEY)) === '1';
  } catch {
    // Fail closed to seen: a note that may not show beats one that repeats.
    return true;
  }
}

export async function markReturningDinarioNoteSeen(
  storage: Pick<PreferenceStorage, 'setItem'>,
): Promise<void> {
  await storage.setItem(RETURNING_DINARIO_NOTE_SEEN_KEY, '1');
}

export type ReturningDinarioNoteInput = {
  flavor: string;
  /** A Corso session, or a Privy user Welcome would resume. */
  signedIn: boolean;
};

export async function shouldShowReturningDinarioNote(
  input: ReturningDinarioNoteInput,
  storage: DinarioLeftoverStorage,
): Promise<boolean> {
  if (input.flavor !== 'seeker') return false;
  if (input.signedIn) return false;
  if (await readReturningDinarioNoteSeen(storage)) return false;
  return hasDinarioLeftovers(storage);
}

export const RETURNING_NOTE_COMPACT_GAP = 24;

export function resolveReturningNoteLayout(input: {
  wordsBottom: number;
  ctaTop: number;
}): 'regular' | 'compact' {
  return input.ctaTop - input.wordsBottom < RETURNING_NOTE_COMPACT_GAP
    ? 'compact'
    : 'regular';
}

type QuietFrame = { scale: number; dx: number; dy: number };

/**
 * The Pari mark at the Get Started lift (`QUIET_MARK_GET_STARTED`), scaled to
 * cover the device frame: a box whose ink is `drawnWidth`
 * wide, centred on the target. Pari ink is a share of its box
 * (`PARI_MARK_INK`), unlike the old Corso mark `placeQuietMark` assumes.
 */
export function placeReturningNoteMark(frame: QuietFrame): {
  size: number;
  left: number;
  top: number;
} {
  const ink = PARI_MARK_INK;
  const target = QUIET_MARK_GET_STARTED;
  const size =
    ((target.drawnWidth * frame.scale) / (ink.right - ink.left)) * 100;
  const k = size / 100;
  return {
    size,
    left: frame.dx + target.cx * frame.scale - ((ink.left + ink.right) / 2) * k,
    top: frame.dy + target.cy * frame.scale - ((ink.top + ink.bottom) / 2) * k,
  };
}

/** The headline's top on the device: the Welcome screen's line (`QUIET_HEADLINE_TOP`). */
export function resolveReturningNoteHeadlineTop(frame: QuietFrame): number {
  return frame.dy + QUIET_HEADLINE_TOP * frame.scale;
}

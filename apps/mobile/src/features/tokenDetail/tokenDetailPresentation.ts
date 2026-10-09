import { copy } from '@/constants/copy';
import type { VitalsSafetyPresentation } from '@/src/features/tokenVitals/tokenVitalsPresentation';
import type {
  SafetyFlagV2,
  SafetyVerdict,
  SafetyVerdictLevel,
} from '@/src/features/tokenVitals/types';
import {
  resolveReadRing,
  type ReadRingView,
} from '@/src/features/tokenVitals/readRingCatalog';
import {
  resolveVerdictEvidenceRows,
  resolveVerdictSourcesSubLine,
  resolveVerdictWord,
} from '@/src/features/tokenVitals/verdictSurface';
import { formatPriceUsd } from '@/src/ui/format/numberCraft';
import { GLASS_FAINT } from '@/src/ui/glass/glassTokens';
import type { VerdictEvidenceChip } from '@/src/ui/verdict/VerdictCard';
import type { VerdictTone } from '@/src/ui/verdict/verdictCardPresentation';

export type TokenDetailReceipt = VerdictEvidenceChip;

export type TokenDetailVerdict =
  | { kind: 'off'; message: string }
  | { kind: 'checking'; message: string }
  | { kind: 'unavailable'; message: string }
  | {
      kind: 'unread';
      message: string;
      receipts: TokenDetailReceipt[];
      ring: ReadRingView | null;
      tone: 'unread';
    }
  | {
      kind: 'ready';
      /** Drives the atom's dot. Green → buy, amber → caution, red → avoid. */
      tone: VerdictTone;
      word: string;
      ring: ReadRingView | null;
      /** One line under the word: the provider score, the sources, the caveat. */
      subLine: string | null;
      receipts: TokenDetailReceipt[];
      accessibilityLabel: string;
    };

/** The three server levels that are a verdict, and the atom's tone for each. */
const VERDICT_TONE: Readonly<
  Record<Exclude<SafetyVerdictLevel, 'unknown'>, VerdictTone>
> = Object.freeze({
  green: 'buy',
  amber: 'caution',
  red: 'avoid',
});

export function resolveTokenDetailVerdict(input: {
  enabled: boolean;
  safety: VitalsSafetyPresentation | null;
  flags: readonly SafetyFlagV2[];
  /** The raw server verdict — the only thing the ring is folded from. */
  verdict?: SafetyVerdict | null;
  fetching: boolean;
  fetchFailed: boolean;
}): TokenDetailVerdict {
  if (!input.enabled)
    return { kind: 'off', message: copy.tokenDetail.safetyOff };
  const safety = input.safety;
  if (safety == null) {
    return input.fetchFailed && !input.fetching
      ? { kind: 'unavailable', message: copy.tokenDetail.safetyUnavailable }
      : { kind: 'checking', message: copy.tokenDetail.safetyChecking };
  }
  if (safety.checking) {
    return { kind: 'checking', message: copy.tokenDetail.safetyChecking };
  }
  const receipts = resolveVerdictEvidenceRows(input.flags);
  const ring = resolveReadRing(input.verdict ?? null);
  if (safety.verdictLevel === 'unknown') {
    return {
      kind: 'unread',
      message: resolveVerdictWord('unknown'),
      receipts,
      ring,
      tone: 'unread',
    };
  }
  return {
    kind: 'ready',
    tone: VERDICT_TONE[safety.verdictLevel],
    word: resolveVerdictWord(safety.verdictLevel),
    ring,
    subLine: ring?.reason ?? resolveVerdictSubLine(safety),
    receipts,
    accessibilityLabel: copy.tokenDetail.safetyA11y(
      resolveVerdictWord(safety.verdictLevel),
      safety.sourcesLine,
    ),
  };
}

function resolveVerdictSubLine(
  safety: VitalsSafetyPresentation,
): string | null {
  return resolveVerdictSourcesSubLine({
    scoreLine: null,
    sourcesLine: safety.sourcesLine,
    unreconciledLine: safety.unreconciledLine,
  });
}

export type TokenDetailMover = {
  text: string;
  tone: string;
  accessibilityLabel: string;
};

export function resolveTokenDetailMover(input: {
  changeText: string | null;
  changeTone: string;
}): TokenDetailMover | null {
  if (!input.changeText) return null;
  return {
    text: input.changeText,
    tone: input.changeTone,
    accessibilityLabel: copy.tokenDetail.moverA11y(input.changeText),
  };
}

/** Dot colour when there is a verdict word but the server gave no hue. */
export const TOKEN_DETAIL_UNKNOWN_DOT = GLASS_FAINT;

export function resolveTokenDetailPriceText(input: {
  /** Already-formatted vitals price, when the flag is on. */
  vitalsPriceText: string | null;
  /** Raw provider decimal string from the public price quote. */
  quotePriceUsd: string | null;
}): string | null {
  if (input.vitalsPriceText) return input.vitalsPriceText;
  if (!input.quotePriceUsd) return null;
  return formatPriceUsd(input.quotePriceUsd);
}

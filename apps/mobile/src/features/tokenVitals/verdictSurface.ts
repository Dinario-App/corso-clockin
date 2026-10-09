import { copy } from '@/constants/copy';
import type {
  SafetyFlagV2,
  SafetyVerdictLevel,
} from '@/src/features/tokenVitals/types';
import { resolveVerdictPresentation } from '@/src/features/tokenVitals/tokenVitalsPresentation';
import { spacing } from '@/src/ui/tokens';
import type { VerdictEvidenceChip } from '@/src/ui/verdict/VerdictCard';
import {
  VERDICT_CARD_GEOMETRY,
  type VerdictChipTone,
} from '@/src/ui/verdict/verdictCardPresentation';

const EVIDENCE_TONE: Readonly<Record<SafetyFlagV2['level'], VerdictChipTone>> =
  Object.freeze({
    danger: 'danger',
    warn: 'warn',
    ok: 'ok',
    info: 'neutral',
  });

export function resolveVerdictEvidenceRows(
  flags: readonly SafetyFlagV2[],
): VerdictEvidenceChip[] {
  return flags.map((flag, index) => {
    const kind = resolveEvidenceKind(flag);
    return {
      key: `${flag.key}:${index}`,
      tone: EVIDENCE_TONE[flag.level],
      label: kind?.label ?? flag.label,
      value: kind?.value ?? null,
    };
  });
}

export const VERDICT_SOURCES_SUB_INNER_WIDTH_AT_369 =
  369 - 2 * spacing.gutter - 2 * VERDICT_CARD_GEOMETRY.padding;

/**
 * Largest system text scale the disagreeing sub-line claims. Set just under
 * the point where score 100 at 369 dp breaks `RugCheck score | 100` (tabular
 * `100` at 2.0 is 6.9 dp over 293). The cap exists only to keep the caution
 * whole; agreeing sources stay uncapped.
 */
export const VERDICT_SOURCES_SUB_MAX_FONT_SCALE = 1.9;

export type VerdictSourcesSubLinePresentation = {
  text: string | null;
  lines: 1 | 2 | undefined;
  accessibilityLabel: string | null;
  maxFontSizeMultiplier: number | undefined;
};

export function resolveVerdictSourcesSubLinePresentation(input: {
  scoreLine: string | null;
  sourcesLine: string | null;
  unreconciledLine: string | null;
}): VerdictSourcesSubLinePresentation {
  const names = sourceNames(input);
  const rest = input.scoreLine
    ? names.filter((name) => name !== 'RugCheck')
    : names;
  const short = sourcesDisagreeCaution(input.unreconciledLine);
  const full =
    input.unreconciledLine == null || input.unreconciledLine === ''
      ? null
      : input.unreconciledLine.trim();
  const text = joinSubLineParts([input.scoreLine, short, ...rest]);
  const accessibilityLabel = joinSubLineParts([input.scoreLine, full, ...rest]);
  const lines: 1 | 2 = full ? 2 : 1;
  return {
    text,
    lines,
    accessibilityLabel,
    maxFontSizeMultiplier:
      lines === 2 ? VERDICT_SOURCES_SUB_MAX_FONT_SCALE : undefined,
  };
}

export function resolveVerdictSourcesSubLine(input: {
  scoreLine: string | null;
  sourcesLine: string | null;
  unreconciledLine: string | null;
}): string | null {
  return resolveVerdictSourcesSubLinePresentation(input).text;
}

export function presentVerdictSourcesSubLine(
  subLine: string | null,
): Pick<
  VerdictSourcesSubLinePresentation,
  'lines' | 'accessibilityLabel' | 'maxFontSizeMultiplier'
> {
  if (subLine == null || subLine === '') {
    return {
      lines: 1,
      accessibilityLabel: null,
      maxFontSizeMultiplier: undefined,
    };
  }
  const full = copy.vitals.unreconciled;
  const short = sourcesDisagreeCaution(full);
  if (short && subLine.includes(short)) {
    const accessibilityLabel = subLine.includes(full)
      ? subLine
      : subLine.replace(short, full);
    return {
      lines: 2,
      accessibilityLabel,
      maxFontSizeMultiplier: VERDICT_SOURCES_SUB_MAX_FONT_SCALE,
    };
  }
  return {
    lines: undefined,
    accessibilityLabel: subLine,
    maxFontSizeMultiplier: undefined,
  };
}

function sourceNames(input: { sourcesLine: string | null }): string[] {
  const prefix = copy.vitals.per('');
  const body =
    input.sourcesLine == null || input.sourcesLine === ''
      ? ''
      : input.sourcesLine.startsWith(prefix)
        ? input.sourcesLine.slice(prefix.length)
        : input.sourcesLine;
  return body
    .split(' + ')
    .map((name) => name.trim())
    .filter(Boolean);
}

function joinSubLineParts(parts: Array<string | null>): string | null {
  const present = parts.filter(
    (part): part is string => part != null && part !== '',
  );
  return present.length > 0 ? present.join(' · ') : null;
}

function sourcesDisagreeCaution(
  unreconciledLine: string | null,
): string | null {
  if (unreconciledLine == null || unreconciledLine === '') return null;
  const comma = unreconciledLine.indexOf(',');
  return (
    comma === -1 ? unreconciledLine : unreconciledLine.slice(0, comma)
  ).trim();
}

function extractPct(text: string | undefined): string | null {
  if (!text) return null;
  const match = text.match(/(\d+(?:\.\d+)?)%/);
  return match ? `${match[1]}%` : null;
}

function extractUsd(text: string | undefined): string | null {
  if (!text) return null;
  const match = text.match(/\$[\d,]+(?:\.\d+)?/);
  return match ? match[0] : null;
}

function blobOf(flag: SafetyFlagV2): string {
  return `${flag.value ?? ''} ${flag.label}`;
}

function authorityMetric(text: string): string | null {
  if (/renounc|revok/i.test(text)) return 'Renounced';
  if (/active|inflat|frozen after/i.test(text)) return 'Active';
  return null;
}

function pctOrUnknown(flag: SafetyFlagV2, unknown: boolean): string | null {
  if (unknown) return 'Unknown';
  return extractPct(flag.value) ?? extractPct(flag.label);
}

/**
 * Kind → short label + metric. `null` means the kind is unknown and the
 * caller must fall back to the server sentence.
 */
function resolveEvidenceKind(
  flag: SafetyFlagV2,
): { label: string; value: string | null } | null {
  const blob = blobOf(flag);
  switch (flag.key) {
    case 'lp_lock':
      return {
        label: 'LP locked',
        value: extractPct(flag.value) ?? extractPct(flag.label),
      };
    case 'mint_authority':
      return { label: 'Mint authority', value: authorityMetric(blob) };
    case 'freeze_authority':
      return { label: 'Freeze authority', value: authorityMetric(blob) };
    case 'top10_concentration':
      return {
        label: /top-1\b|top holder/i.test(blob)
          ? 'Top holder'
          : 'Top-10 holders',
        value: extractPct(flag.value) ?? extractPct(flag.label),
      };
    case 'transfer_fee':
      return {
        label: 'Transfer fee',
        value:
          extractPct(flag.value) ??
          extractPct(flag.label) ??
          (/present/i.test(blob) ? 'On' : null),
      };
    case 'mutable_metadata':
      return { label: 'Metadata', value: 'Mutable' };
    case 'rugged':
      return { label: 'Rug reports', value: 'Flagged' };
    case 'insider_network':
      return {
        label: 'Insider network',
        value: extractPct(flag.value) ?? extractPct(flag.label) ?? 'Detected',
      };
    case 'low_liquidity':
      return {
        label: 'Liquidity',
        value: extractUsd(flag.value) ?? extractUsd(flag.label) ?? 'Low',
      };
    case 'sniper_share':
      return {
        label: 'Snipers',
        value: pctOrUnknown(flag, /unknown|insufficient/i.test(blob)),
      };
    case 'bundler_share':
      return {
        label: 'Bundled wallets',
        value: pctOrUnknown(flag, /unknown|insufficient/i.test(blob)),
      };
    case 'insider_cluster':
      if (/no insider cluster/i.test(blob)) {
        return { label: 'Insider clusters', value: 'None' };
      }
      return {
        label: 'Insider clusters',
        value: pctOrUnknown(flag, /unknown|insufficient/i.test(blob)),
      };
    default:
      return null;
  }
}

export function resolveVerdictWord(level: SafetyVerdictLevel): string {
  return resolveVerdictPresentation(level).label;
}


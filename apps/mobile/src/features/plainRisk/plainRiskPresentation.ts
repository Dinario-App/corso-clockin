import { plainRiskCopy as C } from '@/constants/copy/plainRisk';
import { formatObservationStamp } from '@/src/features/home/asOfPresentation';
import type {
  PlainRiskLevel,
  PlainRiskRead,
  PlainRiskReason,
} from './parsePlainRisk';

export type PlainRiskTone = 'clear' | 'caution' | 'danger' | 'neutral';

export type PlainRiskFace = {
  level: PlainRiskLevel;
  /** The level word: the whole read, in plain words. */
  label: string;
  /** `safetyPalette` key for the glyph's lit bars. */
  tone: PlainRiskTone;
  /** Lit bars of five, low to high. Zero on both grey states. */
  litBars: 0 | 1 | 3 | 5;
  subLine: string | null;
  accessibilityLabel: string;
};

export const RISK_GLYPH_BARS = 5;

const FACE: Record<
  PlainRiskLevel,
  { tone: PlainRiskTone; litBars: PlainRiskFace['litBars'] }
> = {
  green: { tone: 'clear', litBars: 1 },
  amber: { tone: 'caution', litBars: 3 },
  red: { tone: 'danger', litBars: 5 },
  notEnoughData: { tone: 'neutral', litBars: 0 },
  unavailable: { tone: 'neutral', litBars: 0 },
};

export function resolvePlainRiskFace(read: PlainRiskRead): PlainRiskFace {
  const label = C.level[read.level];
  const subLine = read.level === 'green' ? C.greenLine : null;
  return {
    level: read.level,
    label,
    tone: FACE[read.level].tone,
    litBars: FACE[read.level].litBars,
    subLine,
    accessibilityLabel: subLine ? `${label}. ${subLine}` : label,
  };
}

/* ─── The sheet ───────────────────────────────────────────────────────────── */

export type PlainRiskSheetLine = {
  key:
    | 'issuer'
    | 'canSell'
    | 'supply'
    | 'freeze'
    | 'holders'
    | 'trading'
    | 'delegate'
    | 'other'
    | 'otherEmpty';
  text: string;
  /** `flagged` lines say what was found; `empty` lines say we couldn't check. */
  state: 'ok' | 'flagged' | 'empty' | 'disclosed';
};

export type PlainRiskSheet = {
  title: string;
  scope: string;
  subLine: string | null;
  /** One line per check. Empty on `unavailable`: there's nothing to list. */
  lines: readonly PlainRiskSheetLine[];
  checkedAt: string | null;
};

type CheckKey = 'canSell' | 'supply' | 'freeze' | 'holders' | 'trading';

/** Which reason codes and which empty-check names belong to each check. */
const CHECKS: readonly {
  key: CheckKey;
  flagged: readonly PlainRiskReason['code'][];
  empty: readonly string[];
}[] = [
  { key: 'canSell', flagged: ['cannot_sell'], empty: ['can_sell'] },
  { key: 'supply', flagged: ['mint_authority'], empty: ['mint_authority'] },
  { key: 'freeze', flagged: ['freeze_authority'], empty: ['freeze_authority'] },
  { key: 'holders', flagged: ['holders_concentrated'], empty: ['holders'] },
  {
    key: 'trading',
    flagged: ['no_liquidity', 'thin_liquidity', 'low_liquidity'],
    empty: ['liquidity'],
  },
];

const NAMED_CODES: ReadonlySet<PlainRiskReason['code']> = new Set([
  ...CHECKS.flatMap((c) => c.flagged),
  'issuer_can_mint',
  'issuer_can_freeze',
  'issuer_can_move',
  'permanent_delegate',
  'check_empty',
]);

function issuerLine(
  reasons: readonly PlainRiskReason[],
): PlainRiskSheetLine | null {
  const freeze = reasons.find((r) => r.code === 'issuer_can_freeze');
  const supply = reasons.find((r) => r.code === 'issuer_can_mint');
  const move = reasons.find((r) => r.code === 'issuer_can_move');
  const issuer = freeze?.issuer ?? supply?.issuer ?? move?.issuer;
  if (!issuer) return null;
  const powers = move
    ? freeze && supply
      ? C.issuerPowers.all
      : freeze
        ? C.issuerPowers.freezeMove
        : supply
          ? C.issuerPowers.supplyMove
          : C.issuerPowers.move
    : freeze && supply
      ? C.issuerPowers.both
      : freeze
        ? C.issuerPowers.freeze
        : C.issuerPowers.supply;
  return {
    key: 'issuer',
    text: C.issuerLine(issuer, powers),
    state: 'disclosed',
  };
}

export function resolvePlainRiskSheet(
  read: PlainRiskRead,
  options: { clock?: '24h' | '12h'; nowMs?: number } = {},
): PlainRiskSheet {
  const face = resolvePlainRiskFace(read);
  if (read.level === 'unavailable') {
    return {
      title: face.label,
      scope: C.sheet.scope,
      subLine: null,
      lines: [],
      checkedAt: null,
    };
  }

  const { reasons } = read;
  const codes = new Set(reasons.map((r) => r.code));
  const emptyChecks = new Set(
    reasons.filter((r) => r.code === 'check_empty').map((r) => r.check),
  );
  const issuer = issuerLine(reasons);

  const lines: PlainRiskSheetLine[] = [];
  if (issuer) lines.push(issuer);
  for (const check of CHECKS) {
    /** The issuer line names the power, so it replaces that check's line. */
    if (issuer && check.key === 'supply' && codes.has('issuer_can_mint'))
      continue;
    if (issuer && check.key === 'freeze' && codes.has('issuer_can_freeze'))
      continue;
    if (check.flagged.some((code) => codes.has(code))) {
      lines.push({
        key: check.key,
        text: C.check[check.key].flagged,
        state: 'flagged',
      });
    } else if (check.empty.some((name) => emptyChecks.has(name))) {
      lines.push({ key: check.key, text: C.check.empty, state: 'empty' });
    } else {
      lines.push({ key: check.key, text: C.check[check.key].ok, state: 'ok' });
    }
  }
  if (codes.has('permanent_delegate')) {
    lines.push({ key: 'delegate', text: C.check.delegate, state: 'flagged' });
  }
  if (read.unreadReasons || reasons.some((r) => !NAMED_CODES.has(r.code))) {
    lines.push({ key: 'other', text: C.otherFlag, state: 'flagged' });
  }
  const named = new Set(CHECKS.flatMap((c) => c.empty));
  if (
    read.level !== 'green' &&
    [...emptyChecks].some((name) => name != null && !named.has(name))
  ) {
    lines.push({ key: 'otherEmpty', text: C.otherEmpty, state: 'empty' });
  }

  const clock = formatObservationStamp(
    read.asOfMs,
    options.nowMs ?? Date.now(),
    options.clock,
  );
  return {
    title: face.label,
    scope: C.sheet.scope,
    subLine: face.subLine,
    lines,
    checkedAt: clock == null ? null : C.sheet.checkedAt(clock),
  };
}

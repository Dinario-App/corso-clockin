import { readRingCopy as C } from '@/constants/copy/readRing';
import { copy } from '@/constants/copy';
import type {
  SafetyCatalogFact,
  SafetyCatalogV1,
  SafetyFlagLevel,
  SafetyVerdict,
  SafetyVerdictLevel,
} from './types';

/* ─── The catalogue ───────────────────────────────────────────────────────── */

export type ReadRingCheckId =
  | 'mint_authority'
  | 'freeze_authority'
  | 'token_extensions'
  | 'rug_pulled'
  | 'top10_holders'
  | 'dev_holds'
  | 'snipers_insiders'
  | 'liquidity_pool';

/** Which of the two server reads answers for a check. */
export type ReadRingRead = 'core' | 'enrichment';

export type ReadRingCheck = {
  id: ReadRingCheckId;
  read: ReadRingRead;
  label: string;
  /** The catalog fact keys this check folds, in tie-break order. */
  keys: readonly SafetyCatalogFact['key'][];
};

export const READ_RING_CHECKS: readonly ReadRingCheck[] = Object.freeze([
  {
    id: 'mint_authority',
    read: 'core',
    label: C.checks.mintAuthority,
    keys: ['mint_authority'],
  },
  {
    id: 'freeze_authority',
    read: 'core',
    label: C.checks.freezeAuthority,
    keys: ['freeze_authority'],
  },
  {
    id: 'token_extensions',
    read: 'core',
    label: C.checks.tokenExtensions,
    keys: [
      'non_transferable',
      'paused',
      'pausable',
      'permanent_delegate',
      'default_frozen',
      'transfer_hook',
      'transfer_fee',
    ],
  },
  {
    id: 'rug_pulled',
    read: 'enrichment',
    label: C.checks.rugPulled,
    keys: ['rugged'],
  },
  {
    id: 'top10_holders',
    read: 'enrichment',
    label: C.checks.top10Holders,
    keys: ['top10_concentration'],
  },
  {
    id: 'dev_holds',
    read: 'enrichment',
    label: C.checks.devHolds,
    keys: ['dev_share'],
  },
  {
    id: 'snipers_insiders',
    read: 'enrichment',
    label: C.checks.snipersInsiders,
    keys: ['sniper_share', 'insider_cluster', 'bundler_share'],
  },
  {
    id: 'liquidity_pool',
    read: 'enrichment',
    label: C.checks.liquidityPool,
    keys: ['lp_lock', 'low_liquidity'],
  },
] as const);

/** Three core checks, five enrichment checks. Coverage is the sum of the reads. */
export const READ_RING_CORE_CHECKS = READ_RING_CHECKS.filter(
  (check) => check.read === 'core',
).length;
export const READ_RING_ENRICHMENT_CHECKS = READ_RING_CHECKS.filter(
  (check) => check.read === 'enrichment',
).length;
export const READ_RING_CHECK_COUNT = READ_RING_CHECKS.length;

/* ─── The cell ────────────────────────────────────────────────────────────── */

export type ReadRingMark =
  | 'clean'
  | 'info'
  | 'unknown'
  | 'not_read'
  | 'warn'
  | 'danger';

export type ReadRingCellLine = {
  key: string;
  mark: ReadRingMark;
  text: string;
};

export type ReadRingCell = {
  id: ReadRingCheckId;
  label: string;
  read: ReadRingRead;
  /** Did this CHECK answer, from an explicit receipt. */
  answered: boolean;
  /** The worst level among this cell's facts; null when it has none. */
  level: SafetyFlagLevel | null;
  mark: ReadRingMark;
  /** The printed value — a measured word, "Unknown", or "Not read". */
  value: string;
  unknown: boolean;
  extra: ReadRingCellLine[];
};

export type ReadRingStamp = {
  coreAsOf: string;
  enrichmentAsOf: string;
  /** The OLDER of the two: a card never dates a read by the newer one. */
  asOf: string;
};

export type ReadRingNotRunRow = {
  key: ReadRingRead;
  label: string;
  value: string;
};

export type ReadRingView = {
  verdict: SafetyVerdictLevel;
  /** 0…8, from the read statuses alone. */
  coverage: number;
  coverageLine: string;
  coverageShort: string;
  cells: ReadRingCell[];
  notRun: ReadRingRead[];
  notRunRows: ReadRingNotRunRow[];
  /** The partial-read caption; null when both reads answered. */
  caption: string | null;
  reason: string;
  /** Cells that read but measured nothing — the green reason's count. */
  unknownCells: number;
  flaggedCells: number;
  stamp: ReadRingStamp | null;
  accessibilityLabel: string;
};

/* ─── Fold ────────────────────────────────────────────────────────────────── */

const SEVERITY: Readonly<Record<SafetyFlagLevel, number>> = Object.freeze({
  danger: 0,
  warn: 1,
  info: 2,
  ok: 3,
});

const CATALOG_KEY_ORDER: readonly SafetyCatalogFact['key'][] = Object.freeze([
  'mint_authority',
  'freeze_authority',
  'non_transferable',
  'paused',
  'pausable',
  'permanent_delegate',
  'default_frozen',
  'transfer_hook',
  'transfer_fee',
  'rugged',
  'top10_concentration',
  'dev_share',
  'sniper_share',
  'insider_cluster',
  'bundler_share',
  'lp_lock',
  'low_liquidity',
] as const);

const SECONDARY_SOURCES: ReadonlySet<SafetyCatalogFact['source']> = new Set([
  'birdeye_security',
  'onchain_intel',
]);

const MARK_FOR_LEVEL: Readonly<Record<SafetyFlagLevel, ReadRingMark>> =
  Object.freeze({
    danger: 'danger',
    warn: 'warn',
    info: 'info',
    ok: 'clean',
  });

function factWord(
  fact: SafetyCatalogFact,
  trusted: boolean,
  pauseStateUnreadable: boolean,
  concentrationResult?: NonNullable<
    SafetyCatalogV1['checkResults']
  >['top10_holders'],
): string | null {
  switch (fact.key) {
    case 'mint_authority':
    case 'freeze_authority':
      if (fact.level === 'ok') return C.values.renounced;
      if (fact.level === 'danger') return C.values.active;
      return trusted ? C.values.active : null;
    case 'permanent_delegate':
      return fact.level === 'ok' ? null : C.values.delegate;
    case 'default_frozen':
      return fact.level === 'ok' ? null : C.values.startsFrozen;
    case 'transfer_hook':
      return fact.level === 'ok' ? null : C.values.hook;
    case 'transfer_fee':
      return fact.level === 'ok' ? null : C.values.fee(fact.value);
    case 'non_transferable':
      return fact.level === 'ok' ? null : C.values.nonTransferable;
    case 'pausable':
      return fact.level === 'ok' || pauseStateUnreadable
        ? null
        : C.values.pausable;
    case 'paused':
      return fact.level === 'danger' ? C.values.paused : null;
    case 'rugged':
      return fact.level === 'danger' ? C.values.flagged : C.values.notFlagged;
    case 'top10_concentration':
      if (
        fact.value == null &&
        concentrationResult === 'not_applicable' &&
        fact.level === 'info'
      )
        return C.values.onCurve;
      if (fact.value == null) return null;
      return fact.source === 'birdeye_security'
        ? C.values.topHolder(fact.value)
        : fact.value;
    case 'dev_share':
      return fact.value;
    case 'sniper_share':
      return fact.value == null ? null : C.values.snipers(fact.value);
    case 'insider_cluster':
      return fact.value == null ? null : C.values.insiders(fact.value);
    case 'bundler_share':
      return fact.value == null ? null : C.values.bundles(fact.value);
    case 'lp_lock':
      if (fact.level === 'info') return C.values.onCurve;
      return fact.level === 'warn' ? C.values.flagged : C.values.notFlagged;
    case 'low_liquidity':
      return fact.value == null ? null : C.values.lowLiquidity(fact.value);
    default:
      return null;
  }
}

/**
 * The cell's clean caption — the value when the check read, every fact came
 * back clean, and no fact carries a word of its own. Only the folded
 * Token-2022 check has one; every other check's own fact speaks.
 */
function cleanCaption(id: ReadRingCheckId): string | null {
  return id === 'token_extensions' ? C.values.noneFlagged : null;
}

function orderFacts(facts: readonly SafetyCatalogFact[]): SafetyCatalogFact[] {
  const rank = (fact: SafetyCatalogFact) => {
    const keyIndex = CATALOG_KEY_ORDER.indexOf(fact.key);
    return [
      SECONDARY_SOURCES.has(fact.source) ? 1 : 0,
      SEVERITY[fact.level],
      keyIndex < 0 ? CATALOG_KEY_ORDER.length : keyIndex,
    ];
  };
  return [...facts]
    .map((fact, index) => ({ fact, index, rank: rank(fact) }))
    .sort((a, b) => {
      for (let i = 0; i < a.rank.length; i += 1) {
        if (a.rank[i] !== b.rank[i]) return a.rank[i] - b.rank[i];
      }
      return a.index - b.index;
    })
    .map((entry) => entry.fact);
}

function resolveCell(
  check: ReadRingCheck,
  facts: readonly SafetyCatalogFact[],
  answered: boolean,
  trusted: boolean,
  requiredObservationMissing: boolean,
  concentrationResult?: NonNullable<
    SafetyCatalogV1['checkResults']
  >['top10_holders'],
): ReadRingCell {
  if (!answered) {
    return {
      id: check.id,
      label: check.label,
      read: check.read,
      answered: false,
      level: null,
      mark: 'not_read',
      value: C.values.notRead,
      unknown: false,
      extra: [],
    };
  }
  const mine = facts.filter((fact) => check.keys.includes(fact.key));
  const pauseStateUnreadable = mine.some(
    (fact) => fact.key === 'paused' && fact.level === 'info',
  );
  const ordered = orderFacts(mine);
  const level =
    ordered.length === 0
      ? null
      : ordered.reduce<SafetyFlagLevel>(
          (worst, fact) =>
            SEVERITY[fact.level] < SEVERITY[worst] ? fact.level : worst,
          'ok',
        );

  const flagged = level === 'danger' || level === 'warn';
  if (concentrationResult === 'not_read' && !flagged) {
    return {
      id: check.id,
      label: check.label,
      read: check.read,
      answered: false,
      level,
      mark: 'not_read',
      value: C.values.notRead,
      unknown: false,
      extra: [],
    };
  }

  const worded = ordered
    .map((fact, index) => ({
      fact,
      index,
      word: factWord(fact, trusted, pauseStateUnreadable, concentrationResult),
    }))
    .filter(
      (
        entry,
      ): entry is { fact: SafetyCatalogFact; index: number; word: string } =>
        entry.word !== null,
    );

  const headline =
    worded.find((entry) => !SECONDARY_SOURCES.has(entry.fact.source)) ?? null;
  const caption =
    headline === null && !pauseStateUnreadable ? cleanCaption(check.id) : null;
  const measuredNothing = headline === null && caption === null;
  const unknown = (measuredNothing || requiredObservationMissing) && !flagged;
  const hideHeadline = requiredObservationMissing && !flagged;
  const checkAnswered =
    concentrationResult === undefined ||
    concentrationResult === 'answered' ||
    concentrationResult === 'not_applicable';

  return {
    id: check.id,
    label: check.label,
    read: check.read,
    answered: checkAnswered,
    level,
    mark:
      level === null
        ? 'unknown'
        : flagged
          ? MARK_FOR_LEVEL[level]
          : unknown
            ? 'unknown'
            : MARK_FOR_LEVEL[level],
    value: hideHeadline
      ? C.values.unknown
      : (headline?.word ?? caption ?? C.values.unknown),
    unknown,
    extra: worded
      .filter((entry) => hideHeadline || entry !== headline)
      .map((entry) => ({
        key: `${entry.fact.key}:${entry.fact.source}:${entry.index}`,
        mark: MARK_FOR_LEVEL[entry.fact.level],
        text: entry.word,
      })),
  };
}

/* ─── The reason ──────────────────────────────────────────────────────────── */

const READ_RING_READS: readonly ReadRingRead[] = Object.freeze([
  'core',
  'enrichment',
]);

const NOT_RUN_LABEL: Readonly<Record<ReadRingRead, string>> = Object.freeze({
  core: C.onchainDidntRun,
  enrichment: C.rugCheckDidntRun,
});

const DANGER_REASON: Readonly<
  Partial<Record<SafetyCatalogFact['key'], string>>
> = Object.freeze({
  mint_authority: C.reasons.danger.mint,
  freeze_authority: C.reasons.danger.freeze,
  permanent_delegate: C.reasons.danger.delegate,
  default_frozen: C.reasons.danger.defaultFrozen,
  non_transferable: C.reasons.danger.nonTransferable,
  pausable: C.reasons.danger.pausable,
  paused: C.reasons.danger.paused,
  rugged: C.reasons.danger.rugged,
});

function resolveReason(input: {
  verdict: SafetyVerdictLevel;
  facts: readonly SafetyCatalogFact[];
  cells: readonly ReadRingCell[];
  notRun: readonly ReadRingRead[];
  unknownCells: number;
}): string {
  const { verdict, facts, cells, notRun, unknownCells } = input;
  if (verdict === 'unknown') {
    if (notRun.length === 0) return C.reasons.green(unknownCells);
    if (notRun.length === READ_RING_READS.length) return C.reasons.unread;
    return notRun.includes('enrichment')
      ? C.reasons.partialCore
      : C.reasons.partialEnrichment;
  }
  if (verdict === 'green') return C.reasons.green(unknownCells);
  if (verdict === 'amber') {
    return C.reasons.caution(
      cells.filter((cell) => cell.level === 'warn').length,
    );
  }
  const key = CATALOG_KEY_ORDER.find((candidate) =>
    facts.some((fact) => fact.key === candidate && fact.level === 'danger'),
  );
  const head = (key && DANGER_REASON[key]) ?? C.reasons.unread;
  const suffix = notRun.includes('enrichment')
    ? C.reasons.suffixRug
    : notRun.includes('core')
      ? C.reasons.suffixOnchain
      : null;
  return suffix === null ? head : `${head} ${suffix}`;
}

/* ─── The view ────────────────────────────────────────────────────────────── */

export function resolveReadRing(
  safety: SafetyVerdict | null | undefined,
): ReadRingView | null {
  const v2 = safety?.v2;
  const catalog = v2?.catalog;
  if (safety == null || v2 == null || catalog == null) return null;

  const coreOk = v2.checks.core.status === 'ok';
  const enrichmentOk = v2.checks.enrichment.status === 'ok';
  const concentrationResult = catalog.checkResults?.top10_holders;
  const sourceCoverage =
    (coreOk ? READ_RING_CORE_CHECKS : 0) +
    (enrichmentOk ? READ_RING_ENRICHMENT_CHECKS : 0);
  const coverage =
    sourceCoverage -
    (enrichmentOk &&
    (concentrationResult === 'incomplete' || concentrationResult === 'not_read')
      ? 1
      : 0);

  const answered: Readonly<Record<ReadRingRead, boolean>> = {
    core: coreOk,
    enrichment: enrichmentOk,
  };
  const fullReadUnknown = v2.verdict === 'unknown' && coreOk && enrichmentOk;
  const liquidityMissing =
    catalog.requiredObservationsMissing?.includes('liquidity') === true ||
    /** Compatibility: older payloads carried neither per-check receipt. */
    (fullReadUnknown && concentrationResult === undefined);
  const cells = READ_RING_CHECKS.map((check) =>
    resolveCell(
      check,
      catalog.facts,
      answered[check.read],
      v2.trusted,
      (liquidityMissing && check.id === 'liquidity_pool') ||
        (check.id === 'top10_holders' &&
          concentrationResult === undefined &&
          catalog.requiredObservationsMissing?.includes('top1_holder') ===
            true),
      check.id === 'top10_holders' ? concentrationResult : undefined,
    ),
  );
  const notRun = READ_RING_READS.filter((read) => !answered[read]);
  const unknownCells = cells.filter((cell) => cell.unknown).length;
  const flaggedCells = cells.filter(
    (cell) => cell.level === 'warn' || cell.level === 'danger',
  ).length;

  return {
    verdict: v2.verdict,
    coverage,
    coverageLine: C.coverage(coverage),
    coverageShort: C.coverageShort(coverage),
    cells,
    notRun,
    notRunRows: notRun.map((read) => ({
      key: read,
      label: NOT_RUN_LABEL[read],
      value: C.notReadCount(
        READ_RING_CHECKS.filter((check) => check.read === read).length,
      ),
    })),
    caption: notRun.length === 0 ? null : C.nothingCountedAsFine,
    reason: resolveReason({
      verdict: v2.verdict,
      facts: catalog.facts,
      cells,
      notRun,
      unknownCells,
    }),
    unknownCells,
    flaggedCells,
    stamp: resolveReadRingStamp(safety),
    accessibilityLabel: C.ringA11y(coverage, flaggedCells),
  };
}

export function resolveReadRingStamp(
  safety: SafetyVerdict | null | undefined,
): ReadRingStamp | null {
  const checks = safety?.v2?.checks;
  if (checks == null) return null;
  if (checks.core.status !== 'ok' || checks.enrichment.status !== 'ok') {
    return null;
  }
  const coreAsOf = checks.core.asOf;
  const enrichmentAsOf = checks.enrichment.asOf;
  if (coreAsOf == null || enrichmentAsOf == null) return null;
  const coreMs = Date.parse(coreAsOf);
  const enrichmentMs = Date.parse(enrichmentAsOf);
  const older =
    Number.isFinite(coreMs) && Number.isFinite(enrichmentMs)
      ? coreMs <= enrichmentMs
        ? coreAsOf
        : enrichmentAsOf
      : coreAsOf;
  return { coreAsOf, enrichmentAsOf, asOf: older };
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function formatReadStamp(
  stamp: ReadRingStamp | null,
  nowMs: number,
): string | null {
  if (stamp === null) return null;
  const ms = Date.parse(stamp.asOf);
  if (!Number.isFinite(ms)) return null;
  const delta = Math.max(0, nowMs - ms);
  if (delta < MINUTE_MS) return copy.activity.justNow;
  if (delta < HOUR_MS) {
    return copy.activity.minutesAgo(Math.floor(delta / MINUTE_MS));
  }
  if (delta < DAY_MS)
    return copy.activity.hoursAgo(Math.floor(delta / HOUR_MS));
  const days = Math.floor(delta / DAY_MS);
  if (days === 1) return copy.activity.yesterday;
  if (days < 7) return copy.activity.daysAgo(days);
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/* ─── Discover's facts line ───────────────────────────────────────────────── */

const DISCOVER_SHORT: Readonly<
  Partial<Record<SafetyCatalogFact['key'], string>>
> = Object.freeze({
  mint_authority: C.discoverShort.mint,
  freeze_authority: C.discoverShort.freeze,
  permanent_delegate: C.discoverShort.delegate,
  default_frozen: C.discoverShort.startsFrozen,
  transfer_hook: C.discoverShort.hook,
  transfer_fee: C.discoverShort.fee,
  non_transferable: C.discoverShort.nonTransferable,
  pausable: C.discoverShort.pausable,
  paused: C.discoverShort.paused,
  rugged: C.discoverShort.rugged,
  top10_concentration: C.discoverShort.top10,
  dev_share: C.discoverShort.dev,
  sniper_share: C.discoverShort.snipers,
  insider_cluster: C.discoverShort.insiders,
  bundler_share: C.discoverShort.bundles,
  lp_lock: C.discoverShort.lp,
  low_liquidity: C.discoverShort.lowLiquidity,
});

function roundPct(value: string): string {
  const match = /^(\d+(?:\.\d+)?)%$/.exec(value.trim());
  if (match === null) return value;
  return `${Math.round(Number(match[1]))}%`;
}

function discoverFactText(fact: SafetyCatalogFact): string | null {
  const short =
    fact.key === 'top10_concentration' && fact.source === 'birdeye_security'
      ? C.discoverShort.topHolder
      : DISCOVER_SHORT[fact.key];
  if (short == null) return null;
  switch (fact.key) {
    case 'mint_authority':
    case 'freeze_authority':
      return `${short} ${C.values.active.toLowerCase()}`;
    case 'permanent_delegate':
    case 'default_frozen':
    case 'transfer_hook':
    case 'non_transferable':
    case 'pausable':
    case 'paused':
    case 'rugged':
      return short;
    case 'lp_lock':
      return `${short} ${C.values.flagged.toLowerCase()}`;
    case 'transfer_fee':
      return fact.value == null ? short : `${short} ${roundPct(fact.value)}`;
    case 'low_liquidity':
      return fact.value == null ? short : `${short} ${fact.value}`;
    default:
      return fact.value == null ? short : `${short} ${roundPct(fact.value)}`;
  }
}

export function resolveDiscoverFactsLine(
  safety: SafetyVerdict | null | undefined,
): string | null {
  const view = resolveReadRing(safety);
  const catalog = safety?.v2?.catalog;
  if (view === null || catalog == null) return null;

  const parts: string[] = [];
  if (view.notRun.length === READ_RING_READS.length) {
    parts.push(C.checksDidntRun);
  } else if (view.notRun.length === 1) {
    parts.push(NOT_RUN_LABEL[view.notRun[0]]);
  }

  const flagged = catalog.facts
    .filter((fact) => fact.level === 'warn' || fact.level === 'danger')
    .map((fact, index) => ({ fact, index }))
    .sort((a, b) => {
      const bySeverity = SEVERITY[a.fact.level] - SEVERITY[b.fact.level];
      if (bySeverity !== 0) return bySeverity;
      const byKey =
        CATALOG_KEY_ORDER.indexOf(a.fact.key) -
        CATALOG_KEY_ORDER.indexOf(b.fact.key);
      return byKey !== 0 ? byKey : a.index - b.index;
    });
  for (const { fact } of flagged) {
    const text = discoverFactText(fact);
    if (text !== null) parts.push(text);
  }

  if (flagged.length === 0 && !view.notRun.includes('enrichment')) {
    const top10 = catalog.facts.find(
      (fact) =>
        fact.key === 'top10_concentration' && fact.source === 'solana_tracker',
    );
    const dev = catalog.facts.find((fact) => fact.key === 'dev_share');
    if (top10?.value != null) {
      parts.push(`${C.discoverShort.top10} ${top10.value}`);
    }
    if (dev?.value != null) {
      parts.push(`${C.discoverShort.dev} ${dev.value}`);
    }
    if (catalog.lifecycle === 'curve') {
      parts.push(`${C.discoverShort.lp} ${C.values.onCurve.toLowerCase()}`);
    }
  }

  return parts.length === 0 ? null : parts.join(' · ');
}

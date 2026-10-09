/**
 * Fail-closed parse of the server's vitals answer. A payload that does not
 * match the contract exactly is `null` — the prose answer then stands alone
 * and no card mounts. Nothing here invents a default for a missing field.
 *
 * MODERATION: the card and the "which one did you mean?" rows print a name and
 * a symbol a stranger typed into a launchpad, and the thread reads the symbol
 * back in prose. The server already refuses to compose a condemned pair
 * (`vitals/service.ts`); a label that arrives condemned anyway — an older
 * server, a newer list — is a contract violation like any other here, and the
 * payload is null. The list is the same bytes as the server's
 * (`features/discovery/moderation.ts`).
 */
import { isModeratedTokenLabel } from '@/src/features/discovery/moderation';
import { isValidPriceMint } from '@/src/features/balances/priceSnapshot';
import {
  VITAL_KEYS,
  isTimeframeId,
  type Candle,
  type HolderTag,
  type SafetyFlagKey,
  type SafetyFlagKeyV2,
  type SafetyFlagLevel,
  type SafetyFlagSourceLabelV2,
  type SafetyFlagV2,
  type SafetyCheckRead,
  type SafetyCheckStatus,
  type SafetySource,
  type SafetySourceV2,
  type SafetyVerdict,
  type SafetyVerdictLevel,
  type SafetyVerdictV2,
  type SafetyVerdictV3,
  type SafetyCatalogFact,
  type SafetyCatalogV1,
  type VitalKey,
  type VitalsAnswer,
  type VitalsDisambiguation,
  type VitalsDisambiguationChoice,
  type VitalsHolders,
  type VitalsMarket,
  type VitalsPayload,
  type VitalsPrice,
  type VitalsTradeLeadIn,
} from './types';

const LEGACY_FLAG_KEYS = new Set<SafetyFlagKey>([
  'mint_authority',
  'freeze_authority',
  'lp_lock',
  'top10_concentration',
  'transfer_fee',
  'mutable_metadata',
  'rugged',
  'insider_network',
  'low_liquidity',
  'sniper_share',
  'bundler_share',
  'insider_cluster',
]);
const V2_FLAG_KEYS = new Set<SafetyFlagKeyV2>([
  ...LEGACY_FLAG_KEYS,
  'permanent_delegate',
  'transfer_hook',
  'default_frozen',
  'dev_share',
  'rug_check_unavailable',
  'non_transferable',
  'pausable',
  'paused',
]);
const V3_FLAG_ADDITION_KEYS = new Set<SafetyFlagKeyV2>([
  'non_transferable',
  'pausable',
  'paused',
]);
const FLAG_LEVELS = new Set<SafetyFlagLevel>(['danger', 'warn', 'info', 'ok']);
const FLAG_LEVEL_RANK: Readonly<Record<SafetyFlagLevel, number>> = {
  danger: 3,
  warn: 2,
  info: 1,
  ok: 0,
};
const LEGACY_SOURCES = new Set<SafetySource>([
  'rugcheck',
  'birdeye_security',
  'onchain_rpc',
  'onchain_intel',
]);
const V2_SOURCES = new Set<SafetySourceV2>([
  ...LEGACY_SOURCES,
  'solana_tracker',
]);
const VERDICTS = new Set<SafetyVerdictLevel>([
  'green',
  'amber',
  'red',
  'unknown',
]);
const HOLDER_TAGS = new Set<HolderTag>(['bundler', 'sniper', 'insider', 'dev']);
/** Every server receipt at once (11) plus the three intel receipts, with headroom. */
const MAX_FLAGS = 16;
const MAX_V2_FLAGS = 24;
const MAX_CANDLES = 512;
const MAX_CHOICES = 5;
const MAX_LABEL = 240;
const MAX_CATALOG_FACTS = 24;
const MAX_CATALOG_VALUE = 24;

const CATALOG_KEYS = new Set<SafetyCatalogFact['key']>([
  'mint_authority',
  'freeze_authority',
  'permanent_delegate',
  'default_frozen',
  'transfer_hook',
  'transfer_fee',
  'non_transferable',
  'pausable',
  'paused',
  'rugged',
  'top10_concentration',
  'dev_share',
  'sniper_share',
  'insider_cluster',
  'bundler_share',
  'lp_lock',
  'low_liquidity',
]);
const CATALOG_SOURCES = new Set<SafetyCatalogFact['source']>([
  'onchain_rpc',
  'solana_tracker',
  'birdeye_security',
  'onchain_intel',
]);
const CATALOG_EXTENSION_IDS = new Set<
  SafetyCatalogV1['checkedExtensions'][number]
>([
  'permanent_delegate',
  'default_frozen',
  'transfer_hook',
  'transfer_fee',
  'non_transferable',
  'pausable',
]);
const CATALOG_REQUIRED_OBSERVATIONS = new Set<
  NonNullable<SafetyCatalogV1['requiredObservationsMissing']>[number]
>(['top1_holder', 'liquidity']);
const CONCENTRATION_CHECK_RESULTS = new Set<
  NonNullable<SafetyCatalogV1['checkResults']>['top10_holders']
>(['answered', 'incomplete', 'not_applicable', 'not_read']);

type Rec = Record<string, unknown>;

function rec(value: unknown): Rec | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Rec)
    : null;
}

function nullableNumber(value: unknown): number | null | undefined {
  if (value === null) return null;
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function isoDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 40) return undefined;
  return Number.isFinite(Date.parse(value)) ? value : undefined;
}

function shortString(value: unknown, max = MAX_LABEL): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= max
    ? value
    : undefined;
}

function isMint(value: unknown): value is string {
  return typeof value === 'string' && isValidPriceMint(value, 'mainnet-beta');
}

const UNRECOGNISED = 'unrecognised' as const;
const MAX_SOURCE_LABEL = 80;

/**
 * Shape-checked, vocabulary-tolerant. `null` only when the field is not a
 * usable string at all; an unknown provider name maps to `unrecognised`.
 */
function parseFlagSource(
  value: unknown,
  sources: ReadonlySet<SafetySourceV2>,
): SafetyFlagSourceLabelV2 | null {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_SOURCE_LABEL
  )
    return null;
  const parts = value.split('+');
  return parts.length <= 2 &&
    parts.every((part) => sources.has(part as SafetySourceV2))
    ? (value as SafetyFlagSourceLabelV2)
    : UNRECOGNISED;
}

/** One wire entry of a vocabulary, mapped onto `unrecognised` when unknown. */
function tolerantSource(
  value: unknown,
  sources: ReadonlySet<SafetySourceV2>,
): SafetySourceV2 | null {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_SOURCE_LABEL
  )
    return null;
  return sources.has(value as SafetySourceV2)
    ? (value as SafetySourceV2)
    : UNRECOGNISED;
}

/**
 * The wire `sources` list, shape-checked and vocabulary-tolerant. `null` for a
 * non-array or an entry that is not a usable string. Repeated `unrecognised`
 * entries collapse to one, so the reader's line does not stutter; entries the
 * build knows keep the server's order and multiplicity exactly.
 */
function parseSources(
  raw: unknown,
  sources: ReadonlySet<SafetySourceV2>,
): SafetySourceV2[] | null {
  if (!Array.isArray(raw)) return null;
  const parsed: SafetySourceV2[] = [];
  for (const entry of raw) {
    const source = tolerantSource(entry, sources);
    if (!source) return null;
    if (source === UNRECOGNISED && parsed.includes(UNRECOGNISED)) continue;
    parsed.push(source);
  }
  return parsed;
}

/** A verdict word the build does not know asserts nothing, so: `unknown`. */
function tolerantVerdict(value: unknown): SafetyVerdictLevel | null {
  if (typeof value !== 'string' || value.length > MAX_SOURCE_LABEL) return null;
  return VERDICTS.has(value as SafetyVerdictLevel)
    ? (value as SafetyVerdictLevel)
    : 'unknown';
}

function parseFlag(
  raw: unknown,
  keys: ReadonlySet<SafetyFlagKeyV2>,
  sources: ReadonlySet<SafetySourceV2>,
): SafetyFlagV2 | null {
  const flag = rec(raw);
  if (!flag) return null;
  const label = shortString(flag.label);
  const source = parseFlagSource(flag.source, sources);
  if (
    typeof flag.key !== 'string' ||
    flag.key.length === 0 ||
    typeof flag.level !== 'string' ||
    !label ||
    !source
  )
    return null;
  const value =
    flag.value === undefined ? undefined : shortString(flag.value, 80);
  if (flag.value !== undefined && value === undefined) return null;
  return {
    key: keys.has(flag.key as SafetyFlagKeyV2)
      ? (flag.key as SafetyFlagKeyV2)
      : UNRECOGNISED,
    level: FLAG_LEVELS.has(flag.level as SafetyFlagLevel)
      ? (flag.level as SafetyFlagLevel)
      : 'warn',
    label,
    ...(value ? { value } : {}),
    source,
  };
}

function parseCheckRead(raw: unknown): SafetyCheckRead | null {
  const read = rec(raw);
  if (!read) return null;
  const statuses = new Set<SafetyCheckStatus>(['ok', 'failed', 'not_wired']);
  if (
    typeof read.status !== 'string' ||
    !statuses.has(read.status as SafetyCheckStatus)
  ) {
    return null;
  }
  const asOf = read.asOf === null ? null : isoDate(read.asOf);
  if (asOf === undefined || (read.status === 'ok' && asOf === null))
    return null;
  return { status: read.status as SafetyCheckStatus, asOf };
}

function parseSafetyCatalog(
  raw: unknown,
  verdict: SafetyVerdictLevel,
  checks: SafetyVerdictV2['checks'],
): SafetyCatalogV1 | undefined {
  const catalog = rec(raw);
  if (
    catalog?.v !== 1 ||
    !Array.isArray(catalog.facts) ||
    catalog.facts.length > MAX_CATALOG_FACTS
  )
    return undefined;
  if (
    catalog.lifecycle !== null &&
    catalog.lifecycle !== 'curve' &&
    catalog.lifecycle !== 'graduated'
  )
    return undefined;
  if (!Array.isArray(catalog.checkedExtensions)) return undefined;
  const checkedExtensions = catalog.checkedExtensions.filter(
    (value): value is SafetyCatalogV1['checkedExtensions'][number] =>
      typeof value === 'string' &&
      CATALOG_EXTENSION_IDS.has(
        value as SafetyCatalogV1['checkedExtensions'][number],
      ),
  );
  if (
    catalog.requiredObservationsMissing !== undefined &&
    !Array.isArray(catalog.requiredObservationsMissing)
  )
    return undefined;
  const requiredObservationsMissing = (
    catalog.requiredObservationsMissing ?? []
  ).filter(
    (
      value,
    ): value is NonNullable<
      SafetyCatalogV1['requiredObservationsMissing']
    >[number] =>
      typeof value === 'string' &&
      CATALOG_REQUIRED_OBSERVATIONS.has(
        value as NonNullable<
          SafetyCatalogV1['requiredObservationsMissing']
        >[number],
      ),
  );
  const rawCheckResults =
    catalog.checkResults === undefined ? undefined : rec(catalog.checkResults);
  if (catalog.checkResults !== undefined && rawCheckResults == null) {
    return undefined;
  }
  const top10HoldersResult = rawCheckResults?.top10_holders;
  if (
    top10HoldersResult !== undefined &&
    (typeof top10HoldersResult !== 'string' ||
      !CONCENTRATION_CHECK_RESULTS.has(
        top10HoldersResult as NonNullable<
          SafetyCatalogV1['checkResults']
        >['top10_holders'],
      ))
  ) {
    return undefined;
  }
  const facts: SafetyCatalogFact[] = [];
  for (const rawFact of catalog.facts) {
    const fact = rec(rawFact);
    if (!fact) continue;
    if (
      fact.value !== null &&
      (typeof fact.value !== 'string' || fact.value.length > MAX_CATALOG_VALUE)
    )
      return undefined;
    if (
      typeof fact.key !== 'string' ||
      !CATALOG_KEYS.has(fact.key as SafetyCatalogFact['key'])
    )
      continue;
    if (
      typeof fact.source !== 'string' ||
      !CATALOG_SOURCES.has(fact.source as SafetyCatalogFact['source'])
    )
      continue;
    const level: SafetyFlagLevel =
      fact.level === 'danger' ||
      fact.level === 'warn' ||
      fact.level === 'info' ||
      fact.level === 'ok'
        ? fact.level
        : 'warn';
    facts.push({
      key: fact.key as SafetyCatalogFact['key'],
      level,
      value: fact.value,
      source: fact.source as SafetyCatalogFact['source'],
    });
  }
  const sourceCoverage =
    (checks.core.status === 'ok' ? 3 : 0) +
    (checks.enrichment.status === 'ok' ? 5 : 0);
  const coverage =
    sourceCoverage -
    (checks.enrichment.status === 'ok' &&
    (top10HoldersResult === 'incomplete' || top10HoldersResult === 'not_read')
      ? 1
      : 0);
  const hasWarn = facts.some((fact) => fact.level === 'warn');
  const hasDanger = facts.some((fact) => fact.level === 'danger');
  const consistent =
    verdict === 'green'
      ? coverage === 8 &&
        !hasWarn &&
        !hasDanger &&
        requiredObservationsMissing.length === 0
      : verdict === 'amber'
        ? hasWarn && !hasDanger
        : verdict === 'red'
          ? hasDanger
          : coverage < 8 || (!hasWarn && !hasDanger);
  return consistent
    ? {
        v: 1,
        lifecycle: catalog.lifecycle,
        checkedExtensions,
        ...(top10HoldersResult === undefined
          ? {}
          : {
              checkResults: {
                top10_holders: top10HoldersResult as NonNullable<
                  SafetyCatalogV1['checkResults']
                >['top10_holders'],
              },
            }),
        ...(requiredObservationsMissing.length > 0
          ? { requiredObservationsMissing }
          : {}),
        facts,
      }
    : undefined;
}

function parseSafetyVerdictV2(raw: unknown): SafetyVerdictV2 | null {
  const safety = rec(raw);
  if (!safety) return null;
  const verdict = tolerantVerdict(safety.verdict);
  const sources = parseSources(safety.sources, V2_SOURCES);
  if (
    !verdict ||
    !sources ||
    !Array.isArray(safety.flags) ||
    safety.flags.length > MAX_V2_FLAGS ||
    typeof safety.trusted !== 'boolean'
  ) {
    return null;
  }
  const flags: SafetyFlagV2[] = [];
  for (const rawFlag of safety.flags) {
    const flag = parseFlag(rawFlag, V2_FLAG_KEYS, V2_SOURCES);
    if (!flag) return null;
    flags.push(flag);
  }
  const checks = rec(safety.checks);
  const core = parseCheckRead(checks?.core);
  const enrichment = parseCheckRead(checks?.enrichment);
  if (!core || !enrichment) return null;
  const parsedChecks = { core, enrichment };
  if (
    verdict === 'green' &&
    (core.status !== 'ok' || enrichment.status !== 'ok')
  ) {
    return null;
  }
  const catalog =
    safety.catalog === undefined
      ? undefined
      : parseSafetyCatalog(safety.catalog, verdict, parsedChecks);
  return {
    verdict,
    flags,
    sources,
    checks: parsedChecks,
    trusted: safety.trusted,
    ...(catalog ? { catalog } : {}),
  };
}

function parseSafetyVerdictV3(raw: unknown): SafetyVerdictV3 | null {
  const safety = rec(raw);
  if (
    !safety ||
    !Array.isArray(safety.flagAdditions) ||
    safety.flagAdditions.length > MAX_V2_FLAGS
  ) {
    return null;
  }
  const flagAdditions: SafetyFlagV2[] = [];
  for (const rawFlag of safety.flagAdditions) {
    const rawFlagRecord = rec(rawFlag);
    if (!rawFlagRecord || typeof rawFlagRecord.key !== 'string') return null;
    const key = rawFlagRecord.key as SafetyFlagKeyV2;
    if (!V3_FLAG_ADDITION_KEYS.has(key) && V2_FLAG_KEYS.has(key)) {
      continue;
    }
    const flag = parseFlag(rawFlag, V3_FLAG_ADDITION_KEYS, V2_SOURCES);
    if (!flag) return null;
    flagAdditions.push(flag);
  }
  return { flagAdditions };
}

export function parseSafetyVerdict(raw: unknown): SafetyVerdict | null {
  const safety = rec(raw);
  if (!safety) return null;
  const verdict = tolerantVerdict(safety.verdict);
  if (!verdict) return null;
  const score = nullableNumber(safety.scoreNormalised);
  if (score === undefined || (score !== null && (score < 0 || score > 100)))
    return null;
  if (!Array.isArray(safety.flags) || safety.flags.length > MAX_FLAGS)
    return null;
  const flags: SafetyFlagV2[] = [];
  for (const rawFlag of safety.flags) {
    const flag = parseFlag(rawFlag, LEGACY_FLAG_KEYS, LEGACY_SOURCES);
    if (!flag) return null;
    flags.push(flag);
  }
  if (typeof safety.reconciled !== 'boolean') return null;
  const sources = parseSources(safety.sources, LEGACY_SOURCES);
  if (!sources) return null;
  const asOf = isoDate(safety.asOf);
  if (!asOf) return null;
  const hasSafetySource =
    sources.includes('rugcheck') || sources.includes('birdeye_security');
  if (verdict === 'green' && !hasSafetySource) return null;
  const frozenV2 =
    safety.v2 === undefined ? undefined : parseSafetyVerdictV2(safety.v2);
  if (safety.v2 !== undefined && !frozenV2) return null;
  const current =
    safety.v3 === undefined ? undefined : parseSafetyVerdictV3(safety.v3);
  if (safety.v3 !== undefined && (!current || !frozenV2)) return null;
  if (
    current &&
    frozenV2 &&
    current.flagAdditions.length + frozenV2.flags.length > MAX_V2_FLAGS
  ) {
    return null;
  }
  const v2 =
    current && frozenV2
      ? {
          ...frozenV2,
          flags: [...frozenV2.flags, ...current.flagAdditions].sort(
            (a, b) =>
              FLAG_LEVEL_RANK[b.level] - FLAG_LEVEL_RANK[a.level] ||
              a.key.localeCompare(b.key),
          ),
        }
      : frozenV2;
  return {
    verdict: v2?.verdict ?? verdict,
    scoreNormalised: score,
    flags: v2?.flags ?? flags,
    reconciled: safety.reconciled,
    sources: v2?.sources ?? sources,
    asOf,
    ...(v2 ? { v2 } : {}),
  };
}

function parsePrice(raw: unknown): VitalsPrice | null | undefined {
  if (raw === null) return null;
  const price = rec(raw);
  if (!price) return undefined;
  const usd = finite(price.usd);
  const asOf = isoDate(price.asOf);
  const changePctFrame = nullableNumber(price.changePctFrame);
  const changePct24h = nullableNumber(price.changePct24h);
  const marketCapUsd = nullableNumber(price.marketCapUsd);
  const fdvUsd = nullableNumber(price.fdvUsd);
  if (
    usd === undefined ||
    usd <= 0 ||
    !asOf ||
    price.source !== 'jupiter' ||
    changePctFrame === undefined ||
    changePct24h === undefined ||
    marketCapUsd === undefined ||
    fdvUsd === undefined
  )
    return undefined;
  return {
    usd,
    changePctFrame,
    changePct24h,
    marketCapUsd,
    fdvUsd,
    asOf,
    source: 'jupiter',
  };
}

function parseMarket(raw: unknown): VitalsMarket | null | undefined {
  if (raw === null) return null;
  const market = rec(raw);
  if (!market) return undefined;
  const liquidityUsd = nullableNumber(market.liquidityUsd);
  const volume24hUsd = nullableNumber(market.volume24hUsd);
  const buySellRatio24h = nullableNumber(market.buySellRatio24h);
  const marketCapUsd = stampedFigure(market, 'marketCapUsd');
  const fdvUsd = stampedFigure(market, 'fdvUsd');
  const asOf = isoDate(market.asOf);
  if (
    liquidityUsd === undefined ||
    volume24hUsd === undefined ||
    buySellRatio24h === undefined ||
    !asOf ||
    (market.source !== 'birdeye' && market.source !== 'geckoterminal') ||
    (market.cached !== undefined && market.cached !== true)
  )
    return undefined;
  return {
    liquidityUsd,
    volume24hUsd,
    buySellRatio24h,
    ...(marketCapUsd !== undefined ? { marketCapUsd } : {}),
    ...(fdvUsd !== undefined ? { fdvUsd } : {}),
    source: market.source,
    asOf,
    ...(market.cached === true ? { cached: true as const } : {}),
  };
}

function stampedFigure(record: Rec, key: string): number | null | undefined {
  if (!Object.hasOwn(record, key)) return undefined;
  return nullableNumber(record[key]);
}

function parseHolders(raw: unknown): VitalsHolders | null | undefined {
  if (raw === null) return null;
  const holders = rec(raw);
  if (!holders) return undefined;
  const count = nullableNumber(holders.count);
  const top10Pct = nullableNumber(holders.top10Pct);
  const top1Pct = nullableNumber(holders.top1Pct);
  const asOf = isoDate(holders.asOf);
  if (
    count === undefined ||
    top10Pct === undefined ||
    top1Pct === undefined ||
    !asOf ||
    holders.source !== 'birdeye' ||
    (holders.cached !== undefined && holders.cached !== true)
  )
    return undefined;
  let behaviorTags: HolderTag[] | undefined;
  if (holders.behaviorTags !== undefined) {
    if (
      !Array.isArray(holders.behaviorTags) ||
      !holders.behaviorTags.every((t) => HOLDER_TAGS.has(t as HolderTag))
    ) {
      return undefined;
    }
    behaviorTags = holders.behaviorTags as HolderTag[];
  }
  return {
    count,
    top10Pct,
    top1Pct,
    ...(behaviorTags ? { behaviorTags } : {}),
    source: 'birdeye',
    asOf,
    ...(holders.cached === true ? { cached: true as const } : {}),
  };
}

export function parseCandles(raw: unknown): Candle[] | undefined {
  if (!Array.isArray(raw) || raw.length > MAX_CANDLES) return undefined;
  const candles: Candle[] = [];
  let prior = -1;
  for (const item of raw) {
    const candle = rec(item);
    if (!candle) return undefined;
    const t = finite(candle.t);
    const o = finite(candle.o);
    const h = finite(candle.h);
    const l = finite(candle.l);
    const c = finite(candle.c);
    const v = finite(candle.v);
    if (
      t === undefined ||
      o === undefined ||
      h === undefined ||
      l === undefined ||
      c === undefined ||
      v === undefined ||
      t <= prior ||
      o <= 0 ||
      l <= 0 ||
      h < l ||
      h < o ||
      h < c ||
      l > o ||
      l > c ||
      v < 0
    )
      return undefined;
    candles.push({ t, o, h, l, c, v });
    prior = t;
  }
  return candles;
}

function parseTradeLeadIn(raw: unknown): VitalsTradeLeadIn | undefined {
  const lead = rec(raw);
  const swap = rec(lead?.swap);
  if (!lead || !swap) return undefined;
  if (
    !shortString(swap.fromSymbol, 16) ||
    !shortString(swap.toSymbol, 16) ||
    !isMint(swap.toMint) ||
    typeof swap.toDecimals !== 'number' ||
    !Number.isInteger(swap.toDecimals) ||
    swap.toDecimals < 0 ||
    swap.toDecimals > 18 ||
    typeof swap.inAmountAtomic !== 'string' ||
    !/^[1-9]\d*$/.test(swap.inAmountAtomic) ||
    (swap.amountGuard !== undefined && swap.amountGuard !== 'sol-reserve')
  )
    return undefined;
  return {
    swap: {
      fromSymbol: swap.fromSymbol as string,
      toSymbol: swap.toSymbol as string,
      toMint: swap.toMint,
      toDecimals: swap.toDecimals,
      inAmountAtomic: swap.inAmountAtomic,
      ...(swap.amountGuard
        ? {
            amountGuard:
              swap.amountGuard as VitalsTradeLeadIn['swap']['amountGuard'],
          }
        : {}),
    },
  };
}

export function parseVitalsPayload(raw: unknown): VitalsPayload | null {
  const body = rec(raw);
  if (!body || body.render !== 'token_vitals' || body.schemaVersion !== 1)
    return null;

  const token = rec(body.token);
  const symbol = shortString(token?.symbol, 32);
  const name = shortString(token?.name, 64);
  const ageMinutes = nullableNumber(token?.ageMinutes);
  if (
    !token ||
    !isMint(token.mint) ||
    !symbol ||
    !name ||
    typeof token.isVerified !== 'boolean' ||
    ageMinutes === undefined ||
    (ageMinutes !== null && ageMinutes < 0) ||
    (token.iconUrl !== undefined &&
      !/^https:\/\/\S{1,512}$/.test(String(token.iconUrl))) ||
    isModeratedTokenLabel({ name, symbol })
  )
    return null;

  if (!isTimeframeId(body.timeframe)) return null;
  if (
    !Array.isArray(body.allowedTimeframes) ||
    body.allowedTimeframes.length === 0 ||
    !body.allowedTimeframes.every(isTimeframeId)
  )
    return null;
  let emphasize: VitalKey[] | undefined;
  if (body.emphasize !== undefined) {
    if (
      !Array.isArray(body.emphasize) ||
      !body.emphasize.every((k) =>
        (VITAL_KEYS as readonly string[]).includes(k as string),
      )
    )
      return null;
    emphasize = body.emphasize as VitalKey[];
  }

  const price = parsePrice(body.price);
  const market = parseMarket(body.market);
  const holders = parseHolders(body.holders);
  const safety = parseSafetyVerdict(body.safety);
  if (
    price === undefined ||
    market === undefined ||
    holders === undefined ||
    !safety
  )
    return null;

  const chart = rec(body.chart);
  if (
    !chart ||
    chart.kind !== 'candlestick' ||
    chart.mint !== token.mint ||
    !isTimeframeId(chart.timeframe) ||
    (chart.source !== 'birdeye' && chart.source !== 'geckoterminal')
  )
    return null;
  let seedCandles: Candle[] | undefined;
  if (chart.seedCandles !== undefined) {
    seedCandles = parseCandles(chart.seedCandles);
    if (!seedCandles) return null;
  }

  let tradeLeadIn: VitalsTradeLeadIn | undefined;
  if (body.tradeLeadIn !== undefined) {
    tradeLeadIn = parseTradeLeadIn(body.tradeLeadIn);
    if (!tradeLeadIn || tradeLeadIn.swap.toMint !== token.mint) return null;
  }

  const disclosures = rec(body.disclosures);
  const sourcesLabel = shortString(disclosures?.sourcesLabel, 120);
  const lossNudge = shortString(disclosures?.lossNudge, 400);
  if (
    !disclosures ||
    disclosures.isInformationNotAdvice !== true ||
    !sourcesLabel ||
    !lossNudge
  )
    return null;

  return {
    render: 'token_vitals',
    schemaVersion: 1,
    token: {
      mint: token.mint,
      symbol,
      name,
      ...(token.iconUrl !== undefined
        ? { iconUrl: String(token.iconUrl) }
        : {}),
      isVerified: token.isVerified,
      ageMinutes,
    },
    timeframe: body.timeframe,
    allowedTimeframes:
      body.allowedTimeframes as VitalsPayload['allowedTimeframes'],
    ...(emphasize ? { emphasize } : {}),
    price,
    market,
    holders,
    safety,
    chart: {
      kind: 'candlestick',
      mint: token.mint,
      timeframe: chart.timeframe,
      ...(seedCandles ? { seedCandles } : {}),
      source: chart.source,
    },
    ...(tradeLeadIn ? { tradeLeadIn } : {}),
    disclosures: { isInformationNotAdvice: true, sourcesLabel, lossNudge },
  };
}

export function parseVitalsDisambiguation(
  raw: unknown,
): VitalsDisambiguation | null {
  const body = rec(raw);
  if (
    !body ||
    body.render !== 'token_vitals_disambiguate' ||
    body.schemaVersion !== 1
  )
    return null;
  const query = shortString(body.query, 32);
  if (
    !query ||
    // The query is printed back in the card's own sentence, so it is judged
    // exactly like a label.
    isModeratedTokenLabel({ symbol: query }) ||
    !Array.isArray(body.choices) ||
    body.choices.length === 0 ||
    body.choices.length > MAX_CHOICES
  )
    return null;
  const choices: VitalsDisambiguationChoice[] = [];
  const seen = new Set<string>();
  for (const raw of body.choices) {
    const choice = rec(raw);
    const symbol = shortString(choice?.symbol, 32);
    const liquidityUsd = nullableNumber(choice?.liquidityUsd);
    if (
      !choice ||
      !isMint(choice.mint) ||
      seen.has(choice.mint) ||
      !symbol ||
      !(choice.name === null || shortString(choice.name, 64)) ||
      isModeratedTokenLabel({
        name: choice.name as string | null,
        symbol,
      }) ||
      !(choice.isVerified === null || typeof choice.isVerified === 'boolean') ||
      liquidityUsd === undefined ||
      (liquidityUsd !== null && liquidityUsd < 0)
    )
      return null;
    seen.add(choice.mint);
    choices.push({
      mint: choice.mint,
      symbol,
      name: choice.name as string | null,
      isVerified: choice.isVerified as boolean | null,
      liquidityUsd,
    });
  }
  return {
    render: 'token_vitals_disambiguate',
    schemaVersion: 1,
    query,
    choices,
  };
}

/** Either answer shape, or null. Used by `askClient.parseAnswer`. */
export function parseVitalsAnswer(raw: unknown): VitalsAnswer | null {
  return parseVitalsPayload(raw) ?? parseVitalsDisambiguation(raw);
}

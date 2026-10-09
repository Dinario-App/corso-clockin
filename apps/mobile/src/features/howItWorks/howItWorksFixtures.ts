import { copy } from '@/constants/copy';
import { feeBpsToPercentLabel } from '@/src/features/swap/tokens';
import { howItWorksCopy } from '@/constants/copy/howItWorks';
import { BYO_AI_FLAGS_OFF } from '@/src/features/aiConnect/flags';
import {
  resolveModelMenu,
  type ModelMenuPresentation,
} from '@/src/features/aiConnect/ui/modelMenuPresentation';
import type { InputUnit } from '@/src/features/bots/botPresentation';
import type { BotView } from '@/src/features/bots/types';
import type { HomeAssemblyChart } from '@/src/features/home/homeAssembly';
import type { PriceHistoryState } from '@/src/features/prices/usePriceHistory';
import { resolveReadRing } from '@/src/features/tokenVitals/readRingCatalog';
import type { SafetyVerdict } from '@/src/features/tokenVitals/types';
import { resolveVerdictSourcesSubLine } from '@/src/features/tokenVitals/verdictSurface';
import type { PriceChartReadyPresentation } from '@/src/ui/charts/priceChartPresentation';
import { resolveChartSeedEligibility } from '@/src/ui/home/chartSeedCardPresentation';
import type { VerdictCardProps } from '@/src/ui/verdict/VerdictCard';

/**
 * Every handler a scene hands a real component. It does nothing: the intro's
 * composer sends nothing, its picker selects nothing, its rule card pauses
 * nothing, and its slide-to-sign pill confirms nothing.
 */
export const HOW_IT_WORKS_INERT = (): void => {};

/** Beat 1's scripted typing, and beat 2's echoed ask. */
export const HOW_IT_WORKS_ASK = howItWorksCopy.exampleAsk;

/** The first `count` letters of the scripted ask. */
export function resolveHowItWorksTypedAsk(count: number): string {
  return HOW_IT_WORKS_ASK.slice(0, Math.max(0, Math.min(count, HOW_IT_WORKS_ASK.length)));
}

/** The ask's ticker, read out of the person's own words, never retyped. */
const ASK_SYMBOL = HOW_IT_WORKS_ASK.split(' ')[1] ?? '';

/* ─── Beat 2: the verdict card ───────────────────────────────────────────── */

export type HowItWorksVerdictFixture = Required<
  Pick<VerdictCardProps, 'tone' | 'word' | 'ring' | 'subLine' | 'evidence'>
>;

const HOW_IT_WORKS_SAFETY: SafetyVerdict = {
  verdict: 'amber',
  scoreNormalised: null,
  flags: [],
  reconciled: true,
  sources: ['onchain_rpc', 'solana_tracker'],
  asOf: '2026-09-11T16:14:00.000Z',
  v2: {
    verdict: 'amber',
    flags: [],
    sources: ['onchain_rpc', 'solana_tracker'],
    checks: {
      core: { status: 'ok', asOf: '2026-09-11T16:00:00.000Z' },
      enrichment: { status: 'ok', asOf: '2026-09-11T16:14:00.000Z' },
    },
    trusted: false,
    catalog: {
      v: 1,
      lifecycle: 'graduated',
      checkedExtensions: [
        'permanent_delegate',
        'default_frozen',
        'transfer_hook',
        'transfer_fee',
      ],
      facts: [
        { key: 'mint_authority', level: 'ok', value: null, source: 'onchain_rpc' },
        { key: 'freeze_authority', level: 'ok', value: null, source: 'onchain_rpc' },
        { key: 'permanent_delegate', level: 'ok', value: null, source: 'onchain_rpc' },
        { key: 'default_frozen', level: 'ok', value: null, source: 'onchain_rpc' },
        { key: 'transfer_hook', level: 'ok', value: null, source: 'onchain_rpc' },
        { key: 'transfer_fee', level: 'ok', value: null, source: 'onchain_rpc' },
        { key: 'rugged', level: 'ok', value: null, source: 'solana_tracker' },
        { key: 'top10_concentration', level: 'warn', value: '41%', source: 'solana_tracker' },
        { key: 'dev_share', level: 'ok', value: '0.4%', source: 'solana_tracker' },
        { key: 'sniper_share', level: 'ok', value: '3.1%', source: 'solana_tracker' },
        { key: 'lp_lock', level: 'ok', value: null, source: 'solana_tracker' },
      ],
    },
  },
};

export const HOW_IT_WORKS_VERDICT: HowItWorksVerdictFixture = Object.freeze({
  tone: 'caution',
  word: copy.discovery.verdict.amber,
  ring: resolveReadRing(HOW_IT_WORKS_SAFETY),
  subLine: resolveVerdictSourcesSubLine({
    scoreLine: null,
    sourcesLine: 'per RugCheck + Birdeye + on-chain',
    unreconciledLine: null,
  }),
  evidence: Object.freeze([
    {
      key: 'mint-authority',
      tone: 'ok' as const,
      label: copy.tokenFacts.mintAuthority,
      value: copy.tokenFacts.renounced,
    },
    { key: 'lp-locked', tone: 'ok' as const, label: copy.tokenFacts.lpLocked, value: '98%' },
    {
      key: 'top-10',
      tone: 'warn' as const,
      label: copy.skills.test.reading.top10_concentration,
      value: '41%',
    },
  ]),
});

export const HOW_IT_WORKS_CHART: HomeAssemblyChart = Object.freeze({
  mint: 'how-corso-works-example',
  symbol: ASK_SYMBOL,
});

/** A fixed day of points, drifting from 1.93 to 1.84 with a small wiggle. */
const SERIES_START_MS = 1_788_998_400_000;
const SERIES_STEP_MS = 36 * 60 * 1000;
const SERIES = Object.freeze(
  Array.from({ length: 40 }, (_, i) => {
    const drift = 1.93 - (0.09 * i) / 39;
    const wiggle = i === 39 ? 0 : (i % 3 === 1 ? 0.012 : i % 3 === 2 ? -0.006 : 0);
    return Object.freeze({
      timestampMs: SERIES_START_MS + i * SERIES_STEP_MS,
      priceUsd: (drift + wiggle).toFixed(4),
    });
  }),
);

export const HOW_IT_WORKS_CHART_HISTORY: PriceHistoryState = Object.freeze({
  status: 'ready',
  series: SERIES as PriceHistoryState['series'],
  source: null,
  coverageKind: null,
  poolAddress: null,
  liquidityUsd: null,
  volume24hUsd: null,
  marketDataAsOfMs: null,
});

/** The seed draws only an eligible history; the fixture is always one. */
export function resolveHowItWorksChartPresentation(): PriceChartReadyPresentation {
  const eligibility = resolveChartSeedEligibility({
    chart: HOW_IT_WORKS_CHART,
    hasVerdict: true,
    history: HOW_IT_WORKS_CHART_HISTORY,
  });
  if (!eligibility.eligible) {
    throw new Error(`How Corso works chart fixture is not drawable: ${eligibility.reason}`);
  }
  return eligibility.presentation;
}

export type HowItWorksReviewRow = Readonly<{ key: string; label: string; value: string }>;

/** Scripted example quantities; only the fee rate comes from served config. */
export function resolveHowItWorksReview(feeBps: number | null) {
  const known = feeBps !== null && Number.isInteger(feeBps) && feeBps >= 0 && feeBps <= 10_000;
  const grossUsdc = 20.984; // 0.10 SOL × the example rate of 209.84 USDC.
  const feeUsdc = known ? grossUsdc * feeBps / 10_000 : null;
  return Object.freeze({
    receive: Object.freeze({
      label: copy.swap.youReceive,
      value: feeUsdc === null ? copy.swap.costEstimating : `${(grossUsdc - feeUsdc).toFixed(2)} USDC`,
    }),
    rows: Object.freeze<HowItWorksReviewRow[]>([
      { key: 'pay', label: copy.swap.youPay, value: '0.10 SOL' },
      { key: 'rate', label: copy.swap.price, value: copy.swap.rateLine('SOL', '209.84', 'USDC') },
      { key: 'network-fee', label: copy.swap.networkFee, value: copy.swap.corsoFeeUnderCent },
      {
        key: 'corso-fee',
        label: copy.swap.corsoFee,
        value: feeUsdc === null ? copy.swap.costEstimating : copy.swap.corsoFeeValueWithUsd(
          `$${feeUsdc.toFixed(2)}`,
          feeBpsToPercentLabel(feeBps as number),
        ),
      },
    ]),
    /** The real Review pill's own label: confirm, then slide. */
    slideLabel: copy.v1.confirmSwap,
  });
}

export const HOW_IT_WORKS_REVIEW = resolveHowItWorksReview(null);

/* ─── Beat 4: the rule card (only when bots are on) ──────────────────────── */

const USDC_UNIT: InputUnit = Object.freeze({ symbol: 'USDC', decimals: 6 });
const SOL_UNIT: InputUnit = Object.freeze({ symbol: 'SOL', decimals: 9 });
const RULE_UNTIL = '2026-10-11T12:00:00.000Z';

/** A SOL stop loss that exits below a 10% drop, capped at 5 / 20 USDC. */
export const HOW_IT_WORKS_BOT: Readonly<{
  bot: BotView;
  inputUnit: InputUnit;
  outputUnit: InputUnit;
}> = Object.freeze({
  bot: Object.freeze({
    id: 'how-corso-works-example',
    walletAddress: '',
    rule: { kind: 'stop_loss', dropPct: '10' },
    ruleKind: 'stop_loss',
    status: 'live',
    scope: {
      can: {
        swap: {
          inputMint: 'how-corso-works-example-in',
          outputMint: 'how-corso-works-example-out',
          target: { mint: 'how-corso-works-example-target', symbol: 'SOL' },
        },
        perFireMaxBaseUnits: '5000000',
        perDayMaxBaseUnits: '20000000',
        perDayMaxFires: 4,
        minOutBps: 9900,
        until: RULE_UNTIL,
      },
      canNever: [],
    },
    key: {
      status: 'active',
      revokedOnChain: false,
      standing: true,
      mandateAta: null,
      approvedBaseUnits: null,
      approveSignature: null,
    },
    kill: null,
    expiry: {
      expiresAt: RULE_UNTIL,
      state: 'active',
      msLeft: 30 * 24 * 60 * 60 * 1000,
      nudge: false,
      renewable: false,
    },
    fired: 0,
    spentToday: { fires: 0, baseUnits: '0' },
    fires: [],
    createdAt: RULE_UNTIL,
    updatedAt: RULE_UNTIL,
  }) as BotView,
  inputUnit: USDC_UNIT,
  outputUnit: SOL_UNIT,
});

/* ─── Beat 5: the picker ─────────────────────────────────────────────────── */

export function resolveHowItWorksPickerMenu(_flags: {
  chatgptEnabled: boolean;
  grokEnabled: boolean;
}): ModelMenuPresentation {
  return resolveModelMenu({ flags: BYO_AI_FLAGS_OFF, brains: [] });
}

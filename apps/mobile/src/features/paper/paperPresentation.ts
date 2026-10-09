import { paperCopy } from '@/constants/copy/paper';
import type { PaperFire, PaperResult } from './paperClient';

const c = paperCopy.result;

function splitDecimal(value: string): {
  negative: boolean;
  whole: bigint;
  fraction: string;
} {
  const negative = value.startsWith('-');
  const [whole = '0', fraction = ''] = value.replace('-', '').split('.');
  return { negative, whole: BigInt(whole), fraction };
}

function withThousands(whole: bigint): string {
  return whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Floor to the cent, toward −∞. `-1.231` → `−$1.24`; `1.239` → `$1.23`. */
export function formatUsdFloor(value: string): string {
  const { negative, whole, fraction } = splitDecimal(value);
  let cents = whole * 100n + BigInt((fraction + '00').slice(0, 2));
  const truncated = /[1-9]/.test(fraction.slice(2));
  if (negative && truncated) cents += 1n;
  const zero = cents === 0n;
  const sign = negative && !zero ? '−' : '';
  return `${sign}$${withThousands(cents / 100n)}.${(cents % 100n).toString().padStart(2, '0')}`;
}

/** Floor to at most 6 decimals; a positive amount below that shows as `<0.000001`, never as more. */
export function formatTokensFloor(value: string): string {
  const { whole, fraction } = splitDecimal(value);
  const kept = fraction.slice(0, 6).replace(/0+$/, '');
  if (whole === 0n && kept === '' && /[1-9]/.test(fraction)) return '<0.000001';
  return kept ? `${withThousands(whole)}.${kept}` : withThousands(whole);
}

export type PaperFireRow = {
  key: string;
  atMs: number;
  side: string;
  detail: string;
  missed: boolean;
};

export type PaperResultView = {
  banner: string;
  bannerBody: string;
  model: string;
  assumptions: string[];
  notModelled: string;
  thinData: string | null;
  summary: { label: string; value: string }[];
  fires: PaperFireRow[];
  noFires: string | null;
  stopped: string | null;
};

function fireRow(fire: PaperFire, index: number): PaperFireRow {
  const side = fire.side === 'buy' ? c.buy : c.sell;
  if (fire.status === 'unfilled') {
    return {
      key: `${fire.atMs}-${index}`,
      atMs: fire.atMs,
      side,
      detail: c.unfilled[fire.reason],
      missed: true,
    };
  }
  return {
    key: `${fire.atMs}-${index}`,
    atMs: fire.atMs,
    side,
    // Spend is exact (the size); what came back is floored.
    detail: c.filled(
      formatUsdFloor(fire.usd),
      formatTokensFloor(fire.tokens),
      fire.side,
    ),
    missed: false,
  };
}

export function resolvePaperResultView(
  result: PaperResult,
): PaperResultView | null {
  const model = (c.model as Record<string, string | undefined>)[
    String(result.assumptions?.impact)
  ];
  if (!model) return null;
  const pnl = formatUsdFloor(result.end.pnlUsd);
  return {
    banner: c.banner,
    bannerBody: c.bannerBody,
    model,
    assumptions: [
      c.assumptionFill,
      c.assumptionLatency(
        Math.max(1, Math.round(result.assumptions.latencyMs / 60_000)),
      ),
      c.assumptionSlippage(result.assumptions.minOutBps),
      c.assumptionFee(result.assumptions.feeBps),
      c.assumptionDepth(formatUsdFloor(result.assumptions.depthUsd)),
      c.assumptionMark,
    ],
    notModelled: c.notModelled,
    thinData: result.thinData ? c.thinData : null,
    summary: [
      { label: c.start, value: formatUsdFloor(result.end.startValueUsd) },
      {
        label: c.end,
        value:
          result.end.tokens !== '0'
            ? `${formatUsdFloor(result.end.valueUsd)} · ${c.held(formatTokensFloor(result.end.tokens))}`
            : formatUsdFloor(result.end.valueUsd),
      },
      {
        label: c.pnl,
        value: pnl.startsWith('−') || pnl === '$0.00' ? pnl : `+${pnl}`,
      },
    ],
    fires: result.fires.map(fireRow),
    noFires: result.fires.length === 0 ? c.noFires : null,
    stopped: result.stopped ? c.stopped : null,
  };
}

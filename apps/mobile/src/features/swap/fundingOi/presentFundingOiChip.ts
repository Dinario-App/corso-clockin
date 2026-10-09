import { copy } from '@/constants/copy';
import { MAJOR_ASSETS } from '@/src/features/balances/majors';
import {
  FUNDING_OI_ASSETS,
  FUNDING_OI_CHIP_KEY,
  FUNDING_OI_MAX_ABS_RATE,
  FUNDING_OI_STALE_MS,
  FUNDING_OI_VENUES,
  type FundingOiAsset,
  type FundingOiChip,
  type FundingOiInstrument,
  type FundingOiResponse,
} from './types';

const ASSETS = new Set<string>(FUNDING_OI_ASSETS);
const VENUES = new Set<string>(FUNDING_OI_VENUES);

export type PresentFundingOiChipRead = {
  snapshot: FundingOiResponse | null;
  nowMs: number;
  payMint?: string | null;
  receiveMint?: string | null;
};

/**
 * Display-only Review chip. Missing, stale, or unreadable funding data
 * returns null so the chip omits. Does not participate in Sign.
 */
export function presentFundingOiChip(
  read: PresentFundingOiChipRead,
): FundingOiChip | null {
  const snapshot = read.snapshot;
  if (snapshot?.status !== 'ready') return null;
  const preferred = preferredAsset(read.payMint, read.receiveMint);
  const row = pickInstrument(snapshot.instruments, preferred, read.nowMs);
  if (!row) return null;
  const freshness = freshnessLabel(row.observedAtMs, read.nowMs);
  if (!freshness) return null;
  if (!VENUES.has(row.venue)) return null;
  const venueNames = [copy.fundingOi.venues[row.venue]];
  const funding = formatFundingPercent(row.fundingRate);
  if (!funding) return null;
  const oi =
    row.openInterestUsd == null
      ? null
      : `${copy.fundingOi.openInterest} ${formatOpenInterestUsd(row.openInterestUsd)}`;
  const label = [
    `${row.asset} ${copy.fundingOi.funding} ${funding}`,
    oi,
    venueNames.join(' · '),
  ]
    .filter((part): part is string => part != null && part.length > 0)
    .join(' · ');
  return {
    key: FUNDING_OI_CHIP_KEY,
    label,
    asset: row.asset,
    fundingRate: row.fundingRate,
    openInterestUsd: row.openInterestUsd,
    venues: [row.venue],
    freshness,
  };
}

function preferredAsset(
  payMint?: string | null,
  receiveMint?: string | null,
): FundingOiAsset | null {
  return assetForMint(receiveMint) ?? assetForMint(payMint);
}

function assetForMint(mint?: string | null): FundingOiAsset | null {
  if (!mint) return null;
  const major = MAJOR_ASSETS.find((asset) => asset.mint === mint);
  if (!major) return null;
  switch (major.symbol) {
    case 'SOL':
      return 'SOL';
    case 'cbBTC':
      return 'BTC';
    case 'ETH':
      return 'ETH';
    case 'ZEC':
      return null;
    default:
      return null;
  }
}

function pickInstrument(
  instruments: readonly FundingOiInstrument[],
  preferred: FundingOiAsset | null,
  nowMs: number,
): FundingOiInstrument | null {
  const readable = instruments.filter((row) => isReadable(row, nowMs));
  if (preferred) {
    return readable.find((row) => row.asset === preferred) ?? null;
  }
  return (
    FUNDING_OI_ASSETS.map((asset) =>
      readable.find((row) => row.asset === asset),
    ).find((row) => row != null) ?? null
  );
}

function isReadable(row: FundingOiInstrument, nowMs: number): boolean {
  if (!ASSETS.has(row.asset) || !VENUES.has(row.venue)) return false;
  if (
    typeof row.fundingRate !== 'number' ||
    !Number.isFinite(row.fundingRate) ||
    Math.abs(row.fundingRate) > FUNDING_OI_MAX_ABS_RATE
  ) {
    return false;
  }
  if (
    row.openInterestUsd != null &&
    (typeof row.openInterestUsd !== 'number' ||
      !Number.isFinite(row.openInterestUsd) ||
      row.openInterestUsd <= 0)
  ) {
    return false;
  }
  if (
    !Number.isFinite(row.observedAtMs) ||
    row.observedAtMs > nowMs ||
    nowMs - row.observedAtMs > FUNDING_OI_STALE_MS
  ) {
    return false;
  }
  return true;
}

function formatFundingPercent(rate: number): string | null {
  const pct = rate * 100;
  if (!Number.isFinite(pct)) return null;
  const body = Math.abs(pct).toFixed(4);
  if (pct > 0) return `+${body}%`;
  if (pct < 0) return `\u2212${body}%`;
  return `${body}%`;
}

function formatOpenInterestUsd(usd: number): string {
  const abs = Math.abs(usd);
  if (abs >= 1e12) return `$${(usd / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `$${(usd / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(usd / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(usd / 1e3).toFixed(1)}K`;
  return `$${Math.round(usd)}`;
}

function freshnessLabel(observedAtMs: number, nowMs: number): string | null {
  const observedDay = utcDay(observedAtMs);
  const nowDay = utcDay(nowMs);
  const dayDiff = Math.round((nowDay - observedDay) / 86_400_000);
  if (dayDiff === 0) return copy.fundingOi.today;
  if (dayDiff === 1) return copy.fundingOi.yesterday;
  if (dayDiff > 1 && nowMs - observedAtMs <= FUNDING_OI_STALE_MS) {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(observedAtMs));
  }
  return null;
}

function utcDay(ms: number): number {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

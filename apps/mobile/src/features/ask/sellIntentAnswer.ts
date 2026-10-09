import { answerFromText, readModelText } from './askAnswerBoundary';
import { trustedCopy } from './askText';
import { copy } from '@/constants/copy';
import { formatSellIntentLine } from './askCodeCopy';
import type {
  FiatTotalResult,
  HoldingsSnapshot,
} from '@/src/features/balances/computeFiatTotal';
import type { HoldingsBook } from '@/src/features/balances/holdingsBook';
import type { SessionType } from '@/src/features/session/types';
import type { AskAnswer, AskSellDoor } from '@/src/features/ask/askClient';
import {
  buildAssetSwapActions,
  type AssetSwapHref,
} from '@/src/features/swap/assetPrefill';
import { resolveHeldSellDoor } from '@/src/features/swap/heldSellDoor';
import { ACQUIRE_ACCESS_UNKNOWN } from '@/src/features/security/acquireAccessPresentation';
import { SOL_MINT, usdcMintForCluster } from '@/src/features/swap/tokens';

const SELL_INTENT =
  /^(?:sell|sell it|sell it all|sell all|sell all of it|sell everything|sell my bags|get out|get me out|cash out|exit everything)[?!.]*$/i;

/** An exit with no token named — the only shape this module answers. */
export function isSellIntentAsk(text: string): boolean {
  return SELL_INTENT.test(text.normalize('NFKC').trim());
}

/**
 * How many doors the answer offers.
 *
 * Three, matching `LIVE_PILL_MAX`: the reply renders one row of pills, and a
 * fourth row that could not be drawn would be a holding silently left out of an
 * answer about selling. A wallet with more positions than this is answered by
 * naming the question rather than by truncating the list — see `sellWhichMore`.
 */
export const SELL_DOOR_MAX = 3;

type SellCandidate = {
  mint: string;
  symbol: string;
  decimals: number;
  /** Fiat value, for ordering. `null` when this line was not priced. */
  usd: number | null;
};

export function resolveSellIntentAnswer(input: {
  text: string;
  /** Parsed response identity only; local matching book still owns the Sell door. */
  resolvedMint?: string;
  /** The active signer session's type. `null` when there is no session. */
  walletType: SessionType | null | undefined;
  /** The held-token book. `idle` is normal on a surface that never asked. */
  book: HoldingsBook;
  /** The quantity snapshot. Non-quote holdings open token detail first. */
  snapshot: HoldingsSnapshot | null | undefined;
  /** Priced lines, for ORDERING only. Never used to size anything. */
  fiat?: FiatTotalResult | null;
}): AskAnswer | null {
  const named = namedHeldTokenAnswer(input);
  if (named) return named;
  if (!isSellIntentAsk(input.text)) return null;
  const completeBookMatches =
    input.book.status === 'ready' &&
    input.snapshot?.quantityStatus === 'ready' &&
    input.book.owner === input.snapshot.address &&
    input.book.cluster === input.snapshot.cluster;
  const cluster =
    completeBookMatches && input.book.status === 'ready'
      ? input.book.cluster
      : clusterFromSnapshot(input.snapshot);
  if (!cluster) return null;

  const candidates = sellCandidates({
    snapshot: input.snapshot,
    fiat: input.fiat,
  });
  if (candidates.length === 0) return null;

  const doors: AskSellDoor[] = [];
  for (const candidate of candidates) {
    if (doors.length >= SELL_DOOR_MAX) break;
    const door = sellDoorFor(candidate, { ...input, cluster });
    if (door) doors.push(door);
  }
  if (doors.length === 0) return null;

  const limit =
    input.walletType != null && input.walletType !== 'privy_embedded'
      ? trustedCopy('tokenDetail', 'sellNeedsCorsoWallet')
      : null;
  const unlisted = candidates.length - doors.length;
  const question =
    doors.length === 1
      ? readModelText(copy.ask.sellWhichOne(doors[0]!.symbol))
      : unlisted > 0
        ? trustedCopy('ask', 'sellWhichMore')
        : trustedCopy('ask', 'sellWhich');

  return Object.assign(
    answerFromText('answered', formatSellIntentLine(question, limit)),
    {
      sellDoors: doors,
    },
  );
}

/** A held-token identity opens detail first; chain facts there own the Sell gate. */
function namedHeldTokenAnswer(
  input: Parameters<typeof resolveSellIntentAnswer>[0],
): AskAnswer | null {
  if (
    input.walletType !== 'privy_embedded' ||
    input.book.status !== 'ready' ||
    input.snapshot?.quantityStatus !== 'ready' ||
    input.book.owner !== input.snapshot.address ||
    input.book.cluster !== input.snapshot.cluster
  )
    return null;
  const text = (input.resolvedMint ?? input.text)
    .normalize('NFKC')
    .trim()
    .replace(/[?!.]+$/, '');
  const matches = input.snapshot.lines.filter((line) => {
    const spendAtomic =
      !input.resolvedMint && line.mint === SOL_MINT && line.symbol === 'SOL'
        ? (line.nativeAtomic ?? line.atomic)
        : line.atomic;
    return (
      line.includeInHomeTotal &&
      /^\d+$/.test(spendAtomic) &&
      BigInt(spendAtomic) > 0n &&
      (input.resolvedMint
        ? input.resolvedMint === line.mint
        : text === line.mint ||
          text.toLocaleUpperCase() === line.symbol.toLocaleUpperCase())
    );
  });
  if (matches.length !== 1) return null;
  const line = matches[0]!;
  if (!input.resolvedMint && line.mint === SOL_MINT && line.symbol === 'SOL') {
    const door = sellDoorFor(
      {
        mint: line.mint,
        symbol: line.symbol,
        decimals: line.decimals,
        usd: null,
      },
      {
        walletType: input.walletType,
        book: input.book,
        cluster: input.book.cluster,
        snapshot: input.snapshot,
      },
    );
    return door
      ? Object.assign(
          answerFromText(
            'answered',
            readModelText(copy.ask.sellWhichOne(line.symbol)),
          ),
          { sellDoors: [door] },
        )
      : null;
  }
  const held = input.book.byMint.get(line.mint);
  if (!held || held.atomic <= 0n) return null;
  return Object.assign(
    answerFromText(
      'answered',
      readModelText(copy.ask.sellWhichOne(line.symbol)),
    ),
    {
      sellDoors: [
        {
          mint: line.mint,
          symbol: line.symbol,
          decimals: line.decimals,
          label: copy.ask.sellDoorLabel(line.symbol),
          assetDetailsOnly: true as const,
        },
      ],
    },
  );
}

/**
 * Everything a sell offer can name, richest first.
 *
 * Non-quote holdings open mint detail first, where chain facts and the live
 * book decide the Sell door. Snapshot decimals are display-only and never
 * populate a held sell compose route from Home.
 */
function sellCandidates(input: {
  snapshot: HoldingsSnapshot | null | undefined;
  fiat?: FiatTotalResult | null;
}): SellCandidate[] {
  const usdByMint = new Map<string, number>();
  for (const line of input.fiat?.lines ?? []) {
    if (!line.priced || line.fiatAmount == null) continue;
    const value = Number(line.fiatAmount);
    if (Number.isFinite(value)) usdByMint.set(line.mint, value);
  }
  const seen = new Set<string>();
  const out: SellCandidate[] = [];

  for (const line of input.snapshot?.lines ?? []) {
    if (!line.includeInHomeTotal) continue;
    // A balance nobody read, or a confirmed zero, is not a position to exit.
    const spendAtomic =
      line.mint === SOL_MINT && line.symbol === 'SOL'
        ? (line.nativeAtomic ?? line.atomic)
        : line.atomic;
    if (!/^\d+$/.test(spendAtomic) || BigInt(spendAtomic) <= 0n) continue;
    if (seen.has(line.mint)) continue;
    seen.add(line.mint);
    out.push({
      mint: line.mint,
      symbol: line.symbol,
      decimals: line.decimals,
      usd: usdByMint.get(line.mint) ?? null,
    });
  }

  // Richest first, then alphabetical so the order never depends on map order.
  // An unpriced line sorts last rather than as zero — unknown is not nothing.
  return out.sort(
    (a, b) => (b.usd ?? -1) - (a.usd ?? -1) || a.symbol.localeCompare(b.symbol),
  );
}

function sellDoorFor(
  candidate: SellCandidate,
  input: {
    walletType: SessionType | null | undefined;
    book: HoldingsBook;
    cluster: 'devnet' | 'mainnet-beta';
    snapshot: HoldingsSnapshot | null | undefined;
  },
): AskSellDoor | null {
  const { cluster } = input;
  if (
    candidate.symbol !== 'SOL' &&
    candidate.mint !== usdcMintForCluster(cluster)
  ) {
    if (
      input.walletType !== 'privy_embedded' ||
      input.book.status !== 'ready' ||
      input.book.cluster !== cluster ||
      input.book.owner !== input.snapshot?.address
    )
      return null;
    const held = input.book.byMint.get(candidate.mint);
    if (!held || held.atomic <= 0n) return null;
    return {
      mint: candidate.mint,
      symbol: candidate.symbol,
      decimals: candidate.decimals,
      label: copy.ask.sellDoorLabel(candidate.symbol),
      assetDetailsOnly: true,
    };
  }
  const action = buildAssetSwapActions({
    mint: candidate.mint,
    symbol: candidate.symbol,
    decimals: candidate.decimals,
    cluster,
    heldSell: resolveHeldSellDoor({
      mint: candidate.mint,
      cluster,
      walletType: input.walletType,
      book: input.book,
    }),
    // Sell only: the Buy answer is not read here and not used.
    acquireAccess: ACQUIRE_ACCESS_UNKNOWN,
  }).find((built) => built.direction === 'sell');
  if (!action) return null;
  return {
    mint: candidate.mint,
    symbol: candidate.symbol,
    decimals: candidate.decimals,
    label: copy.ask.sellDoorLabel(candidate.symbol),
  };
}

function clusterFromSnapshot(
  snapshot: HoldingsSnapshot | null | undefined,
): 'devnet' | 'mainnet-beta' | null {
  for (const line of snapshot?.lines ?? []) {
    if (line.symbol !== 'USDC') continue;
    for (const cluster of ['mainnet-beta', 'devnet'] as const) {
      if (line.mint === usdcMintForCluster(cluster)) return cluster;
    }
  }
  return null;
}

export function sellDoorHref(
  door: AskSellDoor,
): AssetSwapHref | { pathname: '/asset/[mint]'; params: { mint: string } } {
  if (door.assetDetailsOnly)
    return { pathname: '/asset/[mint]', params: { mint: door.mint } };
  return {
    pathname: '/swap',
    params: {
      assetDirection: 'sell',
      assetMint: door.mint,
      assetSymbol: door.symbol,
      assetDecimals: String(door.decimals),
    },
  };
}

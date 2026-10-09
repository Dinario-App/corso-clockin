import { copy } from '@/constants/copy';
import { isModeratedTokenLabel } from '@/src/features/discovery/moderation';
import { formatClosedBarStamp } from '@/src/features/home/asOfPresentation';
import { formatPriceUsd } from '@/src/ui/format/numberCraft';
import type { PriceSnapshot } from '@/src/features/balances/priceSnapshot';
import {
  selectedDiyList,
  type DiyCommand,
  type DiyFailure,
  type DiyWatchlists,
} from './diyWatchlistModel';

export type ReviewWatchlistSide = 'buy' | 'sell';

export type ReviewWatchlistBatch =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'partial'
  | 'unavailable'
  | 'disabled'
  | 'error';

export type ReviewWatchlistPriceLine = {
  status: 'ok' | 'missing' | 'stale' | 'unsupported' | 'bad' | 'unavailable';
  price: string | null;
  asOfMs: number | null;
  maxAgeMs: number | null;
};

export type ReviewWatchlistRead = {
  side: ReviewWatchlistSide;
  hydrated: boolean;
  loadError: boolean;
  data: DiyWatchlists;
  batch: ReviewWatchlistBatch;
  lines: Readonly<Record<string, ReviewWatchlistPriceLine | undefined>>;
  nowMs: number;
};

export type ReviewWatchlistPriceState =
  | 'priced'
  | 'unpriced'
  | 'unavailable'
  | 'off'
  | 'waiting';

export type ReviewWatchlistRow = {
  mint: string;
  symbol: string;
  /** A formatted USD string, or null. Never a stand-in number. */
  priceLabel: string | null;
  priceState: ReviewWatchlistPriceState;
  statusLabel: string | null;
  /** Clock for a priced row. Null when the row has no price. */
  asOfLabel: string | null;
  accessibilityLabel: string;
};

export type ReviewWatchlistModel =
  | { kind: 'loading'; title: string }
  | { kind: 'empty'; title: string; body: string }
  | { kind: 'error'; title: string; body: string }
  | {
      kind: 'list';
      title: string;
      name: string;
      banner: string | null;
      rows: readonly ReviewWatchlistRow[];
    };

const LINE_STATUSES = new Set<ReviewWatchlistPriceLine['status']>([
  'ok',
  'missing',
  'stale',
  'unsupported',
  'bad',
  'unavailable',
]);

export function linesFromPriceSnapshot(
  snapshot: PriceSnapshot | null,
): Record<string, ReviewWatchlistPriceLine> {
  const lines: Record<string, ReviewWatchlistPriceLine> = {};
  if (!snapshot) return lines;
  for (const line of snapshot.lines) {
    if (!LINE_STATUSES.has(line.status as ReviewWatchlistPriceLine['status'])) {
      continue;
    }
    lines[line.mint] = {
      status: line.status as ReviewWatchlistPriceLine['status'],
      price: line.status === 'ok' ? (line.quote?.price ?? null) : null,
      asOfMs: line.quote?.asOfMs ?? null,
      maxAgeMs: line.quote?.maxAgeMs ?? null,
    };
  }
  return lines;
}

function spokenSymbol(symbol: string): string {
  if (symbol === copy.diyLists.unknownToken) return symbol;
  return isModeratedTokenLabel({ symbol })
    ? copy.watchlist.withheldSymbol
    : symbol;
}

/**
 * A price leaves this function only for a fresh ok quote whose decimal
 * formats. Every other line is words and a null price.
 */
export function reviewWatchlistPrice(args: {
  batch: ReviewWatchlistBatch;
  line: ReviewWatchlistPriceLine | undefined;
  nowMs: number;
}): {
  priceLabel: string | null;
  priceState: ReviewWatchlistPriceState;
  statusLabel: string | null;
  asOfLabel: string | null;
} {
  if (args.batch === 'error' || args.batch === 'unavailable') {
    return {
      priceLabel: null,
      priceState: 'unavailable',
      statusLabel: copy.diyLists.pricesUnavailable,
      asOfLabel: null,
    };
  }
  if (args.batch === 'disabled') {
    return {
      priceLabel: null,
      priceState: 'off',
      statusLabel: copy.diyLists.pricesOff,
      asOfLabel: null,
    };
  }
  if (args.batch === 'idle' || args.batch === 'loading') {
    return {
      priceLabel: null,
      priceState: 'waiting',
      statusLabel: copy.diyLists.waiting,
      asOfLabel: null,
    };
  }
  const line = args.line;
  if (
    !line ||
    line.status !== 'ok' ||
    line.price == null ||
    line.asOfMs == null ||
    line.maxAgeMs == null ||
    args.nowMs - line.asOfMs > line.maxAgeMs
  ) {
    return {
      priceLabel: null,
      priceState: 'unpriced',
      statusLabel: copy.diyLists.notPriced,
      asOfLabel: null,
    };
  }
  const priceLabel = formatPriceUsd(line.price);
  const clock = formatClosedBarStamp(line.asOfMs, args.nowMs);
  if (priceLabel == null || clock == null) {
    return {
      priceLabel: null,
      priceState: 'unpriced',
      statusLabel: copy.diyLists.notPriced,
      asOfLabel: null,
    };
  }
  return {
    priceLabel,
    priceState: 'priced',
    statusLabel: null,
    asOfLabel: copy.diyLists.asOf(clock),
  };
}

/** Same model for buy and sell. `side` is accepted and does not branch the rows. */
export function presentReviewWatchlist(
  read: ReviewWatchlistRead,
): ReviewWatchlistModel {
  const side = read.side;
  if (side !== 'buy' && side !== 'sell') {
    return {
      kind: 'error',
      title: copy.diyLists.reviewTitle,
      body: copy.diyLists.diskError,
    };
  }
  if (!read.hydrated) {
    return { kind: 'loading', title: copy.diyLists.reviewTitle };
  }
  if (read.loadError && read.data.lists.length === 0) {
    return {
      kind: 'error',
      title: copy.diyLists.reviewTitle,
      body: copy.diyLists.diskError,
    };
  }
  const list = selectedDiyList(read.data);
  if (!list) {
    return {
      kind: 'empty',
      title: copy.diyLists.reviewTitle,
      body: copy.diyLists.noListBody,
    };
  }
  if (list.tokens.length === 0) {
    return {
      kind: 'empty',
      title: copy.diyLists.reviewTitle,
      body: copy.diyLists.listEmpty,
    };
  }
  const rows = list.tokens.map((token) => {
    const symbol = spokenSymbol(token.symbol);
    const price = reviewWatchlistPrice({
      batch: read.batch,
      line: read.lines[token.mint],
      nowMs: read.nowMs,
    });
    const detail =
      price.priceLabel ?? price.statusLabel ?? copy.diyLists.notPriced;
    return {
      mint: token.mint,
      symbol,
      priceLabel: price.priceLabel,
      priceState: price.priceState,
      statusLabel: price.statusLabel,
      asOfLabel: price.asOfLabel,
      accessibilityLabel: price.asOfLabel
        ? `${symbol}, ${detail}, ${price.asOfLabel}`
        : `${symbol}, ${detail}`,
    };
  });
  const banner = rows.some((row) => row.priceState === 'unavailable')
    ? copy.diyLists.pricesUnavailable
    : rows.every((row) => row.priceState === 'off')
      ? copy.diyLists.pricesOff
      : null;
  const spoken = banner
    ? rows.map((row) =>
        row.statusLabel === banner
          ? { ...row, statusLabel: null, accessibilityLabel: row.symbol }
          : row,
      )
    : rows;
  return {
    kind: 'list',
    title: copy.diyLists.reviewTitle,
    name: list.name,
    banner,
    rows: spoken,
  };
}

export function presentDiyNotice(
  reason: DiyFailure | null,
  action: DiyCommand['type'],
): string | null {
  if (reason == null) return null;
  if (reason === 'full' && action === 'create') return copy.diyLists.listsFull;
  if (reason === 'full') return copy.diyLists.listFull;
  if (reason === 'invalid' && (action === 'create' || action === 'rename')) {
    return copy.diyLists.invalidName;
  }
  if (reason === 'invalid') return copy.diyLists.invalidMint;
  return null;
}

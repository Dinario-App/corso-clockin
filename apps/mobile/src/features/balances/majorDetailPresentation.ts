import { formatAtomicAmount } from '@/src/features/swap/tokens';
import { formatFiatAmount, formatPriceUsd } from '@/src/ui/format/numberCraft';
import {
  atomicToFiatMinor,
  formatFiatMinor,
  parseDecimalPrice,
  type PriceQuote,
} from './computeFiatTotal';
import { readHeldBalance, type HoldingsBook } from './holdingsBook';
import { getMajorAsset, isMajorMint, type MajorAsset } from './majors';

export type MajorDetailEyebrow = 'position' | 'price';

export type MajorDetailHero =
  | { kind: 'position'; fiatText: string; qtyText: string }
  | { kind: 'price'; priceText: string; stale: boolean }
  | {
      kind: 'unavailable';
      label: 'price_unavailable' | 'holdings_unavailable' | 'loading';
    };

export type MajorDetailModel = {
  asset: MajorAsset;
  eyebrow: MajorDetailEyebrow;
  hero: MajorDetailHero;
  /** Always null until a real 24h×quantity delta source lands. */
  delta: null;
  wrapperDisclosureKey: MajorAsset['wrapperDisclosureKey'];
  priceStale: boolean;
};

function quoteFreshness(
  quote: PriceQuote | null | undefined,
  mint: string,
  nowMs: number,
): 'missing' | 'bad' | 'stale' | 'ok' {
  if (quote == null) return 'missing';
  if (quote.mint !== mint) return 'bad';
  if (typeof quote.price !== 'string' || !parseDecimalPrice(quote.price)) {
    return 'bad';
  }
  if (
    typeof quote.asOfMs !== 'number' ||
    !Number.isFinite(quote.asOfMs) ||
    quote.asOfMs < 0 ||
    typeof quote.maxAgeMs !== 'number' ||
    !Number.isFinite(quote.maxAgeMs) ||
    quote.maxAgeMs < 0
  ) {
    return 'bad';
  }
  if (nowMs - quote.asOfMs > quote.maxAgeMs) return 'stale';
  return 'ok';
}

function formatPriceText(quote: PriceQuote): string | null {
  return formatPriceUsd(quote.price) ?? formatFiatAmount(quote.price);
}

function formatPosition(
  atomic: bigint,
  decimals: number,
  quote: PriceQuote,
  symbol: string,
): { fiatText: string; qtyText: string } | null {
  const parsed = parseDecimalPrice(quote.price);
  if (!parsed) return null;
  const fiatMinor = atomicToFiatMinor(atomic, decimals, parsed);
  if (fiatMinor === null) return null;
  const fiatText = formatFiatAmount(formatFiatMinor(fiatMinor));
  if (!fiatText) return null;
  return {
    fiatText,
    qtyText: `${formatAtomicAmount(atomic.toString(), decimals)} ${symbol}`,
  };
}

export function buildMajorDetailModel(args: {
  mint: string;
  book: HoldingsBook;
  quote: PriceQuote | null | undefined;
  nowMs: number;
}): MajorDetailModel | null {
  const asset = getMajorAsset(args.mint);
  if (!asset) return null;

  const freshness = quoteFreshness(args.quote, args.mint, args.nowMs);
  const usableQuote =
    freshness === 'ok' || freshness === 'stale' ? args.quote! : null;
  const priceText = usableQuote ? formatPriceText(usableQuote) : null;
  const priceStale = freshness === 'stale';

  if (args.book.status === 'loading') {
    return {
      asset,
      eyebrow: 'price',
      hero: { kind: 'unavailable', label: 'loading' },
      delta: null,
      wrapperDisclosureKey: asset.wrapperDisclosureKey,
      priceStale,
    };
  }

  if (args.book.status === 'error') {
    return {
      asset,
      eyebrow: 'price',
      hero: { kind: 'unavailable', label: 'holdings_unavailable' },
      delta: null,
      wrapperDisclosureKey: asset.wrapperDisclosureKey,
      priceStale,
    };
  }

  const held = readHeldBalance(args.book, args.mint);
  if (!held.known) {
    // idle (signed-out or facts-down / no cluster) or other unknown holdings:
    // show price hero if we have a quote (not-held path); never claim position.
    // Never "Loading…" forever on a money screen.
    if (priceText) {
      return {
        asset,
        eyebrow: 'price',
        hero: { kind: 'price', priceText, stale: priceStale },
        delta: null,
        wrapperDisclosureKey: asset.wrapperDisclosureKey,
        priceStale,
      };
    }
    return {
      asset,
      eyebrow: 'price',
      hero: { kind: 'unavailable', label: 'price_unavailable' },
      delta: null,
      wrapperDisclosureKey: asset.wrapperDisclosureKey,
      priceStale: false,
    };
  }

  const isHeld = held.atomic > 0n;

  if (isHeld) {
    if (freshness === 'ok' && usableQuote) {
      const position = formatPosition(
        held.atomic,
        asset.decimals,
        usableQuote,
        asset.symbol,
      );
      if (position) {
        return {
          asset,
          eyebrow: 'position',
          hero: {
            kind: 'position',
            fiatText: position.fiatText,
            qtyText: position.qtyText,
          },
          delta: null,
          wrapperDisclosureKey: asset.wrapperDisclosureKey,
          priceStale: false,
        };
      }
    }
    if (priceText) {
      return {
        asset,
        eyebrow: 'price',
        hero: { kind: 'price', priceText, stale: priceStale },
        delta: null,
        wrapperDisclosureKey: asset.wrapperDisclosureKey,
        priceStale,
      };
    }
    return {
      asset,
      eyebrow: 'position',
      hero: { kind: 'unavailable', label: 'price_unavailable' },
      delta: null,
      wrapperDisclosureKey: asset.wrapperDisclosureKey,
      priceStale: false,
    };
  }

  if (priceText) {
    return {
      asset,
      eyebrow: 'price',
      hero: { kind: 'price', priceText, stale: priceStale },
      delta: null,
      wrapperDisclosureKey: asset.wrapperDisclosureKey,
      priceStale,
    };
  }

  return {
    asset,
    eyebrow: 'price',
    hero: { kind: 'unavailable', label: 'price_unavailable' },
    delta: null,
    wrapperDisclosureKey: asset.wrapperDisclosureKey,
    priceStale: false,
  };
}

export { isMajorMint, getMajorAsset };

import { copy } from '@/constants/copy';
import { getMajorAsset } from './majors';

type MajorNames = typeof copy.majorNames;

function entry(symbol: string): MajorNames[keyof MajorNames] | null {
  return Object.hasOwn(copy.majorNames, symbol)
    ? copy.majorNames[symbol as keyof MajorNames]
    : null;
}

export function majorConsumerName(asset: {
  symbol: string;
  displayName: string;
}): string {
  return entry(asset.symbol)?.name ?? asset.displayName;
}

/** The wrapper line under the name on Buy, or `null` for an unwrapped asset. */
export function majorWrapperLine(symbol: string): string | null {
  return entry(symbol)?.wrapper ?? null;
}

const WRAPPER_NAME =
  /\bwrapped\b|\bportal\b|\bwormhole\b|\bomni ?bridge\b|\bbridged\b|\b21\.co\b/i;

export function consumerTokenName(token: {
  mint: string | null | undefined;
  symbol: string;
  name: string;
}): string {
  const asset = getMajorAsset(token.mint);
  if (asset) return majorConsumerName(asset);
  return WRAPPER_NAME.test(token.name) && token.symbol.trim()
    ? token.symbol
    : token.name;
}

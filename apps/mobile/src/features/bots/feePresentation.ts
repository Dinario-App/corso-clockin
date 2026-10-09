import { feeBpsForSwapPair } from '@corso/swap-config';
import type { BotFireView } from './types';

/** Config owns the rate; the ratified stablecoin-pair waiver is shared with the server. */
export function ruleFeeRateLabel(
  configuredFeeBps: number | null,
  inputMint: string | null,
  outputMint: string | null,
): string | null {
  if (configuredFeeBps === null || inputMint === null || outputMint === null)
    return null;
  const bps = feeBpsForSwapPair({ configuredFeeBps, inputMint, outputMint });
  if (!Number.isInteger(bps) || bps < 0 || bps > 255) return null;
  return `Corso fee: ${bps / 100}%`;
}

/** Exact provider-carried atomic fee. No rate × amount arithmetic or floating point. */
export function fireFeeLabel(
  fire: BotFireView,
  unit: { symbol: string; decimals: number } | null,
): string {
  if (fire.outcome !== 'landed' || !fire.platformFee)
    return 'Corso fee: unavailable';
  const amount = fire.platformFee.amount;
  if (!unit)
    return `Corso fee: ${amount} base units (${fire.platformFee.mint})`;
  const padded = amount.padStart(unit.decimals + 1, '0');
  const whole = unit.decimals === 0 ? padded : padded.slice(0, -unit.decimals);
  const fraction =
    unit.decimals === 0 ? '' : padded.slice(-unit.decimals).replace(/0+$/, '');
  return `Corso fee: ${whole}${fraction ? `.${fraction}` : ''} ${unit.symbol}`;
}

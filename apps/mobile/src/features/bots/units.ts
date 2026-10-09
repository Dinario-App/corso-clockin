import { USDC_DECIMALS } from '@/src/features/skills/directory/configureDraft';
import { usdcMintForCluster } from '@/src/features/swap/tokens';
import type { NetworkStatus } from '@/src/lib/apiConfig';
import type { InputUnit } from './botPresentation';
import type { BotView } from './types';

export type HeldLine = { mint: string; symbol: string; decimals: number };

export function usdcMintFor(
  network: NetworkStatus | null | undefined,
): string | null {
  if (network?.state !== 'known') return null;
  return usdcMintForCluster(network.cluster);
}

export function unitForMint(
  mint: string,
  lines: ReadonlyArray<HeldLine>,
  usdcMint: string | null,
): InputUnit | null {
  if (usdcMint !== null && mint === usdcMint)
    return { symbol: 'USDC', decimals: USDC_DECIMALS };
  const held = lines.find((line) => line.mint === mint);
  return held ? { symbol: held.symbol, decimals: held.decimals } : null;
}

export function inputUnitFor(
  bot: BotView,
  lines: ReadonlyArray<HeldLine>,
  usdcMint: string | null,
): InputUnit | null {
  return unitForMint(bot.scope.can.swap.inputMint, lines, usdcMint);
}

export function outputUnitFor(
  bot: BotView,
  lines: ReadonlyArray<HeldLine>,
  usdcMint: string | null,
): InputUnit | null {
  return unitForMint(bot.scope.can.swap.outputMint, lines, usdcMint);
}

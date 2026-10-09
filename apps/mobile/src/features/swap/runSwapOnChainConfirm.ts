import {
  confirmSwapOnChain,
  type ConfirmSwapOnChainResult,
  type StatusConnection,
} from '@/src/features/swap/confirmSwapOnChain';
import { SwapApiError } from '@/src/features/swap/swapApi';

export type SwapConfirmOnChain = (args: {
  connection: StatusConnection;
  signature: string;
  lastValidBlockHeight?: number | null;
}) => Promise<ConfirmSwapOnChainResult>;

export function mapConfirmFailureToError(
  confirmed: Extract<ConfirmSwapOnChainResult, { ok: false }>,
): SwapApiError {
  if (confirmed.reason === 'failed') {
    return new SwapApiError(
      'swap_failed_on_chain',
      'Swap failed on-chain after submit. It was not confirmed.',
    );
  }
  if (confirmed.reason === 'invalid_signature') {
    return new SwapApiError(
      'swap_confirm_invalid',
      'Swap provider returned an invalid signature.',
    );
  }
  return new SwapApiError(
    'swap_confirm_timeout',
    'Swap was submitted but not confirmed on-chain yet. Check Activity before retrying.',
  );
}

/**
 * Always awaits a confirmer (default: live RPC). Never short-circuits on a flag.
 */
export async function runSwapOnChainConfirm(args: {
  connection: StatusConnection;
  signature: string;
  lastValidBlockHeight?: number | null;
  confirmOnChain?: SwapConfirmOnChain;
}): Promise<'confirmed' | 'finalized'> {
  const confirm: SwapConfirmOnChain = args.confirmOnChain ?? confirmSwapOnChain;
  const confirmed = await confirm({
    connection: args.connection,
    signature: args.signature,
    lastValidBlockHeight: args.lastValidBlockHeight,
  });
  if (!confirmed.ok) {
    throw mapConfirmFailureToError(confirmed);
  }
  return confirmed.confirmationStatus;
}

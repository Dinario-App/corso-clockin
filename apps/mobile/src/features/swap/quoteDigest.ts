/**
 * Bind reviewed quote fields to the opaque provider transaction bytes.
 * Must match API `computeSwapQuoteDigest` field set.
 */
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import type { SwapOrderResponse } from '@/src/features/swap/swapApi';

export type QuoteDigestFields = Pick<
  SwapOrderResponse,
  | 'requestId'
  | 'transaction'
  | 'inputMint'
  | 'outputMint'
  | 'inAmount'
  | 'outAmount'
  | 'otherAmountThreshold'
  | 'corsoFeeBps'
  | 'quoteFeeBps'
  | 'feeMint'
  | 'platformFeeBps'
  | 'platformFeeAmount'
  | 'networkFeeLamports'
  | 'accountRentLamports'
  | 'positiveSlippageBps'
  | 'feeDestination'
  | 'referralAccount'
  | 'slippageBps'
  | 'lastValidBlockHeight'
  | 'expireAt'
  | 'instructionVersion'
>;

export function computeSwapQuoteDigest(fields: QuoteDigestFields): string {
  const payload = {
    requestId: fields.requestId,
    transaction: fields.transaction,
    inputMint: fields.inputMint,
    outputMint: fields.outputMint,
    inAmount: fields.inAmount,
    outAmount: fields.outAmount,
    otherAmountThreshold: fields.otherAmountThreshold,
    corsoFeeBps: fields.corsoFeeBps,
    quoteFeeBps: fields.quoteFeeBps,
    feeMint: fields.feeMint,
    platformFeeBps: fields.platformFeeBps,
    platformFeeAmount: fields.platformFeeAmount,
    networkFeeLamports: fields.networkFeeLamports,
    ...(fields.accountRentLamports !== undefined ? { accountRentLamports: fields.accountRentLamports } : {}),
    positiveSlippageBps: fields.positiveSlippageBps,
    feeDestination: fields.feeDestination,
    referralAccount: fields.referralAccount,
    slippageBps: fields.slippageBps,
    lastValidBlockHeight: fields.lastValidBlockHeight,
    expireAt: fields.expireAt,
    instructionVersion: fields.instructionVersion,
  };
  return bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(payload))));
}

export function assertSwapQuoteDigest(
  order: QuoteDigestFields & { quoteDigest?: string },
  expectedDigest: string,
): void {
  const actual = computeSwapQuoteDigest(order);
  if (actual !== expectedDigest) {
    throw new Error('Quote changed since review. Go back and quote again.');
  }
  if (order.quoteDigest && order.quoteDigest !== expectedDigest) {
    throw new Error('Quote binding from API does not match. Get a fresh quote.');
  }
}

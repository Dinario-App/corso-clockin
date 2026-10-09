import {
  type DetailsSnapshot,
  detailsWhyFrom,
  parseDetailsSnapshot,
  type ReviewWhyBlock,
} from '@corso/why';
import { WHY_TEMPLATE_VERSION } from '@/constants/copy/why';
import type { ReceiptSignedIntent } from './receiptPresentation';
import {
  receiptSnapshotEpoch,
  rememberReceiptIntent,
  saveReceiptSnapshot,
} from './receiptSnapshotStore';

type TradeIntent = Omit<
  ReceiptSignedIntent,
  | 'owner'
  | 'cluster'
  | 'pay'
  | 'receive'
  | 'status'
  | 'savedAtMs'
  | 'side'
  | 'networkFeeLamports'
  | 'accountRentLamports'
  | 'minReceivedAtomic'
> & {
  networkFeeLamports?: string | null;
  accountRentLamports?: string | null;
  /** The frozen quote's minimum received (Jupiter `otherAmountThreshold`). */
  otherAmountThreshold?: string | null;
};
export type ReceiptCapture = {
  epoch: number;
  bookEffect: string | null;
  quoteAgeSeconds: number | null;
  intent: Omit<ReceiptSignedIntent, 'status' | 'savedAtMs'>;
  details?: DetailsSnapshot | null;
};

export type ReceiptDetailsInput = {
  whyBlock: ReviewWhyBlock | null;
  minReceivedAtomic: string;
  maxSlippageBps: number | null;
};

export function buildDetailsSnapshot(args: {
  details: ReceiptDetailsInput;
  intent: Pick<TradeIntent, 'inAmount' | 'outAmount' | 'corsoFeeBps'>;
  pay: ReceiptSignedIntent['pay'];
  receive: ReceiptSignedIntent['receive'];
  side: 'buy' | 'sell';
}): DetailsSnapshot | null {
  try {
    const slippage = args.details.maxSlippageBps;
    const why = detailsWhyFrom(args.details.whyBlock);
    return parseDetailsSnapshot({
      schemaVersion: 1,
      ...(why.state === 'ready' ? { capturedAt: why.asOf } : {}),
      templateVersion: WHY_TEMPLATE_VERSION,
      side: args.side,
      quote: {
        pay: { ...args.pay },
        receive: { ...args.receive },
        payAtomic: args.intent.inAmount,
        receiveAtomic: args.intent.outAmount,
        minReceivedAtomic: args.details.minReceivedAtomic,
        feeBps: args.intent.corsoFeeBps,
        maxSlippageBps:
          slippage != null && Number.isSafeInteger(slippage) && slippage >= 0
            ? slippage
            : null,
      },
      why,
    });
  } catch {
    return null;
  }
}
/** The text the person read, bag then remainder. Empty means nothing to freeze. */
export function freezeSeenReview(
  bag: string | null | undefined,
  afterSale: string | null | undefined,
): string | null {
  const parts = [bag, afterSale].filter(
    (part): part is string => typeof part === 'string' && part.length > 0,
  );
  return parts.length === 0 ? null : parts.join('\n');
}

/** Memory only: copy exactly the Review explanation before calling Confirm.
 * No persistence, signer, network, price refresh, or gate lives here; the
 * disk write is `saveConfirmedReceipt`, after confirmation. */
export function captureReceiptReview(args: {
  intent: TradeIntent;
  pay: ReceiptSignedIntent['pay'];
  receive: ReceiptSignedIntent['receive'];
  owner: string;
  cluster: string | null;
  side: 'buy' | 'sell';
  bookEffect: string | null;
  appliedAtMs: number | null;
  nowMs: number;
  details?: ReceiptDetailsInput | null;
}): ReceiptCapture | null {
  if (!args.cluster) return null;
  const q = args.intent;
  return {
    ...(args.details
      ? {
          details: buildDetailsSnapshot({
            details: args.details,
            intent: q,
            pay: args.pay,
            receive: args.receive,
            side: args.side,
          }),
        }
      : {}),
    epoch: receiptSnapshotEpoch(),
    bookEffect: args.bookEffect,
    quoteAgeSeconds:
      args.appliedAtMs != null && args.appliedAtMs <= args.nowMs
        ? Math.floor((args.nowMs - args.appliedAtMs) / 1000)
        : null,
    intent: {
      owner: args.owner,
      cluster: args.cluster,
      pay: { ...args.pay },
      receive: { ...args.receive },
      side: args.side,
      inAmount: q.inAmount,
      outAmount: q.outAmount,
      corsoFeeBps: q.corsoFeeBps,
      platformFeeAmount: q.platformFeeAmount,
      feeMint: q.feeMint,
      feeDropped: q.feeDropped,
      priceImpactPct: q.priceImpactPct,
      networkFeeLamports: q.networkFeeLamports ?? null,
      accountRentLamports: q.accountRentLamports ?? null,
      minReceivedAtomic: q.otherAmountThreshold ?? null,
    },
  };
}
export async function saveConfirmedReceipt(
  result: { signature: string; confirmationStatus: string },
  capture: ReceiptCapture | null,
): Promise<void> {
  if (
    !capture ||
    !result.signature ||
    !['confirmed', 'finalized'].includes(result.confirmationStatus)
  )
    return;
  const savedAtMs = Date.now();
  const intent: ReceiptSignedIntent = {
    ...capture.intent,
    status:
      result.confirmationStatus === 'finalized' ? 'finalised' : 'confirmed',
    savedAtMs,
  };
  if (!rememberReceiptIntent(result.signature, intent, capture.epoch)) return;
  await saveReceiptSnapshot(
    result.signature,
    {
      bookEffect: capture.bookEffect,
      quoteAgeSeconds: capture.quoteAgeSeconds,
      savedAtMs,
      intent,
      ...(capture.details !== undefined ? { details: capture.details } : {}),
    },
    undefined,
    capture.epoch,
  );
}

/** Generic device diagnostic only; never log the signature or snapshot text. */
export function warnReceiptSnapshotFailure(): void {
  console.warn('Receipt snapshot could not be saved.');
}

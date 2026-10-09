import { copy } from '@/constants/copy';
import type { ReceiptModel } from '@/src/ui/ethena/receiptModel';
import { BALANCE_MASK, maskFiguresInline } from '@/src/ui/format/balanceMask';
import {
  formatAtomicAmount,
  feeBpsToPercentLabel,
} from '@/src/features/swap/tokens';
import {
  selectCommittedFeeDisplay,
  formatCommittedFeeDisplayValue,
} from '@/src/features/swap/swapCommittedFee';
import { formatFeeSol } from './formatActivityAmount';
import { formatSwapReviewPriceImpact } from '../swap/formatPriceImpact';
import type { ReceiptChainRecord } from './receiptChain';
import type { ReceiptSnapshot } from './receiptSnapshotStore';

export type ReceiptSignedIntent = {
  owner: string;
  cluster: string;
  pay: { mint: string; symbol: string; decimals: number };
  receive: { mint: string; symbol: string; decimals: number };
  inAmount: string;
  outAmount: string;
  corsoFeeBps: number;
  platformFeeAmount: string | null;
  feeMint: string | null;
  feeDropped: boolean;
  priceImpactPct: string | null;
  networkFeeLamports: string | null;
  accountRentLamports: string | null;
  minReceivedAtomic?: string | null;
  status: 'confirmed' | 'finalised';
  savedAtMs: number;
  side: 'buy' | 'sell';
};
function time(ms: number) {
  return new Date(ms).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
function short(value: string) {
  return value.length > 14 ? `${value.slice(0, 5)}…${value.slice(-5)}` : value;
}
/** No holdings, price feed or quote source enters this projection. Frozen text
 * comes only from the device record. Token units are not dollar valuations. */
export function presentReceipt({
  signature,
  intent,
  snapshot,
  chain,
  chainUnavailable = false,
  hideBalances = false,
}: {
  signature: string;
  intent: ReceiptSignedIntent | null;
  snapshot: ReceiptSnapshot | null;
  chain: ReceiptChainRecord | null;
  chainUnavailable?: boolean;
  hideBalances?: boolean;
}): ReceiptModel {
  const qty = (atomic: string, decimals: number) =>
    hideBalances ? BALANCE_MASK : formatAtomicAmount(atomic, decimals);
  const status =
    chain?.statusKnown === false && !intent
      ? undefined
      : chain?.status === 'failed'
        ? 'failed'
        : chain?.status === 'finalised' || intent?.status === 'finalised'
          ? 'finalised'
          : chain?.status === 'confirmed' || intent?.status === 'confirmed'
            ? 'confirmed'
            : chain?.status;
  const failed = status === 'failed';
  const chainLegs = chain?.legs ?? [];
  const unit = (mint: string) =>
    intent?.pay.mint === mint
      ? intent.pay.symbol
      : intent?.receive.mint === mint
        ? intent.receive.symbol
        : short(mint);
  const legText = (direction: 'in' | 'out') =>
    chainLegs
      .filter((l) => l.direction === direction)
      .map(
        (l) =>
          `${qty(l.amountAtomic, l.decimals)} ${unit(l.mint)}`,
      )
      .join(' + ');
  const chainPaid = legText('out'),
    chainKept = legText('in');
  const intentPaid = intent
    ? `${qty(intent.inAmount, intent.pay.decimals)} ${intent.pay.symbol}`
    : null;
  const intentKept = intent
    ? `${qty(intent.outAmount, intent.receive.decimals)} ${intent.receive.symbol}`
    : null;
  const paid = failed
    ? chain?.nothingTaken
      ? 'Nothing was taken'
      : 'Not established'
    : chainPaid ||
      (intentPaid
        ? copy.receipt.quotedAmount(intentPaid)
        : chainUnavailable
          ? ''
          : '…');
  const kept = failed
    ? null
    : chainKept || (intentKept ? copy.receipt.quotedAmount(intentKept) : null);
  const trade: { label: string; value: string; info?: boolean }[] = paid
    ? [{ label: 'You paid', value: paid }]
    : [];
  // Chain-only records cannot prove Corso's fee attribution. The signed intent
  // (memory, or its saved copy after a restart) carries the same committed
  // amount disclosed on Review; never derive it.
  if (intent && !failed) {
    const fee = selectCommittedFeeDisplay(intent, [intent.pay, intent.receive]);
    trade.push({
      label: `Corso fee · ${feeBpsToPercentLabel(intent.corsoFeeBps)}`,
      value: formatCommittedFeeDisplayValue(fee),
      info: true,
    });
  }
  if (chain?.networkFeeLamports != null)
    trade.push({
      label: 'Network fee',
      value: formatFeeSol(chain.networkFeeLamports),
    });
  else if (intent && !chain)
    trade.push({
      label: 'Impact · network',
      value: `Quoted impact: ${formatSwapReviewPriceImpact(intent.priceImpactPct, intent.side === 'sell' ? 'pay' : 'receive')} · Network: ${intent.networkFeeLamports ? `${formatAtomicAmount(intent.networkFeeLamports, 9)} SOL` : 'Unavailable'}`,
    });
  const side = intent?.side;
  const amount = failed
    ? '—'
    : side === 'sell' && kept
      ? `+${kept}`
      : paid === '…' || !paid
        ? paid
        : `−${paid}`;
  const at = chain?.timeMs ?? intent?.savedAtMs;
  const state =
    status === 'failed'
      ? "didn't go through"
      : status === 'sending'
        ? 'sending'
        : (status ?? (chainUnavailable ? '' : 'Loading'));
  const description = failed
    ? ''
    : side === 'sell' && intent
      ? `Sold ${paid}`
      : kept
        ? `${side === 'buy' ? 'Bought' : 'Received'} ${kept}`
        : '';
  const savedAt = snapshot?.bookEffect
    ? snapshot.savedAtMs
    : chainUnavailable && intent
      ? (snapshot?.savedAtMs ?? intent.savedAtMs)
      : null;
  return {
    amount,
    cents: '',
    sub: [description, at != null ? time(at) : '', state]
      .filter(Boolean)
      .join(' · '),
    coinGlyph: intent?.receive.symbol.slice(0, 1) ?? '↗',
    coinSymbol: intent?.receive.symbol ?? null,
    coinMint: intent?.receive.mint ?? null,
    trade,
    kept: kept ? { label: 'You kept', value: kept } : null,
    frozen:
      savedAt != null
        ? {
            heading: 'What I saw',
            note: `saved at ${time(savedAt)} · not updated`,
            body: hideBalances
              ? maskFiguresInline(snapshot?.bookEffect ?? '')
              : (snapshot?.bookEffect ?? ''),
            quoteLabel: 'Quote age',
            quoteValue:
              snapshot?.quoteAgeSeconds == null
                ? 'Unavailable'
                : `${snapshot.quoteAgeSeconds}s`,
          }
        : null,
    chain: signature
      ? { signature: short(signature), action: 'View record' }
      : null,
    done: 'Done',
  };
}

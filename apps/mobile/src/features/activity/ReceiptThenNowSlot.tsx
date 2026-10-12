import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { fetchPriceAt } from '@/src/features/balances/fetchPriceAt';
import { snapshotToQuoteMap } from '@/src/features/balances/priceSnapshot';
import {
  USDC_MINT_DEVNET,
  USDC_MINT_MAINNET,
} from '@/src/features/balances/usdcConstants';
import { loadPriceQuotes } from '@/src/features/balances/usePriceQuotes';
import { CorsoText } from '@/src/theme/CorsoText';
import { EthenaTray } from '@/src/ui/ethena/EthenaPrimitives';
import { freshQuote } from './activityFiat';
import type { ReceiptSignedIntent } from './receiptPresentation';
import type { ReviewUnitPrice } from './receiptSnapshotStore';
import {
  presentThenNow,
  reviewThen,
  thenNowToken,
  type PriceRead,
  type ThenNowView,
} from './receiptThenNow';

const STABLES: ReadonlySet<string> = new Set([
  USDC_MINT_MAINNET,
  USDC_MINT_DEVNET,
]);

const LOADING: PriceRead = { state: 'loading' };
const UNAVAILABLE: PriceRead = { state: 'unavailable' };

export function ReceiptThenNow({
  intent,
  review,
  tradeTimeMs,
  tradeTimeSettled,
}: {
  intent: Pick<ReceiptSignedIntent, 'side' | 'pay' | 'receive'> | null;
  review: ReviewUnitPrice | null | undefined;
  /** The chain's block time, else the saved time; `null` while unknown. */
  tradeTimeMs: number | null;
  /** True once the chain read has answered or failed. */
  tradeTimeSettled: boolean;
}) {
  const token = thenNowToken(intent, STABLES);
  const mint = token?.mint ?? null;
  const frozen = mint ? reviewThen(review, mint) : null;
  const hasFrozen = frozen !== null;
  const [history, setHistory] = useState<PriceRead>(LOADING);
  const [now, setNow] = useState<PriceRead>(LOADING);

  useEffect(() => {
    if (!mint || hasFrozen) return;
    if (tradeTimeMs === null) {
      setHistory(tradeTimeSettled ? UNAVAILABLE : LOADING);
      return;
    }
    const controller = new AbortController();
    setHistory(LOADING);
    void fetchPriceAt({
      mint,
      atMs: tradeTimeMs,
      signal: controller.signal,
    }).then((point) => {
      if (controller.signal.aborted) return;
      setHistory(point ? { state: 'ready', ...point } : UNAVAILABLE);
    });
    return () => controller.abort();
  }, [mint, hasFrozen, tradeTimeMs, tradeTimeSettled]);

  useEffect(() => {
    if (!mint) return;
    let cancelled = false;
    setNow(LOADING);
    void loadPriceQuotes({ mints: [mint] })
      .then((result) => {
        if (cancelled) return;
        const nowMs = Date.now();
        const quote = result.ok
          ? freshQuote(snapshotToQuoteMap(result.snapshot)[mint], mint, nowMs)
          : null;
        setNow(
          quote
            ? { state: 'ready', price: quote.price, asOfMs: quote.asOfMs }
            : UNAVAILABLE,
        );
      })
      .catch(() => {
        if (!cancelled) setNow(UNAVAILABLE);
      });
    return () => {
      cancelled = true;
    };
  }, [mint]);

  if (!token) return null;
  return (
    <ThenNowBlock
      view={presentThenNow({
        symbol: token.symbol,
        thenRead: frozen ? { state: 'ready', ...frozen } : history,
        nowRead: now,
        nowMs: Date.now(),
      })}
    />
  );
}

export function ThenNowBlock({ view }: { view: ThenNowView }) {
  return (
    <View testID="receipt-then-now" style={{ marginTop: 16 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          columnGap: 8,
          flexWrap: 'wrap',
          paddingHorizontal: ethenaGeometry.gutter,
          paddingBottom: 8,
        }}
      >
        <CorsoText
          testID="receipt-then-now-title"
          accessibilityRole="header"
          style={{ ...ETHENA_TYPE.section, color: ethena.ink.secondary }}
        >
          {view.heading}
        </CorsoText>
        <CorsoText
          testID="receipt-then-now-symbol"
          style={{ ...ETHENA_TYPE.rowSub, color: ethena.ink.tertiary }}
        >
          {view.symbol}
        </CorsoText>
      </View>
      <EthenaTray
        testID="receipt-then-now-rows"
        style={{ marginHorizontal: ethenaGeometry.gutter, paddingVertical: 8 }}
      >
        {view.rows.map((row) => (
          <View
            key={row.key}
            testID={`receipt-then-now-${row.key}`}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              columnGap: 12,
              flexWrap: 'wrap',
              paddingVertical: 6,
            }}
          >
            <CorsoText
              style={{ ...ETHENA_TYPE.rowSub, color: ethena.ink.secondary }}
            >
              {row.label}
            </CorsoText>
            <CorsoText
              style={{
                ...ETHENA_TYPE.rowSub,
                color: ethena.ink.secondary,
                fontVariant: ['tabular-nums'],
              }}
            >
              {row.value}
            </CorsoText>
          </View>
        ))}
      </EthenaTray>
    </View>
  );
}

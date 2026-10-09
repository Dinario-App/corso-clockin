import { useEffect, useMemo, useState } from 'react';
import { buildSwapReviewFactsPanel } from '@/src/features/tokenFacts/formatTokenFactsDisplay';
import { TokenFactsPanel } from '@/src/features/tokenFacts/TokenFactsPanel';
import type { TokenFactsState } from '@/src/features/tokenFacts/useTokenFacts';

export function SwapReviewTokenFacts({
  state,
  title,
  receiveAmountAtomic,
  receiveDecimals,
}: {
  state: Pick<TokenFactsState, 'status' | 'facts' | 'error'>;
  title?: string;
  receiveAmountAtomic?: bigint | string | null;
  receiveDecimals?: number | null;
}) {
  const { status, facts, error } = state;
  const [nowMs, setNowMs] = useState(Date.now);
  useEffect(() => {
    // Freshness can expire while Review remains open; re-project without fetching.
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const model = useMemo(
    () =>
      buildSwapReviewFactsPanel({
        status,
        facts,
        error,
        nowMs,
        receiveAmountAtomic,
        receiveDecimals,
        collapseAbsence: true,
      }),
    [status, facts, error, nowMs, receiveAmountAtomic, receiveDecimals],
  );

  return <TokenFactsPanel model={model} title={title} />;
}

import { selectedDiyList } from './diyWatchlistModel';
import { useDiyListPrices } from './loadDiyListPrices';
import {
  linesFromPriceSnapshot,
  presentReviewWatchlist,
} from './presentReviewWatchlist';
import { ReviewWatchlistSlot } from './ReviewWatchlistSlot';
import { useDiyWatchlists } from './watchlistStore';

/**
 * The selected list on Review. Buy and sell mount this once. The sheet is
 * read-only: adding and renaming live on token detail. One batched price
 * read, no timer. The slot receives the model.
 */
export function ReviewWatchlistMount() {
  const runtime = useDiyWatchlists();
  const selected = selectedDiyList(runtime.data);
  const prices = useDiyListPrices(
    selected?.tokens.map((token) => token.mint) ?? [],
  );
  const model = presentReviewWatchlist({
    side: 'buy',
    hydrated: runtime.hydrated,
    loadError: runtime.loadError,
    data: runtime.data,
    batch: prices.status,
    lines: linesFromPriceSnapshot(prices.snapshot),
    nowMs: Date.now(),
  });

  return <ReviewWatchlistSlot model={model} />;
}

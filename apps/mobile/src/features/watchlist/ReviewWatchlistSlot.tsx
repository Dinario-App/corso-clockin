import { View } from 'react-native';
import type { ReviewWatchlistModel } from './presentReviewWatchlist';
import { ReviewWatchlistView } from './ReviewWatchlistView';

/**
 * Presentational list on Review. The parent passes the model.
 */
export type ReviewWatchlistSlotProps = {
  model: ReviewWatchlistModel;
};

export function ReviewWatchlistSlot({ model }: ReviewWatchlistSlotProps) {
  return (
    <View testID="review-watchlist-slot">
      <ReviewWatchlistView model={model} />
    </View>
  );
}

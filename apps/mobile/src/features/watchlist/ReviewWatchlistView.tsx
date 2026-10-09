import { View } from 'react-native';
import { CorsoText } from '@/src/theme/CorsoText';
import { copy } from '@/constants/copy';
import { ethena } from '@/constants/theme.ethena';
import { ETHENA_BODY_MARGIN, ETHENA_TYPE } from '@/constants/theme.ethenaType';
import type { ReviewWatchlistModel } from './presentReviewWatchlist';

/** Presentational. The price string and the clock are the model's. */
export function ReviewWatchlistView({
  model,
}: {
  model: ReviewWatchlistModel;
}) {
  return (
    <View testID="review-watchlist" style={{ marginTop: ETHENA_BODY_MARGIN }}>
      <CorsoText
        testID="review-watchlist-title"
        style={{
          ...ETHENA_TYPE.cardHeading,
          color: ethena.ink.primary,
        }}
      >
        {model.kind === 'list' ? model.name : model.title}
      </CorsoText>
      {model.kind === 'loading' ? (
        <CorsoText
          testID="review-watchlist-loading"
          style={{
            ...ETHENA_TYPE.rowSub,
            color: ethena.ink.secondary,
            marginTop: 8,
          }}
        >
          {copy.diyLists.reading}
        </CorsoText>
      ) : null}
      {model.kind === 'empty' || model.kind === 'error' ? (
        <CorsoText
          testID={
            model.kind === 'error'
              ? 'review-watchlist-error'
              : 'review-watchlist-empty'
          }
          style={{
            ...ETHENA_TYPE.rowSub,
            color: ethena.ink.secondary,
            marginTop: 8,
          }}
        >
          {model.body}
        </CorsoText>
      ) : null}
      {model.kind === 'list' && model.banner ? (
        <CorsoText
          testID="review-watchlist-banner"
          style={{
            ...ETHENA_TYPE.rowSub,
            color: ethena.ink.secondary,
            marginTop: 8,
          }}
        >
          {model.banner}
        </CorsoText>
      ) : null}
      {model.kind === 'list'
        ? model.rows.map((row) => {
            const figure = row.priceLabel ?? row.statusLabel;
            return (
              <View
                key={row.mint}
                testID={`review-watchlist-row-${row.mint}`}
                accessibilityLabel={row.accessibilityLabel}
                style={{ marginTop: 8 }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <CorsoText
                    style={{ ...ETHENA_TYPE.body, color: ethena.ink.primary }}
                  >
                    {row.symbol}
                  </CorsoText>
                  {figure ? (
                    <CorsoText
                      testID={`review-watchlist-price-${row.mint}`}
                      style={{
                        ...ETHENA_TYPE.body,
                        color: ethena.ink.secondary,
                      }}
                    >
                      {figure}
                    </CorsoText>
                  ) : null}
                </View>
                {row.asOfLabel ? (
                  <CorsoText
                    testID={`review-watchlist-asof-${row.mint}`}
                    style={{
                      ...ETHENA_TYPE.rowSub,
                      color: ethena.ink.secondary,
                      textAlign: 'right',
                    }}
                  >
                    {row.asOfLabel}
                  </CorsoText>
                ) : null}
              </View>
            );
          })
        : null}
    </View>
  );
}

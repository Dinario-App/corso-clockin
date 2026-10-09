import { View } from 'react-native';
import type { ReactNode } from 'react';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { readDeskBuildFlag } from '@/src/features/desk/deskEnv';
import {
  presentBrokerReview,
  presentHolding,
} from '@/src/features/desk/holdingSplit';
import {
  showBackpackShelf,
  type ShelfSignals,
} from '@/src/features/desk/showBackpackShelf';
import { CorsoText } from '@/src/theme/CorsoText';

export function deskBrokerPreviewNode(signals?: ShelfSignals): ReactNode {
  if (!readDeskBuildFlag() || !showBackpackShelf(signals)) return null;
  const holding = presentHolding('broker-entitlement');
  const review = presentBrokerReview();
  if (holding == null) return null;
  return (
    <View
      testID="desk-broker-preview"
      style={{ gap: ethenaGeometry.gap, paddingTop: ethenaGeometry.gap }}
    >
      <CorsoText
        style={{ ...ETHENA_TYPE.eyebrow, color: ethena.ink.secondary }}
      >
        {holding.header}
      </CorsoText>
      <CorsoText style={{ ...ETHENA_TYPE.rowName, color: ethena.ink.primary }}>
        {holding.label}
      </CorsoText>
      <CorsoText
        style={{ ...ETHENA_TYPE.eyebrow, color: ethena.ink.secondary }}
      >
        {review.symbol}
      </CorsoText>
      <CorsoText
        style={{ ...ETHENA_TYPE.eyebrow, color: ethena.ink.secondary }}
      >
        {holding.subtitle}
      </CorsoText>
      <CorsoText
        style={{ ...ETHENA_TYPE.eyebrow, color: ethena.ink.secondary }}
      >
        {holding.explainer}
      </CorsoText>
      <CorsoText
        style={{ ...ETHENA_TYPE.eyebrow, color: ethena.ink.secondary }}
      >
        {holding.freshness}
      </CorsoText>
      {review.rows.map((row) => (
        <View key={row.label}>
          <CorsoText
            style={{ ...ETHENA_TYPE.eyebrow, color: ethena.ink.secondary }}
          >
            {row.label}
          </CorsoText>
          <CorsoText
            style={{ ...ETHENA_TYPE.rowName, color: ethena.ink.primary }}
          >
            {row.value}
          </CorsoText>
        </View>
      ))}
      <CorsoText
        style={{ ...ETHENA_TYPE.eyebrow, color: ethena.ink.secondary }}
      >
        {review.priceCaption}
      </CorsoText>
      <View testID="desk-broker-review-action">
        <CorsoText
          style={{ ...ETHENA_TYPE.rowName, color: ethena.ink.secondary }}
        >
          {review.action.label}
        </CorsoText>
        <CorsoText
          style={{ ...ETHENA_TYPE.eyebrow, color: ethena.ink.secondary }}
        >
          {review.action.availability}
        </CorsoText>
      </View>
      <CorsoText
        style={{ ...ETHENA_TYPE.eyebrow, color: ethena.ink.secondary }}
      >
        {review.footer}
      </CorsoText>
    </View>
  );
}

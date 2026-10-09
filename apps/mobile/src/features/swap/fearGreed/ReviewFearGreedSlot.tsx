import { View } from 'react-native';
import { copy } from '@/constants/copy';
import { CorsoText } from '@/src/theme/CorsoText';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_BODY_MARGIN, ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { presentFearGreedChip } from './presentFearGreedChip';
import { useFearGreed } from './useFearGreed';

/**
 * Review mood chip. Missing or stale data returns nothing, footer included.
 * The label is the value plus the micro vendor name. The quiet line under it
 * is the one shared Review footer (`copy.reviewReads.footer`), not a
 * per-chip essay. Never a Sign input.
 */
export function ReviewFearGreedSlot() {
  const chip = presentFearGreedChip(useFearGreed());
  if (!chip) return null;
  return (
    <View
      testID="ethena-review-chips"
      style={{
        marginHorizontal: ethenaGeometry.gutter,
        marginTop: ethenaGeometry.gap,
      }}
    >
      <CorsoText
        testID="ethena-review-chip-sentiment"
        style={{ ...ETHENA_TYPE.body, color: ethena.ink.secondary }}
      >
        {chip.label}
      </CorsoText>
      <CorsoText
        testID="ethena-review-chip-freshness"
        style={{ ...ETHENA_TYPE.body, color: ethena.ink.secondary }}
      >
        {chip.freshness}
      </CorsoText>
      <CorsoText
        testID="ethena-review-reads-footer"
        style={{
          ...ETHENA_TYPE.rowSub,
          color: ethena.ink.tertiary,
          marginTop: ETHENA_BODY_MARGIN,
        }}
      >
        {copy.reviewReads.footer}
      </CorsoText>
    </View>
  );
}

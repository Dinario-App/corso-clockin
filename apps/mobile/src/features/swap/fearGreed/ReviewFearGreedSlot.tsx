import { View } from 'react-native';
import { copy } from '@/constants/copy';
import { CorsoText } from '@/src/theme/CorsoText';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_BODY_MARGIN, ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { presentFearGreedChip } from './presentFearGreedChip';
import { useFearGreed } from './useFearGreed';

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

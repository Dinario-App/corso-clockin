import { View } from 'react-native';
import { CorsoText } from '@/src/theme/CorsoText';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { presentFundingOiChip } from './presentFundingOiChip';
import { useFundingOi } from './useFundingOi';

/**
 * Review funding / open-interest chip. Renders nothing when the venue
 * read is missing or stale. The venue name sits next to the number.
 * Never a Sign input.
 */
export function ReviewFundingOiSlot({
  payMint,
  receiveMint,
}: {
  payMint?: string | null;
  receiveMint?: string | null;
}) {
  const chip = presentFundingOiChip(useFundingOi({ payMint, receiveMint }));
  if (!chip) return null;
  return (
    <View
      testID="ethena-review-funding"
      style={{
        marginHorizontal: ethenaGeometry.gutter,
        marginTop: ethenaGeometry.gap,
      }}
    >
      <CorsoText
        testID="ethena-review-chip-funding"
        style={{ ...ETHENA_TYPE.body, color: ethena.ink.secondary }}
      >
        {chip.label}
      </CorsoText>
      <CorsoText
        testID="ethena-review-chip-funding-freshness"
        style={{ ...ETHENA_TYPE.body, color: ethena.ink.secondary }}
      >
        {chip.freshness}
      </CorsoText>
    </View>
  );
}

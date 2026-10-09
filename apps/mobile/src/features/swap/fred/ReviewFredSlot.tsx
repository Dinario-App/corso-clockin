import { View } from 'react-native';
import { CorsoText } from '@/src/theme/CorsoText';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_BODY_MARGIN, ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { presentFredChip } from './presentFredChip';
import { useFred } from './useFred';

/**
 * Review macro chip. Missing or stale data returns null, and the FRED
 * notice leaves with it. One micro line for the rate, one for the notice.
 * Never a Sign input.
 */
export function ReviewFredSlot() {
  const chip = presentFredChip(useFred());
  if (!chip) return null;
  return (
    <View
      testID="ethena-review-fred"
      style={{
        marginHorizontal: ethenaGeometry.gutter,
        marginTop: ETHENA_BODY_MARGIN,
      }}
    >
      <CorsoText
        testID="ethena-review-fred-label"
        style={{ ...ETHENA_TYPE.rowSub, color: ethena.ink.secondary }}
      >
        {`${chip.label} · ${chip.freshness}`}
      </CorsoText>
      <CorsoText
        testID="ethena-review-fred-notice"
        style={{ ...ETHENA_TYPE.rowSub, color: ethena.ink.tertiary }}
      >
        {chip.notice}
      </CorsoText>
    </View>
  );
}

import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import { ethena } from '@/constants/theme.ethena';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { CorsoText } from '@/src/theme/CorsoText';
import { useConnectivity } from './useConnectivity';

export function OfflineBanner() {
  const connectivity = useConnectivity();
  const insets = useSafeAreaInsets();
  if (connectivity !== 'offline') return null;
  return (
    <View
      style={[styles.strip, { paddingTop: insets.top + 6 }]}
      accessibilityLiveRegion="polite"
      testID="offline-banner"
    >
      <CorsoText style={styles.label} numberOfLines={1}>
        {copy.connectivity.offlineBanner}
      </CorsoText>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    paddingBottom: 6,
    paddingHorizontal: ethenaGeometry.gutter,
    backgroundColor: ethena.void,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ethena.hair,
    alignItems: 'center',
  },
  label: {
    ...ETHENA_TYPE.rowSub,
    color: ethena.ink.secondary,
  },
});

import { StyleSheet, View } from 'react-native';
import { copy } from '@/constants/copy';
import { ethena } from '@/constants/theme.ethena';
import { LOCKED_GROUND_PARI_BOX } from '@/src/features/lock/lockedGroundPresentation';
import { PariMark } from '@/src/ui/brand/PariMark';

export function LockedGround({ testID }: { testID?: string }) {
  return (
    <View pointerEvents="none" style={styles.ground} testID={testID}>
      <PariMark
        size={LOCKED_GROUND_PARI_BOX}
        accessible
        accessibilityRole="header"
        accessibilityLabel={copy.lock.prompt}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ground: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: ethena.void,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import { Pressable, View } from 'react-native';
import { ethena } from '@/constants/theme.ethena';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon';
import type { CorsoIconName } from '@/src/ui/icons/corsoIconNames';
import { resolveEthenaMaterial } from '@/src/ui/ethena/materialLaw';

const DISC = 40;
const TARGET = 44;
const GLYPH = 20;

export function SleeveDisc({
  glyph,
  onPress,
  accessibilityLabel,
  testID,
}: {
  glyph: CorsoIconName;
  onPress: () => void;
  accessibilityLabel: string;
  testID: string;
}) {
  const material = resolveEthenaMaterial('ground');
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={{
        width: TARGET,
        height: TARGET,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: DISC,
          height: DISC,
          borderRadius: DISC / 2,
          backgroundColor: material.fill as string,
          borderWidth: material.borderWidth,
          borderColor: material.borderColor ?? undefined,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CorsoIcon name={glyph} size={GLYPH} color={ethena.ink.primary} />
      </View>
    </Pressable>
  );
}

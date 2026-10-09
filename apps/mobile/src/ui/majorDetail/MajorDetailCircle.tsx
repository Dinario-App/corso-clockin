import type { Ref } from 'react';
import { Pressable, View } from 'react-native';
import { ethena } from '@/constants/theme.ethena';
import { resolveEthenaMaterial } from '@/src/ui/ethena/materialLaw';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon';
import type { CorsoIconName } from '@/src/ui/icons/corsoIconNames';

const DISC = 40;
/** The disc draws at 40 and still answers a 44 press target. */
const HIT_SLOP = (44 - DISC) / 2;
const GLYPH = 20;

export function MajorDetailCircle({
  glyph,
  onPress,
  accessibilityLabel,
  testID,
  ref,
}: {
  glyph: CorsoIconName;
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
  ref?: Ref<View>;
}) {
  const material = resolveEthenaMaterial('ground');
  return (
    <Pressable
      ref={ref}
      testID={testID}
      onPress={onPress}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        width: DISC,
        height: DISC,
        borderRadius: DISC / 2,
        backgroundColor: material.fill as string,
        borderWidth: material.borderWidth,
        borderColor: material.borderColor ?? undefined,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <CorsoIcon name={glyph} size={GLYPH} color={ethena.ink.primary} />
    </Pressable>
  );
}

import type { ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { CorsoText } from '@/src/theme/CorsoText';
import { CANON_TYPE_SIZES, canonWeight } from '@/src/ui/cards/canonType';
import { useEthenaMaterial } from '@/src/ui/ethena/useEthenaMaterial';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon';
import type { CorsoIconName } from '@/src/ui/icons/corsoIconNames';
import { colors, radii, spacing, typography } from '@/src/ui/tokens';

export type AccountActionButtonProps = {
  label: string;
  glyph: CorsoIconName;
  onPress: () => void;
  /** `.act.copied` — a real confirmation, so `--up` is earned here. */
  confirmed?: boolean;
  testID?: string;
};

export type AccountActionPairProps = {
  children: ReactNode;
  style?: ViewStyle;
  testID?: string;
};

export function AccountActionPair({
  children,
  style,
  testID,
}: AccountActionPairProps) {
  return (
    <View style={[styles.row, style]} testID={testID}>
      {children}
    </View>
  );
}

export function AccountActionButton({
  label,
  glyph,
  onPress,
  confirmed,
  testID,
}: AccountActionButtonProps) {
  // At render, so the rim answers Increase Contrast.
  const material = useEthenaMaterial('ground');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.hit}
      testID={testID}
    >
      <View
        style={[
          styles.act,
          {
            backgroundColor: String(material.fill),
            borderRadius: radii.cta,
            borderWidth: material.borderWidth,
            borderColor: material.borderColor ?? undefined,
          },
        ]}
      >
        <CorsoIcon
          name={confirmed ? 'check' : glyph}
          size={15}
          color={confirmed ? colors.priceUp : colors.inkTertiary}
        />
        <CorsoText
          style={[styles.label, confirmed ? styles.labelConfirmed : null]}
          numberOfLines={1}
        >
          {label}
        </CorsoText>
      </View>
    </Pressable>
  );
}

const styles = {
  /** `.rc-actions{display:flex;gap:8px}` */
  row: { flexDirection: 'row', gap: spacing.sm } as ViewStyle,
  hit: { flex: 1 } as ViewStyle,
  act: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: spacing.smd,
  } as ViewStyle,
  label: {
    color: colors.inkSecondary,
    fontSize: CANON_TYPE_SIZES.rowLabel,
    lineHeight: 18,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
  },
  labelConfirmed: {
    color: colors.priceUp,
    fontFamily: typography.face('600'),
    fontWeight: canonWeight('600'),
  },
} as const;

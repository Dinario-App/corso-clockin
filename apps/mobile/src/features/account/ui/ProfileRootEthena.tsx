import type { ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { ethena } from '@/constants/theme.ethena';
import { CorsoText } from '@/src/theme/CorsoText';
import { EthenaTray } from '@/src/ui/ethena/EthenaPrimitives';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon';
import type { CorsoIconName } from '@/src/ui/icons/corsoIconNames';
import {
  PROFILE_ROOT_PANE_BASE,
  PROFILE_ROW,
  PROFILE_WELL,
  profileRootType,
} from './profileRootPaint';

export * from './profileRootPaint';

/* ─── Pane ────────────────────────────────────────────────────────────────── */

/**
 * A ground-tray pane. The rows carry their own 14 inset, so the pane has none:
 * `EthenaTray`'s default horizontal pad is zeroed here.
 */
export function ProfileRootPane({
  testID,
  style,
  children,
}: {
  testID: string;
  style?: ViewStyle;
  children?: ReactNode;
}) {
  return (
    <EthenaTray testID={testID} style={{ ...PROFILE_ROOT_PANE_BASE, ...style }}>
      {children}
    </EthenaTray>
  );
}

/* ─── Section heading ─────────────────────────────────────────────────────── */

export function ProfileRootHeading({ label }: { label: string }) {
  return (
    <CorsoText accessibilityRole="header" style={profileRootType.heading}>
      {label}
    </CorsoText>
  );
}

/* ─── Row ─────────────────────────────────────────────────────────────────── */

function clean(value: string | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export type ProfileRootRowProps = {
  glyph: CorsoIconName;
  label: string;
  sub?: string;
  /** Right-hand read, drawn before the chevron (the name row's `My money`). */
  value?: string;
  accessory: 'chevron' | 'none';
  disabled?: boolean;
  /** Last row in its pane: no hairline under it. */
  last?: boolean;
  onPress: () => void;
  testID: string;
};

export function ProfileRootRow({
  glyph,
  label,
  sub,
  value,
  accessory,
  disabled = false,
  last = false,
  onPress,
  testID,
}: ProfileRootRowProps) {
  const labelText = clean(label) ?? '';
  const subText = clean(sub);
  const valueText = clean(value);
  const spoken = [labelText, subText, valueText]
    .filter((part): part is string => Boolean(part))
    .join(', ');

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityState={{ disabled }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: PROFILE_ROW.gap,
        paddingVertical: PROFILE_ROW.padV,
        paddingHorizontal: PROFILE_ROW.padH,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: ethena.hair,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <View
        accessible={false}
        style={{
          width: PROFILE_WELL,
          height: PROFILE_WELL,
          borderRadius: PROFILE_ROW.wellRadius,
          backgroundColor: ethena.crest,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <CorsoIcon
          name={glyph}
          size={PROFILE_ROW.wellGlyph}
          color={ethena.mute}
        />
      </View>
      <View accessible={false} style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <CorsoText style={profileRootType.rowLabel} numberOfLines={2}>
          {labelText}
        </CorsoText>
        {subText ? (
          <CorsoText style={profileRootType.rowSub}>{subText}</CorsoText>
        ) : null}
      </View>
      {valueText ? (
        <CorsoText style={profileRootType.rowValue} numberOfLines={2}>
          {valueText}
        </CorsoText>
      ) : null}
      {accessory === 'chevron' ? (
        <CorsoIcon
          name="chevron-right"
          size={PROFILE_ROW.chevron}
          color={ethena.ink3}
        />
      ) : null}
    </Pressable>
  );
}

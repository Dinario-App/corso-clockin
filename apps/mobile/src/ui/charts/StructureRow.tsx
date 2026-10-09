import { useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { CorsoText } from '@/src/theme/CorsoText';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon';
import { MIN_TAP_TARGET_PT } from '@/src/ui/primitives/tapTargetPresentation';
import { colors, kitWeight, typography } from '@/src/ui/tokens';
import {
  STRUCTURE_ROW as R,
  STRUCTURE_ROW_COPY,
  type StructureRowPresentation,
} from './structureRowPresentation';

export type ChartKitRowProps = {
  label: string;
  value?: string | null;
  onPress?: () => void;
  open?: boolean;
  accessibilityLabel?: string;
  accessibilityState?: { expanded?: boolean };
  testID?: string;
};

export function ChartKitRow({
  label,
  value,
  onPress,
  open = false,
  accessibilityLabel,
  accessibilityState,
  testID,
}: ChartKitRowProps) {
  const spoken =
    accessibilityLabel ?? (value ? `${label}, ${value}` : label);
  return (
    <Pressable
      onPress={onPress}
      disabled={onPress == null}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityState={accessibilityState}
      style={styles.face}
      testID={testID}
    >
      <CorsoText style={styles.label} numberOfLines={1}>
        {label}
      </CorsoText>
      {value ? (
        <CorsoText style={styles.value} numberOfLines={1}>
          {value}
        </CorsoText>
      ) : null}
      <CorsoIcon
        name="chevron-right"
        size={R.chevronSize}
        color={colors.inkQuaternary}
        style={open ? styles.chevronOpen : undefined}
      />
    </Pressable>
  );
}

export type StructureRowFace = {
  render: (face: {
    label: string;
    value: string | null;
    open: boolean;
    onToggle: () => void;
    accessibilityLabel: string;
    testID?: string;
  }) => ReactNode;
  style?: StyleProp<ViewStyle>;
  openStyle?: StyleProp<ViewStyle>;
};

export type StructureRowProps = {
  /** `false` when the fullChart guard is shut: render nothing, fetch nothing. */
  enabled: boolean;
  presentation: StructureRowPresentation | null;
  onOpenTerminal?: () => void;
  face?: StructureRowFace;
  testID?: string;
};

export function StructureRow({
  enabled,
  presentation,
  onOpenTerminal,
  face,
  testID,
}: StructureRowProps) {
  const [open, setOpen] = useState(false);
  if (!enabled || presentation == null) return null;
  const faceTestID = testID ? `${testID}-face` : undefined;

  return (
    <View
      testID={testID}
      style={
        face == null
          ? styles.wrap
          : open
            ? (face.openStyle ?? face.style)
            : face.style
      }
    >
      {face ? (
        face.render({
          label: STRUCTURE_ROW_COPY.face,
          value: presentation.headline,
          open,
          onToggle: () => setOpen((value) => !value),
          accessibilityLabel: presentation.accessibilityLabel,
          testID: faceTestID,
        })
      ) : (
        <ChartKitRow
          label={STRUCTURE_ROW_COPY.face}
          value={presentation.headline}
          open={open}
          onPress={() => setOpen((value) => !value)}
          accessibilityLabel={presentation.accessibilityLabel}
          accessibilityState={{ expanded: open }}
          testID={faceTestID}
        />
      )}
      {presentation.scoreCaption ? (
        <CorsoText style={styles.scoreCaption}>
          {presentation.scoreCaption}
        </CorsoText>
      ) : null}
      {open ? (
        <View testID={testID ? `${testID}-open` : undefined}>
          {presentation.lines.map((line) => (
            <View
              key={line.key}
              style={styles.line}
              accessible
              accessibilityRole="text"
              accessibilityLabel={`${line.label} ${line.value}`}
            >
              <CorsoText style={styles.lineLabel} numberOfLines={1}>
                {line.label}
              </CorsoText>
              <CorsoText style={styles.lineValue} numberOfLines={1}>
                {line.value}
              </CorsoText>
            </View>
          ))}
          {presentation.caveat ? (
            <CorsoText style={styles.caveat}>{presentation.caveat}</CorsoText>
          ) : null}
          {presentation.showOpenTerminal && onOpenTerminal ? (
            <ChartKitRow
              label={STRUCTURE_ROW_COPY.openTerminal}
              onPress={onOpenTerminal}
              accessibilityLabel={STRUCTURE_ROW_COPY.openTerminal}
              testID={testID ? `${testID}-terminal` : undefined}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: R.faceGap },
  face: {
    minHeight: MIN_TAP_TARGET_PT,
    height: R.height,
    flexDirection: 'row',
    alignItems: 'center',
    gap: R.gap,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  label: {
    flex: 1,
    color: colors.ink,
    fontSize: R.labelSize,
    fontFamily: typography.face(kitWeight.regular),
  },
  value: {
    flexShrink: 1,
    color: colors.inkSecondary,
    fontSize: R.valueSize,
    fontFamily: typography.face(kitWeight.regular),
    fontVariant: [...typography.fontVariantTabular],
  },
  scoreCaption: {
    paddingBottom: 8,
    color: colors.inkTertiary,
    fontSize: R.caveatSize,
    lineHeight: R.caveatLineHeight,
    fontFamily: typography.face(kitWeight.regular),
  },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  line: {
    minHeight: R.height,
    height: R.height,
    flexDirection: 'row',
    alignItems: 'center',
    gap: R.gap,
  },
  lineLabel: {
    flex: 1,
    color: colors.ink,
    fontSize: R.labelSize,
    fontFamily: typography.face(kitWeight.regular),
  },
  lineValue: {
    flexShrink: 1,
    color: colors.inkSecondary,
    fontSize: R.valueSize,
    fontFamily: typography.face(kitWeight.regular),
    fontVariant: [...typography.fontVariantTabular],
  },
  caveat: {
    paddingVertical: 8,
    color: colors.inkTertiary,
    fontSize: R.caveatSize,
    lineHeight: R.caveatLineHeight,
    fontFamily: typography.face(kitWeight.regular),
  },
});

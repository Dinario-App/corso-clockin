import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { CorsoText } from '@/src/theme/CorsoText';
import { Material } from '@/src/ui/glass/Material';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon';
import { HorizontalEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { SCROLL_FADE_CHIPS_STOP } from '@/src/ui/primitives/scrollEdgeFadePresentation';
import { colors, typography } from '@/src/ui/tokens';
import { COMPOSER_DOCK_SCRIM_BASE } from './composerPresentation';
import {
  QUICK_ACTION_CHIP_PADDING_HORIZONTAL,
  QUICK_ACTION_GAP,
  QUICK_ACTION_HEIGHT,
  QUICK_ACTION_ICON,
  QUICK_ACTION_LABEL,
  QUICK_ACTION_RADIUS,
  QUICK_ACTION_ROW_PADDING_HORIZONTAL,
  QUICK_ACTION_ROW_PADDING_VERTICAL,
  resolveQuickActionInk,
  resolveQuickActions,
  type QuickAction,
  type QuickActionCopy,
} from './quickActionsPresentation';

export type QuickActionRowProps = {
  copy: QuickActionCopy;
  /** Write an example into the ask field. The chip never sends. */
  onFill: (text: string) => void;
  /** The Skills marketplace door. Absent → no Skills chip. */
  onSkills?: () => void;
  /**
   * The rules/bots lane is served. Fail-closed: omitted → no "Set a rule"
   * chip, because v1 answers that question with a refusal.
   */
  rulesEnabled?: boolean;
  disabled?: boolean;
  testID?: string;
};

export function QuickActionRow({
  copy,
  onFill,
  onSkills,
  rulesEnabled = false,
  disabled = false,
  testID,
}: QuickActionRowProps) {
  const actions = resolveQuickActions({
    copy,
    canOpenSkills: onSkills != null,
    canSetRules: rulesEnabled,
  });

  return (
    <View style={styles.wrap} testID={testID}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={styles.row}
        accessibilityRole="toolbar"
        accessibilityLabel={copy.groupA11y}
      >
        {actions.map((action) => (
          <Chip
            key={action.id}
            action={action}
            disabled={disabled}
            onPress={() => {
              if (action.kind === 'route') {
                onSkills?.();
                return;
              }
              if (action.fill !== null) onFill(action.fill);
            }}
            testID={testID ? `${testID}-${action.id}` : undefined}
          />
        ))}
      </ScrollView>
      <HorizontalEdgeFade
        stop={SCROLL_FADE_CHIPS_STOP}
        color={COMPOSER_DOCK_SCRIM_BASE}
      />
    </View>
  );
}

function Chip({
  action,
  disabled,
  onPress,
  testID,
}: {
  action: QuickAction;
  disabled: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const ink = resolveQuickActionInk({ ink: colors.ink });

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={action.accessibilityLabel}
      accessibilityHint={action.accessibilityHint ?? undefined}
      accessibilityState={{ disabled }}
      style={styles.chipHit}
      testID={testID}
    >
      {({ pressed }) => (
        <Material
          weight="chip"
          state={pressed ? 'hi' : 'rest'}
          radius={QUICK_ACTION_RADIUS}
          contentStyle={styles.chip}
          hug
        >
          <CorsoIcon
            name={action.glyph}
            size={QUICK_ACTION_ICON}
            color={ink.glyph}
          />
          <CorsoText style={[styles.label, { color: ink.label }]}>
            {action.label}
          </CorsoText>
        </Material>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  chipHit: { flexGrow: 0, flexShrink: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: QUICK_ACTION_GAP,
    paddingVertical: QUICK_ACTION_ROW_PADDING_VERTICAL,
    paddingHorizontal: QUICK_ACTION_ROW_PADDING_HORIZONTAL,
  },
  chip: {
    height: QUICK_ACTION_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: QUICK_ACTION_GAP,
    paddingHorizontal: QUICK_ACTION_CHIP_PADDING_HORIZONTAL,
  },
  label: {
    fontSize: QUICK_ACTION_LABEL.fontSize,
    fontFamily: typography.face(QUICK_ACTION_LABEL.fontWeight),
    fontWeight: QUICK_ACTION_LABEL.fontWeight,
  },
});

import { Pressable, StyleSheet, View } from 'react-native';
import { copy } from '@/constants/copy';
import { CorsoText } from '@/src/theme/CorsoText';
import {
  PASSCODE_KEYPAD,
  PASSCODE_KEYS,
  type PasscodeKey,
  type PasscodeKeySlot,
} from '@/src/features/lock/passcodePadPresentation';
import {
  resolvePasscodeKeyPressPaint,
  type PasscodeKeyPressPaint,
} from '@/src/features/lock/passcodeCellPaint';
import {
  useInkContrastEnabled,
  useOnFloatSheet,
} from '@/src/ui/glass/useInkContrast';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon';

export function Keypad({
  onKey,
  disabled = false,
  disabledAccessibilityLabel,
  testID,
}: {
  onKey: (key: PasscodeKey) => void;
  disabled?: boolean;
  disabledAccessibilityLabel?: string;
  testID?: string;
}) {
  // Where the pad stands decides the press disc's paint, read at render.
  // `null` on the ground: the disc keeps the fill its style sheet gives it.
  const pressPaint = resolvePasscodeKeyPressPaint({
    onFloatSheet: useOnFloatSheet(),
    increaseContrast: useInkContrastEnabled(),
  });
  const rows: PasscodeKeySlot[][] = [];
  for (let i = 0; i < PASSCODE_KEYS.length; i += PASSCODE_KEYPAD.columns) {
    rows.push(PASSCODE_KEYS.slice(i, i + PASSCODE_KEYPAD.columns));
  }

  return (
    <View style={styles.pad} testID={testID}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((slot, slotIndex) =>
            slot === '' ? (
              <View
                key={`gap-${slotIndex}`}
                style={styles.key}
                accessible={false}
              />
            ) : (
              <Key
                key={slot}
                id={slot}
                disabled={disabled}
                disabledAccessibilityLabel={disabledAccessibilityLabel}
                pressPaint={pressPaint}
                onKey={onKey}
                testID={testID ? `${testID}-${slot}` : undefined}
              />
            ),
          )}
        </View>
      ))}
    </View>
  );
}

function Key({
  id,
  disabled,
  disabledAccessibilityLabel,
  pressPaint,
  onKey,
  testID,
}: {
  id: PasscodeKey;
  disabled: boolean;
  disabledAccessibilityLabel?: string;
  pressPaint: PasscodeKeyPressPaint | null;
  onKey: (key: PasscodeKey) => void;
  testID?: string;
}) {
  const isDelete = id === 'delete';
  const glyphColor = disabled
    ? PASSCODE_KEYPAD.glyphDisabledColor
    : PASSCODE_KEYPAD.glyphColor;

  return (
    <Pressable
      testID={testID}
      style={styles.key}
      disabled={disabled}
      onPress={() => onKey(id)}
      accessibilityRole="button"
      accessibilityLabel={
        disabled && disabledAccessibilityLabel
          ? disabledAccessibilityLabel
          : isDelete
            ? copy.v1Onboarding.passcodeDelete
            : id
      }
      accessibilityState={{ disabled }}
    >
      {({ pressed }) => (
        <>
          {pressed && !disabled ? (
            <View
              style={[
                styles.pressDisc,
                pressPaint === null
                  ? null
                  : {
                      backgroundColor: pressPaint.fill,
                      borderWidth: pressPaint.rimWidth,
                      borderColor: pressPaint.rimColor ?? undefined,
                    },
              ]}
            />
          ) : null}
          {isDelete ? (
            <CorsoIcon
              name="delete"
              size={PASSCODE_KEYPAD.deleteIconSize}
              color={glyphColor}
            />
          ) : (
            <CorsoText
              accessible={false}
              style={[styles.glyph, { color: glyphColor }]}
            >
              {id}
            </CorsoText>
          )}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pad: { alignSelf: 'center' },
  row: { flexDirection: 'row' },
  key: {
    width: PASSCODE_KEYPAD.keyWidth,
    height: PASSCODE_KEYPAD.keyHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressDisc: {
    position: 'absolute',
    width: PASSCODE_KEYPAD.pressDiscSize,
    height: PASSCODE_KEYPAD.pressDiscSize,
    borderRadius: PASSCODE_KEYPAD.pressDiscSize / 2,
    backgroundColor: PASSCODE_KEYPAD.pressDiscFill,
  },
  glyph: {
    fontSize: PASSCODE_KEYPAD.glyphSize,
    fontWeight: PASSCODE_KEYPAD.glyphWeight,
  },
});

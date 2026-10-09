import { StyleSheet, View } from 'react-native';
import { copy } from '@/constants/copy';
import { CorsoText } from '@/src/theme/CorsoText';
import { Keypad } from '@/src/features/lock/Keypad';
import { PasscodeCells } from '@/src/features/lock/PasscodeCells';
import {
  PASSCODE_SPACING,
  PASSCODE_TYPE,
  type PasscodeKey,
} from '@/src/features/lock/passcodePadPresentation';

export function PasscodeEntry({
  value,
  error,
  errorBody,
  disabled,
  disabledAccessibilityLabel,
  announceError = true,
  shakeToken,
  onKey,
  testID,
}: {
  value: string;
  error: string | null;
  errorBody?: string | null;
  disabled: boolean;
  disabledAccessibilityLabel?: string;
  announceError?: boolean;
  shakeToken: number;
  onKey: (key: PasscodeKey) => void;
  testID?: string;
}) {
  return (
    <View style={styles.root} testID={testID}>
      <View style={styles.helperSlot}>
        <CorsoText style={styles.helper}>{copy.lock.passcodeHelper}</CorsoText>
      </View>
      <PasscodeCells
        filled={value.length}
        shakeToken={shakeToken}
        testID={testID ? `${testID}-cells` : undefined}
      />
      <View style={styles.errorSlot}>
        {error ? (
          <CorsoText
            style={styles.error}
            accessibilityRole={announceError ? 'alert' : undefined}
            accessibilityLiveRegion={announceError ? 'assertive' : 'none'}
          >
            {error}
          </CorsoText>
        ) : null}
        {errorBody ? <CorsoText style={styles.errorBody}>{errorBody}</CorsoText> : null}
      </View>
      <Keypad
        onKey={onKey}
        disabled={disabled}
        disabledAccessibilityLabel={disabledAccessibilityLabel}
        testID={testID ? `${testID}-keypad` : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch', alignItems: 'center' },
  helperSlot: {
    minHeight: PASSCODE_SPACING.helperSlot,
    maxWidth: PASSCODE_TYPE.helper.maxWidth,
    marginBottom: PASSCODE_SPACING.helperToCells,
  },
  helper: {
    color: PASSCODE_TYPE.helper.color,
    fontSize: PASSCODE_TYPE.helper.size,
    lineHeight: PASSCODE_TYPE.helper.lineHeight,
    fontWeight: PASSCODE_TYPE.helper.weight,
    textAlign: 'center',
  },
  errorSlot: {
    alignSelf: 'stretch',
    marginTop: PASSCODE_SPACING.cellsToError,
    minHeight: PASSCODE_SPACING.errorSlot,
  },
  error: {
    color: PASSCODE_TYPE.error.color,
    fontSize: PASSCODE_TYPE.error.size,
    lineHeight: PASSCODE_TYPE.error.lineHeight,
    fontWeight: PASSCODE_TYPE.error.weight,
    textAlign: 'center',
  },
  errorBody: {
    color: PASSCODE_TYPE.helper.color,
    fontSize: PASSCODE_TYPE.helper.size,
    lineHeight: PASSCODE_TYPE.helper.lineHeight,
    textAlign: 'center',
  },
});

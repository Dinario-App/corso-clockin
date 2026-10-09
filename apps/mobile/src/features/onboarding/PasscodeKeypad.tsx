import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CorsoText } from '@/src/theme/CorsoText';
import { Keypad } from '@/src/features/lock/Keypad';
import { PasscodeCells } from '@/src/features/lock/PasscodeCells';
import {
  PASSCODE_SETUP_SPACING,
  PASSCODE_SPACING,
  PASSCODE_TYPE,
} from '@/src/features/lock/passcodePadPresentation';
import {
  completedPasscode,
  emptyPasscodeEntry,
  pressPasscodeDelete,
  pressPasscodeDigit,
} from '@/src/features/onboarding/passcodeEntry';
import { typography } from '@/src/ui/tokens';

export function PasscodeKeypad({
  onComplete,
  resetToken = 0,
}: {
  onComplete: (passcode: string) => void;
  resetToken?: number;
}) {
  const [entry, setEntry] = useState(emptyPasscodeEntry);
  const [shakeToken, setShakeToken] = useState(0);

  useEffect(() => {
    const passcode = completedPasscode(entry);
    if (passcode !== null) {
      onComplete(passcode);
    }
    // Fires on the completing transition only; `entry` is replaced by the host.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry]);

  /*
    The host's retry door. Skipped on the first render (`resetToken` starts at
    whatever the host seeded) so a mount is not a reset; every later change is
    the host saying "that attempt is void, start again".
  */
  const seenReset = useRef(resetToken);
  useEffect(() => {
    if (seenReset.current === resetToken) return;
    seenReset.current = resetToken;
    setEntry(emptyPasscodeEntry());
  }, [resetToken]);

  // A mismatch throws both entries away; the cells shake once as they clear.
  useEffect(() => {
    if (entry.error) setShakeToken((token) => token + 1);
  }, [entry.error]);

  return (
    <View style={styles.root}>
      <CorsoText style={styles.title} accessibilityRole="header">
        {entry.title}
      </CorsoText>
      {/* Always drawn, empty on confirm, so the cells never jump a line. */}
      <CorsoText style={styles.body}>{entry.body}</CorsoText>

      <View style={styles.cells}>
        <PasscodeCells filled={entry.filled} shakeToken={shakeToken} />
      </View>

      <View style={styles.errorSlot}>
        {entry.error ? (
          <CorsoText
            style={styles.error}
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
          >
            {entry.error}
          </CorsoText>
        ) : null}
      </View>

      <Keypad
        onKey={(key) =>
          setEntry((current) =>
            key === 'delete'
              ? pressPasscodeDelete(current)
              : pressPasscodeDigit(current, key),
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch', alignItems: 'center' },
  title: {
    color: PASSCODE_TYPE.title.color,
    fontSize: PASSCODE_TYPE.title.size,
    lineHeight: PASSCODE_TYPE.title.lineHeight,
    fontFamily: typography.face(PASSCODE_TYPE.title.weight),
    fontWeight: PASSCODE_TYPE.title.weight,
    textAlign: 'center',
  },
  body: {
    marginTop: PASSCODE_SETUP_SPACING.titleToBody,
    minHeight: PASSCODE_TYPE.body.lineHeight,
    color: PASSCODE_TYPE.body.color,
    fontSize: PASSCODE_TYPE.body.size,
    lineHeight: PASSCODE_TYPE.body.lineHeight,
    fontFamily: typography.face(PASSCODE_TYPE.body.weight),
    fontWeight: PASSCODE_TYPE.body.weight,
    textAlign: 'center',
  },
  cells: { marginTop: PASSCODE_SETUP_SPACING.bodyToCells },
  errorSlot: {
    alignSelf: 'stretch',
    marginTop: PASSCODE_SPACING.cellsToError,
    height: PASSCODE_SPACING.errorSlot,
  },
  error: {
    color: PASSCODE_TYPE.error.color,
    fontSize: PASSCODE_TYPE.error.size,
    lineHeight: PASSCODE_TYPE.error.lineHeight,
    fontFamily: typography.face(PASSCODE_TYPE.error.weight),
    fontWeight: PASSCODE_TYPE.error.weight,
    textAlign: 'center',
  },
});

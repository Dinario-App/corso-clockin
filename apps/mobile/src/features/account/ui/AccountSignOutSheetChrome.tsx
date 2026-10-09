import { StyleSheet, TextInput } from 'react-native';
import { ethena } from '@/constants/theme.ethena';
import { CorsoText } from '@/src/theme/CorsoText';
import { EthenaTray } from '@/src/ui/ethena/EthenaPrimitives';
import { PROFILE_DOWN } from './profileRootPaint';

export function SignOutSheetBody({ body }: { body: string }) {
  return <CorsoText style={styles.sheetBody}>{body}</CorsoText>;
}

export function SignOutConfirmField({
  value,
  onChangeText,
  placeholder,
  editable,
}: {
  value: string;
  onChangeText: (next: string) => void;
  placeholder: string;
  editable: boolean;
}) {
  return (
    <EthenaTray
      testID="account-sign-out-confirm-field"
      style={styles.confirmField}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={ethena.ink.secondary}
        autoCapitalize="characters"
        autoCorrect={false}
        editable={editable}
        accessibilityLabel={placeholder}
        style={styles.confirmInput}
        testID="account-sign-out-confirm"
      />
    </EthenaTray>
  );
}

export function SignOutSheetError({ message }: { message: string }) {
  return <CorsoText style={styles.sheetError}>{message}</CorsoText>;
}

/** The shipped numbers: body 17, caption 13, `spacing.md` 16, `spacing.sm` 8. */
const styles = StyleSheet.create({
  sheetBody: {
    color: ethena.ink.secondary,
    fontSize: 17,
    marginBottom: 16,
  },
  confirmField: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  confirmInput: {
    color: ethena.ink.primary,
    fontSize: 17,
    paddingVertical: 16,
  },
  sheetError: {
    color: PROFILE_DOWN,
    fontSize: 13,
    marginTop: 8,
  },
});

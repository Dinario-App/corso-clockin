import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import { usePrivy } from '@privy-io/expo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import { AccountScreenHeader } from '@/src/features/account/ui/AccountScreenHeader';
import {
  deleteAccount,
  type AccountDeletionResult,
} from '@/src/features/account/deleteAccount';
import { queueDeleteAccountIncompleteNotice } from '@/src/features/account/deleteAccountIncompleteNotice';
import {
  resolveDeleteEntryPresentation,
  resolveRemoveFromPhoneOutcome,
} from '@/src/features/account/deleteEntryPresentation';
import {
  executeRemoveFromPhoneFlow,
  type RemoveFromThisPhoneResult,
} from '@/src/features/account/removeFromThisPhone';
import { PasscodeEntry } from '@/src/features/lock/PasscodeEntry';
import {
  appendPasscodeDigit,
  deletePasscodeDigit,
  isPasscodeComplete,
  type PasscodeKey,
} from '@/src/features/lock/passcodePadPresentation';
import {
  getRemovePasscodeRequirement,
  type RemovePasscodeRequirement,
  verifyRemovePasscode,
} from '@/src/features/security/appLock';
import { usePasscodeWait } from '@/src/features/security/usePasscodeWait';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { PrimaryCTA } from '@/src/ui/controls/PrimaryCTA';
import { TextButton } from '@/src/ui/controls/TextButton';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { useScrollLinkedFadeTop } from '@/src/ui/primitives/useScrollLinkedFadeTop';
import { EthenaGround } from '@/src/ui/ethena/EthenaPrimitives';
import { useEthenaMaterial } from '@/src/ui/ethena/useEthenaMaterial';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';

/** The confirmation field stands on the ground tray (material law, `ground`). */

type DeleteAccountScreenFlowInput = {
  deleteAccount: () => Promise<AccountDeletionResult>;
  resetSessionLocalState: () => Promise<void>;
  logout: () => Promise<void>;
  queueIncompleteNotice: () => void;
  showError: (message: string) => void;
  replaceRoot: () => void;
};

async function executeDeleteAccountScreenFlow(
  input: DeleteAccountScreenFlowInput,
): Promise<void> {
  let result: AccountDeletionResult;
  try {
    result = await input.deleteAccount();
  } catch {
    input.showError(copy.profile.deleteEverythingError);
    return;
  }

  await input.resetSessionLocalState().catch(() => undefined);
  await input.logout().catch(() => undefined);
  if (result.localClearIncomplete) {
    input.queueIncompleteNotice();
  }
  input.replaceRoot();
}

type RemoveFromPhoneScreenFlowInput = {
  removeFromPhone: () => Promise<RemoveFromThisPhoneResult>;
  hasImportedWalletOnPhone: boolean;
  hasConnectedWalletOnPhone: boolean;
  queueNotice: (message: string) => void;
  showError: (message: string) => void;
  replaceRoot: () => void;
};

async function executeRemoveFromPhoneScreenFlow(
  input: RemoveFromPhoneScreenFlowInput,
): Promise<void> {
  const result = await input.removeFromPhone();
  const outcome = resolveRemoveFromPhoneOutcome({
    hasImportedWalletOnPhone: input.hasImportedWalletOnPhone,
    hasConnectedWalletOnPhone: input.hasConnectedWalletOnPhone,
    failedStores: result.failedStores,
  });
  input.queueNotice(outcome.message);
  if (outcome.kind === 'error') {
    input.showError(outcome.message);
    return;
  }
  input.replaceRoot();
}

export default function DeleteAccountScreen() {
  const scrollFade = useScrollLinkedFadeTop();
  const tray = useEthenaMaterial('ground');
  const trayPaint = {
    backgroundColor: tray.fill as string,
    borderWidth: tray.borderWidth,
    borderColor: tray.borderColor ?? undefined,
  };
  const { getAccessToken, logout, user, isReady } = usePrivy();
  const {
    resetSessionLocalState,
    clearConnectedSession,
    eraseImportedWordsFromPhone,
    hasImportedWalletOnPhone,
    connectedStatus,
  } = useCorsoSession();
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passcodeRequired, setPasscodeRequired] = useState<boolean | null>(
    null,
  );
  const [passcodeScope, setPasscodeScope] =
    useState<RemovePasscodeRequirement>('none');
  const [passcodeVerified, setPasscodeVerified] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [passcodeBusy, setPasscodeBusy] = useState(false);
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const [passcodeShake, setPasscodeShake] = useState(0);
  const inFlight = useRef(false);
  const passcodeInFlight = useRef(false);
  const hasConnectedWalletOnPhone = connectedStatus !== 'none';
  const presentation = resolveDeleteEntryPresentation({
    hasCorsoServerAccount: isReady ? Boolean(user) : null,
    hasImportedWalletOnPhone,
    hasConnectedWalletOnPhone,
  });
  const passcodeWait = usePasscodeWait(
    presentation.action === 'remove-from-phone' && passcodeRequired === true,
    passcodeScope === 'bound' ? 'bound' : 'general',
  );

  useEffect(() => {
    let cancelled = false;
    setConfirmation('');
    setError(null);
    setPasscode('');
    setPasscodeError(null);
    setPasscodeVerified(false);
    if (!presentation.ready || presentation.action === 'delete-account') {
      setPasscodeRequired(false);
      setPasscodeScope('none');
      return () => {
        cancelled = true;
      };
    }
    setPasscodeRequired(null);
    void getRemovePasscodeRequirement()
      .then((requirement) => {
        if (!cancelled) {
          setPasscodeScope(requirement);
          setPasscodeRequired(requirement !== 'none');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPasscodeRequired(true);
          setPasscodeError(copy.profile.removeFromPhone.passcodeCheckFailed);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    presentation.action,
    presentation.ready,
    hasImportedWalletOnPhone,
    hasConnectedWalletOnPhone,
  ]);

  async function verifyRemovePasscodeEntry(nextPasscode: string) {
    if (passcodeInFlight.current || passcodeRequired !== true) return;
    passcodeInFlight.current = true;
    setPasscodeBusy(true);
    setPasscodeError(null);
    try {
      if (await verifyRemovePasscode(nextPasscode)) {
        setPasscodeVerified(true);
        setPasscode('');
        return;
      }
      setPasscode('');
      setPasscodeError(copy.stepup.appLockWrong);
      setPasscodeShake((token) => token + 1);
    } catch (caught) {
      setPasscode('');
      setPasscodeError(
        passcodeWait.acceptError(caught)
          ? null
          : copy.profile.removeFromPhone.passcodeCheckFailed,
      );
    } finally {
      passcodeInFlight.current = false;
      setPasscodeBusy(false);
    }
  }

  function onPasscodeKey(key: PasscodeKey) {
    if (
      passcodeBusy ||
      passcodeInFlight.current ||
      passcodeRequired !== true ||
      passcodeWait.wait
    ) {
      return;
    }
    if (key === 'delete') {
      setPasscode(deletePasscodeDigit(passcode));
      setPasscodeError(null);
      return;
    }
    const next = appendPasscodeDigit(passcode, key);
    if (next === passcode) return;
    setPasscode(next);
    setPasscodeError(null);
    if (isPasscodeComplete(next)) void verifyRemovePasscodeEntry(next);
  }

  async function confirmDeletion() {
    if (
      inFlight.current ||
      !presentation.ready ||
      confirmation !== presentation.confirmPhrase ||
      (presentation.action === 'remove-from-phone' &&
        passcodeRequired !== false &&
        !passcodeVerified)
    ) {
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      if (presentation.action === 'delete-account') {
        await executeDeleteAccountScreenFlow({
          deleteAccount: () => deleteAccount({ getAccessToken }),
          resetSessionLocalState,
          logout,
          queueIncompleteNotice: queueDeleteAccountIncompleteNotice,
          showError: setError,
          replaceRoot: () => router.replace('/'),
        });
      } else {
        await executeRemoveFromPhoneScreenFlow({
          removeFromPhone: () =>
            executeRemoveFromPhoneFlow({
              hasImportedWalletOnPhone,
              hasConnectedWalletOnPhone,
              clearConnectedSession,
              eraseImportedWordsFromPhone,
            }),
          hasImportedWalletOnPhone,
          hasConnectedWalletOnPhone,
          queueNotice: queueDeleteAccountIncompleteNotice,
          showError: setError,
          replaceRoot: () => router.replace('/'),
        });
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <EthenaGround>
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <AccountScreenHeader
        family="desk"
        title={presentation.title}
        onBack={() => goBackOr(BACK_FALLBACK.accountTab)}
        backAccessibilityLabel={copy.v1.back}
        testID="profile-delete-header"
      />
      <View style={styles.scrollWrap}>
        <ScrollView
          {...scrollFade.scroller}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          {presentation.action === 'remove-from-phone' &&
          passcodeRequired === null ? null : presentation.action ===
              'remove-from-phone' &&
            passcodeRequired === true &&
            !passcodeVerified ? (
            <>
              <Text style={styles.explanation}>
                {presentation.passcodeTitle}
              </Text>
              <Text style={styles.explanation}>
                {presentation.passcodeBody}
              </Text>
              <PasscodeEntry
                value={passcode}
                error={passcodeWait.line ?? passcodeError}
                errorBody={
                  passcodeWait.wait ? copy.lock.tooManyTriesBody : null
                }
                disabled={
                  passcodeBusy ||
                  passcodeRequired !== true ||
                  passcodeWait.wait !== null
                }
                disabledAccessibilityLabel={passcodeWait.accessibilityLabel}
                announceError={passcodeWait.wait === null}
                shakeToken={passcodeShake}
                onKey={onPasscodeKey}
                testID="remove-from-phone-passcode"
              />
              <TextButton
                label={copy.profile.removeFromPhone.forgotPasscode}
                onPress={() => router.push('/(auth)/import')}
                accessibilityRole="link"
              />
              <TextButton
                label={copy.profile.removeFromPhone.cancel}
                onPress={() => goBackOr(BACK_FALLBACK.accountTab)}
              />
            </>
          ) : (
            <>
              <Text style={styles.explanation}>{presentation.body}</Text>
              <TextInput
                value={confirmation}
                onChangeText={setConfirmation}
                placeholder={presentation.confirmPlaceholder}
                placeholderTextColor={ethena.ink.tertiary}
                autoCapitalize="characters"
                autoCorrect={false}
                style={[styles.input, trayPaint]}
                accessibilityLabel={presentation.confirmPlaceholder}
              />
              <PrimaryCTA
                label={presentation.cta}
                onPress={() => void confirmDeletion()}
                disabled={
                  !presentation.ready ||
                  confirmation !== presentation.confirmPhrase
                }
                busy={busy}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </>
          )}
        </ScrollView>
        <ScrollEdgeFade top={scrollFade.top} color={ethena.groundStops[0][1]} />
      </View>
    </SafeAreaView>
    </EthenaGround>
  );
}

const styles = StyleSheet.create({
  scrollWrap: { flex: 1, position: 'relative' },
  safe: { flex: 1 },
  /** The desk gutter, the same one the `family="desk"` header row reads. */
  body: { paddingHorizontal: ethenaGeometry.gutter, paddingTop: 16 },
  explanation: {
    ...ETHENA_TYPE.body,
    marginTop: 16,
    color: ethena.ink.secondary,
  },
  input: {
    marginTop: 32,
    marginBottom: 16,
    minHeight: 56,
    paddingHorizontal: 16,
    color: ethena.ink.primary,
    borderRadius: ethenaGeometry.radiusBox,
    fontSize: ETHENA_TYPE.rowName.fontSize,
  },
  error: { ...ETHENA_TYPE.body, color: ethena.ink.primary },
});

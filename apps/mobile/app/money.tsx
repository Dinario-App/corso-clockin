import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextStyle,
} from 'react-native';
import { router } from 'expo-router';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import { usePrivy } from '@privy-io/expo';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import {
  formatSolBalanceFull,
  homeBalanceLabel,
} from '@/src/features/balances/formatSol';
import {
  formatUsdcBalanceFull,
  homeUsdcLabel,
} from '@/src/features/balances/formatUsdc';
import { useFiatTotal } from '@/src/features/balances/useFiatTotal';
import { useSolBalance } from '@/src/features/balances/useSolBalance';
import { useUsdcBalance } from '@/src/features/balances/useUsdcBalance';
import { homeDollarStyle } from '@/src/features/home/homeEmptyPresentation';
import {
  resolveMoneyActivityChrome,
  resolveMoneyActivityRows,
  resolveMoneyTokenSheet,
  type MoneyTokenSymbol,
} from '@/src/features/money/moneySheetPresentation';
import { useWalletActivity } from '@/src/features/activity/useWalletActivity';
import { useLaneGate } from '@/src/features/navigation/laneGates';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { executeSessionTypeAwareSignOut } from '@/src/features/session/sessionSignOut';
import {
  isSignOutConfirmed,
  resolveSignOutSheet,
} from '@/src/features/session/signOutSheetPresentation';
import { resolveSecuritySheetPresentation } from '@/src/features/profile/securitySheetPresentation';
import { PasscodeKeypad } from '@/src/features/onboarding/PasscodeKeypad';
import { PrimaryCTA } from '@/src/ui/controls/PrimaryCTA';
import { TextButton } from '@/src/ui/controls/TextButton';
import {
  getAppLockPreference,
  getBiometricLabel,
  isLocalAuthAvailable,
  promptAppUnlock,
} from '@/src/features/security/appLock';
import { NEUTRAL_BIOMETRIC_LABEL } from '@/src/features/security/biometricLabel';
import { buildSwapReviewFactsPanel } from '@/src/features/tokenFacts/formatTokenFactsDisplay';
import { TokenFactsPanel } from '@/src/features/tokenFacts/TokenFactsPanel';
import { useTokenFacts } from '@/src/features/tokenFacts/useTokenFacts';
import { resolveNetworkStatus, type NetworkStatus } from '@/src/lib/apiConfig';
import {
  moneyFactsStatusForGate,
  resolveMoneyNetworkGate,
  resolveMoneyTokenMint,
} from '@/src/features/money/moneyNetworkGate';
import {
  analyticsSwitchAccessibilityLabel,
  isAnalyticsOptedOut,
  setAnalyticsOptedOut,
} from '@/src/lib/analytics';
import { truncateAddress } from '@/src/lib/truncateAddress';
import { GlassPill } from '@/src/ui/controls/GlassPill';
import { IconCircleButton } from '@/src/ui/controls/IconCircleButton';
import { Material } from '@/src/ui/glass/Material';
import { VoiceDisc } from '@/src/ui/glass/VoiceDisc';
import { buildHomeHoldingChips } from '@/src/features/home/homeHoldingChipPresentation';
import { resolveMoneyAskDoor } from '@/src/features/money/moneyAskDoor';
import { ActivityDayHeader } from '@/src/ui/activity/ActivityDayHeader';
import { ActivityRow } from '@/src/ui/activity/ActivityRow';
import { BottomSheet } from '@/src/ui/primitives/BottomSheet';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { SettingsRow } from '@/src/ui/rows/SettingsRow';
import { CorsoText } from '@/src/theme/CorsoText';
import { CANON_TYPE_SIZES, canonWeight } from '@/src/ui/cards/canonType.js';
import { colors, radii, spacing, typography } from '@/src/ui/tokens';
import { CountUpMoneyText } from '@/src/ui/motion/CountUpMoneyText';
import { ChartReadHeadline } from '@/src/ui/charts/ChartReadHeadline';
import { PriceChart } from '@/src/ui/charts/PriceChart';
import { CompactAmountText } from '@/src/ui/format/CompactAmountText';
import {
  resolveRoutineArmingEnabled,
  resolveRoutinesEnabled,
} from '@/src/lib/apiConfig';
import { RoutinesMoneyController } from '@/src/features/routines/RoutinesMoneyController';

export default function MoneyScreen() {
  const { logout, user, isReady, getAccessToken } = usePrivy();
  const {
    session,
    clearConnectedSession,
    resetSessionLocalState,
    markLockSetupComplete,
    hasImportedWalletOnPhone,
    connectedStatus,
  } = useCorsoSession();
  const fiat = useFiatTotal(session?.address, { session, getAccessToken });
  const solBalance = useSolBalance(session?.address);
  const usdcBalance = useUsdcBalance(session?.address);
  const activity = useWalletActivity(session?.address);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus | null>(
    null,
  );
  const [routinesEnabled, setRoutinesEnabled] = useState(false);
  const [routineArmingEnabled, setRoutineArmingEnabled] = useState(false);
  const skillsDirectoryEnabled = useLaneGate('skills');
  const botsLaneEnabled = useLaneGate('bots');
  const [activityOpen, setActivityOpen] = useState(false);
  const [tokenSymbol, setTokenSymbol] = useState<MoneyTokenSymbol | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [unpricedOpen, setUnpricedOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [passcodeOpen, setPasscodeOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signOutTyped, setSignOutTyped] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [biometricLabel, setBiometricLabel] = useState(NEUTRAL_BIOMETRIC_LABEL);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [biometricsReady, setBiometricsReady] = useState(false);
  const [analyticsReady, setAnalyticsReady] = useState(false);
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const signOutInFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    // Mount-only on purpose, as in Send and Swap. A stale `NetworkStatus` can
    // only ever be a `known` pair that was true when it was read, never a
    // fabricated devnet default, so age cannot manufacture a wrong mint.
    void Promise.all([
      resolveNetworkStatus(),
      resolveRoutinesEnabled(),
      resolveRoutineArmingEnabled(),
    ]).then(([next, routinesFlag, armingFlag]) => {
      if (cancelled) return;
      setNetworkStatus(next);
      setRoutinesEnabled(routinesFlag);
      setRoutineArmingEnabled(armingFlag);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getAppLockPreference(), getBiometricLabel()])
      .then(([lockPreference, nextBiometricLabel]) => {
        if (cancelled) return;
        setBiometricsEnabled(lockPreference === 'biometric');
        setBiometricLabel(nextBiometricLabel);
        setBiometricsReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setPreferenceError(copy.profile.errorSetting);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void isAnalyticsOptedOut()
      .then((optedOut) => {
        if (cancelled) return;
        setAnalyticsEnabled(!optedOut);
        setAnalyticsReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setPreferenceError(copy.profile.errorSetting);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const holdingChips = buildHomeHoldingChips({
    holdings: fiat.holdings,
    result: fiat.result,
  });
  const solText = homeBalanceLabel({
    status: solBalance.status,
    lamports: solBalance.lamports,
    placeholder: copy.home.balancePlaceholder,
  });
  const usdcText = homeUsdcLabel({
    status: usdcBalance.status,
    atomic: usdcBalance.atomic,
    placeholder: copy.home.balancePlaceholder,
  });

  const activityChrome = resolveMoneyActivityChrome({
    status: activity.status,
    itemCount: activity.items.length,
  });
  const activityGroups = resolveMoneyActivityRows(activity.items);
  const networkGate = useMemo(
    () => resolveMoneyNetworkGate(networkStatus),
    [networkStatus],
  );
  const tokenMint = resolveMoneyTokenMint({
    gate: networkGate,
    symbol: tokenSymbol,
  });
  const tokenFacts = useTokenFacts(tokenMint);
  const tokenSheet =
    tokenSymbol == null
      ? null
      : resolveMoneyTokenSheet({
          symbol: tokenSymbol,
          amountLabel: tokenSymbol === 'SOL' ? solText : usdcText,
        });
  const tokenPanel = tokenSheet
    ? buildSwapReviewFactsPanel({
        status: moneyFactsStatusForGate({
          gate: networkGate,
          hookStatus: tokenFacts.status,
        }),
        facts: tokenFacts.facts,
        error: tokenFacts.error,
        nowMs: Date.now(),
      })
    : null;
  const tokenAmountFullLabel =
    tokenSymbol === 'SOL'
      ? solBalance.status === 'ready' && solBalance.lamports != null
        ? formatSolBalanceFull(solBalance.lamports)
        : (tokenSheet?.amountLabel ?? '')
      : tokenSymbol === 'USDC' &&
          usdcBalance.status === 'ready' &&
          usdcBalance.atomic != null
        ? formatUsdcBalanceFull(usdcBalance.atomic)
        : (tokenSheet?.amountLabel ?? '');

  async function signOut() {
    if (signOutInFlight.current) return;
    // The one gate. The import path signs out only with the words typed.
    if (
      !isSignOutConfirmed({ sessionType: session?.type, typed: signOutTyped })
    ) {
      return;
    }
    signOutInFlight.current = true;
    setSigningOut(true);
    setSignOutError(null);
    try {
      await executeSessionTypeAwareSignOut(session?.type, {
        clearConnectedSession,
        resetSessionLocalState,
        logoutPrivy: logout,
      });
      setSignOutOpen(false);
      setSignOutTyped('');
      setSettingsOpen(false);
    } catch {
      setSignOutError(copy.profile.errorSignOut);
    } finally {
      signOutInFlight.current = false;
      setSigningOut(false);
    }
  }

  async function changeBiometrics(nextEnabled: boolean) {
    if (preferenceBusy) return;
    setPreferenceBusy(true);
    setPreferenceError(null);
    try {
      if (nextEnabled && !(await isLocalAuthAvailable())) {
        setPreferenceError(copy.profile.biometricsUnavailable);
        return;
      }
      if (!(await promptAppUnlock()).success) return;
      await markLockSetupComplete(nextEnabled ? 'biometric' : 'passcode');
      setBiometricsEnabled(nextEnabled);
    } catch {
      setPreferenceError(copy.profile.errorSetting);
    } finally {
      setPreferenceBusy(false);
    }
  }

  async function changePasscode(passcode: string) {
    if (preferenceBusy) return;
    setPreferenceBusy(true);
    setPreferenceError(null);
    try {
      await markLockSetupComplete('passcode', passcode);
      setBiometricsEnabled(false);
      setPasscodeOpen(false);
    } catch {
      setPreferenceError(copy.profile.errorSetting);
    } finally {
      setPreferenceBusy(false);
    }
  }

  async function changeAnalytics(nextEnabled: boolean) {
    if (preferenceBusy) return;
    setPreferenceBusy(true);
    setPreferenceError(null);
    try {
      await setAnalyticsOptedOut(!nextEnabled);
      setAnalyticsEnabled(nextEnabled);
    } catch {
      setPreferenceError(copy.profile.errorSetting);
    } finally {
      setPreferenceBusy(false);
    }
  }

  const securitySheet = resolveSecuritySheetPresentation({
    sessionType: session?.type,
    biometricLabel,
    biometricsOn: biometricsEnabled,
    hasCorsoServerAccount: isReady ? Boolean(user) : null,
    hasImportedWalletOnPhone,
    hasConnectedWalletOnPhone: connectedStatus !== 'none',
  });
  const signOutSheet = resolveSignOutSheet(session?.type);

  /** Back to Home with the sentence in Ask. Prefilled there, never sent. */
  function askOnHome(text: string) {
    router.navigate(resolveMoneyAskDoor(text));
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.top}>
        <GlassPill
          label={copy.v1.back}
          onPress={() => goBackOr(BACK_FALLBACK.shell)}
          accessibilityLabel={copy.v1.back}
          style={styles.back}
        />
        <IconCircleButton
          glyph="settings"
          onPress={() => setSettingsOpen(true)}
          accessibilityLabel={copy.v1.settings}
        />
      </View>
      {fiat.caveat ? <BottomSheet dismissible signing={false} visible={unpricedOpen} onRequestClose={() => setUnpricedOpen(false)} title={fiat.caveat}>
        {holdingChips.filter((holding) => fiat.result.lines.find((line) => line.mint === holding.mint)?.priced !== true).map((holding) => (
          <CorsoText key={holding.mint} style={styles.amount}>{holding.quantityText} · {holding.fiatText}</CorsoText>
        ))}
      </BottomSheet> : null}
      <View style={styles.scrollWrap}>
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          <CorsoText style={styles.holdHint}>{copy.v1.youHoldThis}</CorsoText>
          <CountUpMoneyText
            amount={fiat.totalFiat}
            fallbackText={fiat.display}
            style={styles.dollar}
            accessibilityRole="header"
          />

          {fiat.caveat ? (
            <Pressable onPress={() => setUnpricedOpen(true)} accessibilityRole="button" accessibilityLabel={fiat.caveat}>
              <CorsoText style={styles.amount}>{fiat.caveat}</CorsoText>
            </Pressable>
          ) : null}
          {fiat.stale ? <CorsoText style={styles.amount}>{copy.live.stale}</CorsoText> : null}

          <Material
            weight="card"
            radius={radii.pane}
            style={styles.list}
            contentStyle={styles.listContent}
          >
            {holdingChips.map((holding, index) => (
              <Pressable
                key={holding.mint}
                testID={`wallet-holding-${holding.mint}`}
                onPress={() => router.push({ pathname: '/asset/[mint]', params: { mint: holding.mint } })}
                accessibilityRole="button"
                accessibilityLabel={holding.accessibilityLabel}
                style={[styles.row, index < holdingChips.length - 1 && styles.rowDivided]}
              >
                <View style={styles.rowText}>
                  <CorsoText style={styles.symbol} numberOfLines={1}>{holding.symbol}</CorsoText>
                  <CorsoText style={styles.amount}>{holding.quantityText}</CorsoText>
                </View>
                <CorsoText style={styles.value}>{holding.fiatText}</CorsoText>
              </Pressable>
            ))}
          </Material>

          {/* Talk, not a feed. The sentence goes to Home's Ask, prefilled. */}
          <View style={styles.chips}>
            <Pressable
              onPress={() => askOnHome(copy.v1.whatsMoving)}
              accessibilityRole="button"
              accessibilityLabel={copy.v1.whatsMoving}
              style={styles.chipHit}
            >
              <Material
                weight="pill"
                radius={radii.pill}
                contentStyle={styles.chipContent}
              >
                <CorsoText style={styles.chipLabel}>
                  {copy.v1.whatsMoving}
                </CorsoText>
              </Material>
            </Pressable>
            {botsLaneEnabled ? (
              <Pressable
                onPress={() => router.push('/bots')}
                accessibilityRole="button"
                accessibilityLabel={copy.automation.a11yTitle}
                style={styles.chipHit}
                testID="money-rules-chip"
              >
                <Material
                  weight="pill"
                  radius={radii.pill}
                  contentStyle={styles.chipContent}
                >
                  <View style={styles.skillsChip}>
                    <View style={styles.skillsDot} />
                    <CorsoText style={styles.chipLabel}>
                      {copy.automation.title}
                    </CorsoText>
                  </View>
                </Material>
              </Pressable>
            ) : null}
            {skillsDirectoryEnabled ? (
              <Pressable
                onPress={() => router.push('/skills')}
                accessibilityRole="button"
                accessibilityLabel={copy.skills.railChipA11y}
                style={styles.chipHit}
                testID="money-skills-chip"
              >
                <Material
                  weight="pill"
                  radius={radii.pill}
                  contentStyle={styles.chipContent}
                >
                  <View style={styles.skillsChip}>
                    <View style={styles.skillsDot} />
                    <CorsoText style={styles.chipLabel}>
                      {copy.skills.railChip}
                    </CorsoText>
                  </View>
                </Material>
              </Pressable>
            ) : null}
          </View>

          {routinesEnabled && session?.address ? (
            <RoutinesMoneyController
              walletAddress={session.address}
              holdings={fiat.holdings}
              result={fiat.result}
              quotes={fiat.quotes}
              armingOpen={routineArmingEnabled}
            />
          ) : null}
        </ScrollView>
        <ScrollEdgeFade color={colors.canvas} />
      </View>

      {/*
        Global floor — the same Ask + voice as Home. Money does not own
        an Ask pipeline: a tap goes back to Home with Ask focused; the disc
        does the same (Home's disc is the one that listens).
      */}
      <View style={styles.floor}>
        <Pressable
          onPress={() => askOnHome('')}
          accessibilityRole="button"
          accessibilityLabel={copy.live.askMeAnything}
          style={styles.askHit}
        >
          <Material
            weight="composer"
            radius={radii.composer}
            style={styles.askLens}
            contentStyle={styles.askContent}
          >
            <CorsoText style={styles.askPlaceholder}>
              {copy.live.askMeAnything}
            </CorsoText>
          </Material>
        </Pressable>
        <VoiceDisc listening={false} onPress={() => askOnHome('')} />
      </View>

      <BottomSheet
        title={copy.v1.settings}
        visible={settingsOpen}
        dismissible={!signingOut && !preferenceBusy}
        signing={signingOut || preferenceBusy}
        onRequestClose={() => setSettingsOpen(false)}
      >
        {session?.address ? (
          <SettingsRow
            label={copy.money.address}
            accessory="value"
            value={truncateAddress(session.address)}
          />
        ) : null}
        <SettingsRow
          label={biometricLabel}
          accessory="switch"
          checked={biometricsEnabled}
          switchDisabled={!biometricsReady || preferenceBusy}
          onValueChange={(nextEnabled) => {
            void changeBiometrics(nextEnabled);
          }}
          accessibilityLabel={biometricLabel}
        />
        <SettingsRow
          label={copy.profile.analyticsToggle}
          accessory="switch"
          checked={analyticsEnabled}
          switchDisabled={!analyticsReady || preferenceBusy}
          onValueChange={(nextEnabled) => {
            void changeAnalytics(nextEnabled);
          }}
          accessibilityLabel={analyticsSwitchAccessibilityLabel(
            analyticsEnabled,
          )}
          accessibilityHint={copy.profile.analyticsSwitchHint}
        />
        <SettingsRow
          label={copy.v1Security.title}
          accessory="chevron"
          onPress={() => {
            setSettingsOpen(false);
            setSecurityOpen(true);
          }}
        />
        {preferenceError ? (
          <CorsoText style={styles.error}>{preferenceError}</CorsoText>
        ) : null}
        {/* Activity is not on the room. It lives behind the gear. */}
        <SettingsRow
          label={copy.v1.activity}
          accessory="chevron"
          onPress={() => {
            setSettingsOpen(false);
            setActivityOpen(true);
          }}
        />
        <SettingsRow
          label={copy.profile.aboutSection}
          accessory="chevron"
          onPress={() => {
            setSettingsOpen(false);
            router.push('/profile/about');
          }}
        />
        <SettingsRow
          label={signingOut ? copy.profile.signingOut : copy.profile.signOut}
          accessory="none"
          tone={signOutSheet.destructive ? 'destructive' : 'default'}
          disabled={signingOut}
          onPress={() => {
            setSignOutTyped('');
            setSignOutError(null);
            setSettingsOpen(false);
            setSignOutOpen(true);
          }}
        />
        {signOutError ? (
          <CorsoText style={styles.error}>{signOutError}</CorsoText>
        ) : null}
      </BottomSheet>

      {/* Security. Exactly one of Your words / Your keys, never both. */}
      <BottomSheet
        title={securitySheet.title}
        visible={securityOpen}
        dismissible={!preferenceBusy}
        signing={preferenceBusy}
        onRequestClose={() => setSecurityOpen(false)}
      >
        {securitySheet.rows.map((row) => {
          if (row.accessory === 'value') {
            return (
              <SettingsRow
                key={row.id}
                label={row.label}
                accessory="value"
                value={row.value ?? copy.v1Security.off}
              />
            );
          }
          const isRevealRow = row.id === 'your-words' || row.id === 'your-keys';
          return (
            <View key={row.id}>
              {row.eyebrow ? (
                <CorsoText style={styles.securityEyebrow}>
                  {row.eyebrow}
                </CorsoText>
              ) : null}
              <SettingsRow
                label={row.label}
                accessory={row.accessory === 'chevron' ? 'chevron' : 'none'}
                tone={row.tone}
                accessibilityLabel={
                  row.hint ? `${row.label}. ${row.hint}` : undefined
                }
                onPress={() => {
                  if (row.id === 'change-passcode') {
                    setSecurityOpen(false);
                    setPreferenceError(null);
                    setPasscodeOpen(true);
                    return;
                  }
                  if (row.href) {
                    setSecurityOpen(false);
                    router.push(row.href);
                  }
                }}
              />
              {row.hint ? (
                <CorsoText style={styles.securityHint}>{row.hint}</CorsoText>
              ) : null}
              {isRevealRow ? (
                <CorsoText style={styles.securityAnnotation}>
                  {securitySheet.annotation}
                </CorsoText>
              ) : null}
            </View>
          );
        })}
      </BottomSheet>

      {/* Passcode — set, then confirm. */}
      <BottomSheet
        title={copy.v1Security.changePasscode}
        visible={passcodeOpen}
        dismissible={!preferenceBusy}
        signing={preferenceBusy}
        onRequestClose={() => setPasscodeOpen(false)}
      >
        <View style={styles.passcodeWrap}>
          <PasscodeKeypad
            onComplete={(passcode) => {
              void changePasscode(passcode);
            }}
          />
          {preferenceError ? (
            <CorsoText style={styles.error}>{preferenceError}</CorsoText>
          ) : null}
        </View>
      </BottomSheet>

      {/* Sign out — sign-in session and imported session read differently. */}
      <BottomSheet
        title={signOutSheet.title}
        visible={signOutOpen}
        dismissible={!signingOut}
        signing={signingOut}
        onRequestClose={() => setSignOutOpen(false)}
      >
        <CorsoText style={styles.sheetBody}>{signOutSheet.body}</CorsoText>
        {signOutSheet.requiresTypedConfirm ? (
          <Material
            weight="card"
            interactive
            radius={radii.smallPane}
            style={styles.confirmField}
          >
            <TextInput
              value={signOutTyped}
              onChangeText={setSignOutTyped}
              placeholder={signOutSheet.confirmPlaceholder ?? ''}
              placeholderTextColor={colors.inkTertiary}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!signingOut}
              accessibilityLabel={signOutSheet.confirmPlaceholder ?? ''}
              style={styles.confirmInput}
            />
          </Material>
        ) : null}
        <PrimaryCTA
          label={signOutSheet.ctaLabel}
          busy={signingOut}
          disabled={
            !isSignOutConfirmed({
              sessionType: session?.type,
              typed: signOutTyped,
            })
          }
          onPress={() => {
            void signOut();
          }}
        />
        <TextButton
          label={signOutSheet.cancelLabel}
          disabled={signingOut}
          onPress={() => setSignOutOpen(false)}
        />
        {signOutError ? (
          <CorsoText style={styles.error}>{signOutError}</CorsoText>
        ) : null}
      </BottomSheet>

      <BottomSheet
        title={copy.v1.activity}
        visible={activityOpen}
        dismissible
        signing={false}
        onRequestClose={() => setActivityOpen(false)}
      >
        {activityChrome.message ? (
          <CorsoText style={styles.sheetBody}>
            {activityChrome.message}
          </CorsoText>
        ) : null}
        {activityChrome.showRows
          ? activityGroups.map((group) => (
              <View key={group.key}>
                <ActivityDayHeader label={group.label} />
                {group.rows.map((row) =>
                  row.presentation.variant === 'activity' ? (
                    <ActivityRow
                      key={row.signature}
                      type={row.presentation.type}
                      status={row.presentation.status}
                      title={row.presentation.title}
                      counterparty={row.presentation.counterparty}
                      time={row.presentation.time}
                      signedAmount={row.presentation.signedAmount}
                      onPress={() => {
                        setActivityOpen(false);
                        router.push(`/activity/${row.signature}`);
                      }}
                    />
                  ) : (
                    <Pressable
                      key={row.signature}
                      onPress={() => {
                        setActivityOpen(false);
                        router.push(`/activity/${row.signature}`);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`${row.presentation.title}, ${row.presentation.meta}`}
                      style={styles.genericRow}
                    >
                      <CorsoText style={styles.symbol}>
                        {row.presentation.title}
                      </CorsoText>
                      <CorsoText style={styles.genericMeta}>
                        {row.presentation.meta}
                      </CorsoText>
                    </Pressable>
                  ),
                )}
              </View>
            ))
          : null}
      </BottomSheet>

      <BottomSheet
        title={tokenSheet?.title ?? copy.home.assetSol}
        visible={tokenSymbol != null}
        dismissible
        signing={false}
        onRequestClose={() => setTokenSymbol(null)}
      >
        {tokenSheet ? (
          <>
            <CompactAmountText
              compactText={tokenSheet.amountLabel}
              fullText={tokenAmountFullLabel}
              style={styles.tokenAmount}
              accessibilityLabel={tokenAmountFullLabel}
            />
            <CorsoText style={styles.holdHint}>{tokenSheet.holdHint}</CorsoText>
            <PriceChart
              mint={tokenMint}
              currentPriceUsd={
                tokenMint ? (fiat.quotes[tokenMint]?.price ?? null) : null
              }
            />
            <ChartReadHeadline mode="live" mint={tokenMint} />
            {tokenMint ? (
              <CorsoText style={styles.mint}>
                {truncateAddress(tokenMint)}
              </CorsoText>
            ) : null}
            {tokenPanel ? <TokenFactsPanel model={tokenPanel} /> : null}
          </>
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scrollWrap: { flex: 1, position: 'relative' },
  top: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: {
    alignSelf: 'flex-start',
    minHeight: typography.control,
    paddingHorizontal: spacing.md,
  },
  body: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  dollar: {
    ...homeDollarStyle(),
    fontVariant: [...typography.fontVariantTabular],
  },
  holdHint: {
    marginBottom: spacing.sm,
    color: colors.inkTertiary,
    fontSize: typography.caption,
    fontFamily: typography.face('400'),
  },
  list: {
    marginTop: 36,
  },
  /** `.idcard{padding:16px}` — a pane's own inset, not the screen column. */
  listContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 72,
    gap: spacing.smd,
  },
  rowDivided: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.surfaceStroke,
  },
  /** Right column — the fiat value from the bag's own model. */
  value: {
    color: colors.ink,
    fontSize: 15,
    fontFamily: typography.face('600'),
    fontWeight: '600',
    fontVariant: [...typography.fontVariantTabular],
  },
  chips: {
    marginTop: 26,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chipHit: {
    minHeight: 44,
    justifyContent: 'center',
  },
  chipContent: {
    paddingVertical: spacing.smd,
    paddingHorizontal: 18,
  },
  chipLabel: {
    color: colors.ink,
    fontSize: typography.hold,
    fontFamily: typography.face('500'),
    fontWeight: '500',
  },
  skillsChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  skillsDot: {
    width: 6,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.ink,
  },
  floor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.dock,
    paddingBottom: spacing.md,
  },
  askHit: { flex: 1 },
  askLens: { flex: 1 },
  /** The bar's own inset, not the screen column. */
  askContent: {
    minHeight: typography.ask,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  askPlaceholder: {
    color: colors.inkTertiary,
    fontSize: typography.body,
    fontFamily: typography.face('400'),
  },
  /** The stacked left column: symbol over quantity. */
  rowText: {
    flex: 1,
  },
  /** The symbol — 16/600, ink. */
  symbol: {
    color: colors.ink,
    fontSize: typography.body,
    fontFamily: typography.face('600'),
    fontWeight: '600',
  },
  /**
   * The quantity — 13/400, beneath the symbol.
   * ⚠️ This is the *quantity*, not a fiat valuation. See the note at the rows.
   */
  amount: {
    marginTop: 2,
    color: colors.inkSecondary,
    fontSize: typography.caption,
    fontFamily: typography.face('400'),
    fontWeight: '400',
    fontVariant: [...typography.fontVariantTabular],
  },
  sheetBody: {
    color: colors.inkTertiary,
    fontSize: typography.body,
    marginBottom: spacing.md,
  },
  error: {
    color: colors.ink,
    fontSize: typography.body,
    marginTop: spacing.sm,
  },
  securityEyebrow: {
    color: colors.inkTertiary,
    fontSize: typography.caption,
    fontWeight: '600',
    letterSpacing: 1.1,
    marginTop: spacing.md,
  },
  securityHint: {
    color: colors.inkTertiary,
    fontSize: typography.caption,
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
  },
  securityAnnotation: {
    color: colors.inkTertiary,
    fontSize: typography.caption,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  /** Outer box only — the material owns the fill, the rim and the radius. */
  confirmField: { marginBottom: spacing.md },
  confirmInput: {
    minHeight: typography.control,
    paddingHorizontal: spacing.md,
    color: colors.ink,
    fontSize: CANON_TYPE_SIZES.control,
    fontFamily: typography.face('450'),
    fontWeight: canonWeight('450'),
  },
  passcodeWrap: { minHeight: 520 },
  genericRow: {
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  genericMeta: {
    color: colors.inkTertiary,
    fontSize: typography.caption,
  },
  tokenAmount: {
    color: colors.ink,
    fontSize: typography.display,
    fontFamily: typography.face('600'),
    fontWeight: '600',
    fontVariant: [...typography.fontVariantTabular],
  },
  mint: {
    marginTop: spacing.sm,
    color: colors.inkTertiary,
    fontSize: typography.mono,
    /** Mint address: slashed zero so `0` cannot read as `O`. */
    fontVariant: [...typography.fontVariantMono] as TextStyle['fontVariant'],
  },
});

import { ALERT_PRESETS_KEY, clearAlertPresets } from '../priceAlerts/alertPresetStore';
import { clearPriceAlertPushOnTeardown } from '../priceAlerts/pushRuntime';
import {
  PUSH_TOKEN_KEY,
  PUSH_ACTIVE_KEY,
  PUSH_PENDING_KEY,
} from '../priceAlerts/pushRegistration';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STATUS_CREDENTIAL_KEY, clearStatusCredential } from '@/src/features/ramp/statusCredentialStore';
import { RECEIPT_SNAPSHOTS_KEY, clearReceiptSnapshotsOnSignOut } from '@/src/features/activity/receiptSnapshotStore';
import { DELEGATION_MARKER_PREFIX, clearDelegationMarkersOnAccountDeletion } from '@/src/features/bots/delegationMarkers';
import { IMPORTED_MNEMONIC_KEYS } from '@corso/wallet';
import {
  AI_CONSENT_STORAGE_KEY,
  clearAiConsentOnPhone,
} from '@/src/features/aiConsent/aiConsentStore';
import {
  AI_CREDENTIAL_INDEX_KEY,
  AI_CREDENTIAL_KEY_PREFIX,
  createSecureStoreCredentialStore,
  type CredentialRef,
  type CredentialStore,
} from '@/src/features/aiConnect/auth/tokenStore';
import { parseByoAiFlags, type ByoAiFlags } from '@/src/features/aiConnect/flags';
import {
  AI_CONNECT_NUDGE_STORAGE_KEY,
  clearAiConnectNudgeFromPhone,
} from '@/src/features/aiConnect/ui/aiConnectNudgeStore';
import { MWA_AUTH_TOKEN_REF, mwaSessionStore } from '@/src/features/connect/mwaSessionStore';
import { HOW_IT_WORKS_SEEN_KEY } from '@/src/features/howItWorks/howItWorksPreference';
import { HIDE_BALANCES_STORAGE_KEY } from '@/src/features/balances/hideBalancesPreference';
import { PORTFOLIO_NAME_STORAGE_KEY } from '@/src/features/onboarding/firstRunOnboarding';
import { clearPortfolioNameOnSignOut } from '@/src/features/onboarding/portfolioNameStore';
import {
  REPORTED_TOKENS_STORAGE_KEY,
  clearReportedTokensFromPhone,
} from '@/src/features/moderation/reportedTokenStore';
import {
  CHART_RANGE_STORAGE_KEY,
  clearChartRangePreferenceOnSignOut,
} from '@/src/features/prices/chartRangePreference';
import {
  APP_LOCK_ATTEMPTS_KEY,
  APP_LOCK_CREDENTIAL_KEY,
  IMPORTED_RESTING_APP_LOCK_ATTEMPTS_KEY,
  IMPORTED_RESTING_APP_LOCK_CREDENTIAL_KEY,
  clearAppLockAttempts,
  clearAppLockPreference,
  clearImportedRestingPasscode,
} from '@/src/features/security/appLock';
import { PRIOR_RECIPIENTS_KEY_PREFIX } from '@/src/features/send/priorRecipients';
import { THREADS_STORAGE_KEY, clearThreadsOnSignOut } from '@/src/features/threads/threadsStore';
import { DIY_WATCHLISTS_STORAGE_KEY } from '@/src/features/watchlist/diyWatchlist';
import {
  WATCHLIST_STORAGE_KEY,
  clearWatchlistFromPhone,
} from '@/src/features/watchlist/watchlistStore';
import {
  ANALYTICS_INSTALL_ID_KEY,
  rotateAnalyticsInstallId,
} from '@/src/lib/analyticsInstallId';
import { importedMnemonicStore } from './importedMnemonicStore';
import { importedRestingStore, IMPORTED_RESTING_KEY } from './importedResting';
import { PENDING_SIGN_OUT_CLEAR_KEY } from './pendingSignOutClear';
import { RETURNING_DINARIO_NOTE_SEEN_KEY } from './returningDinarioNote';

export type LocalClearTier = 'sign-out' | 'account-deletion';

export type DeviceMedium = 'AsyncStorage' | 'SecureStore';

export type PerUserLocalStore = Readonly<{
  id: string;
  /** Every source file that writes it, relative to `apps/mobile`. */
  writers: readonly string[];
  medium: DeviceMedium;
  /** Exact keys. Matched by equality only. */
  keys: readonly string[];
  /** Keys built at runtime from an owner, a cluster or an account id. The only keys matched by prefix. */
  keyPrefixes: readonly string[];
  tier: LocalClearTier;
  /** Throws when the phone refused the clear, so it can be retried and reported. */
  clear: () => Promise<void>;
}>;

export type LocalClearOutcome = Readonly<{
  /**
   * Ids of the stores whose clear still failed after the retry, in registry
   * order. Stores that share one clear are named together. Empty when every
   * clear finished.
   */
  unfinished: readonly string[];
}>;

const APP_LOCK_KEY = 'corso.appLock.v1';
const MFA_ENROLLMENT_OFFER_KEY_PREFIX = 'corso.mfa.enrollment-offer.v1:';

async function removeAsyncStorageKeysWithPrefix(prefix: string): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const owned = keys.filter((key) => key.startsWith(prefix));
  if (owned.length > 0) await AsyncStorage.multiRemove(owned);
}

/**
 * AI sign-ins whose removal has not been confirmed yet. The credential store
 * drops a ref from its index even when the record's own delete failed, so a
 * retry that only listed the index would never see that record again.
 */
const unconfirmedAiCredentials = new Map<string, CredentialRef>();

function aiCredentialId(ref: CredentialRef): string {
  return JSON.stringify([ref.provider, ref.accountId]);
}

export async function forgetAiCredentialsOnPhone(
  store: Pick<CredentialStore, 'list' | 'load' | 'remove'> = createSecureStoreCredentialStore(),
): Promise<void> {
  const refs = new Map(unconfirmedAiCredentials);
  let listed = true;
  try {
    for (const ref of await store.list()) refs.set(aiCredentialId(ref), ref);
  } catch {
    listed = false;
  }
  let unconfirmed = 0;
  for (const [id, ref] of refs) {
    try {
      await store.remove(ref);
      if ((await store.load(ref)) !== null) throw new Error('still on the phone');
      unconfirmedAiCredentials.delete(id);
    } catch {
      unconfirmedAiCredentials.set(id, ref);
      unconfirmed += 1;
    }
  }
  if (!listed) throw new Error('The AI sign-in index could not be read.');
  if (unconfirmed > 0) throw new Error(`${unconfirmed} AI sign-in(s) are still on the phone.`);
}

export function eraseDormantAiSignInsAtLaunch(
  deps: Readonly<{
    store?: Pick<CredentialStore, 'list' | 'load' | 'remove'>;
    readFlags?: () => ByoAiFlags;
  }> = {},
): void {
  const { store, readFlags = () => parseByoAiFlags(undefined) } = deps;
  if (readFlags().byoAiEnabled) return;
  void forgetAiCredentialsOnPhone(store).catch(() => {});
}

export const PER_USER_LOCAL_STORES: readonly PerUserLocalStore[] = Object.freeze([
    {
      id: 'priceAlertPresets',
      writers: ['src/features/priceAlerts/alertPresetStore.ts'],
      medium: 'AsyncStorage',
      keys: [ALERT_PRESETS_KEY],
      keyPrefixes: [],
      tier: 'sign-out',
      clear: clearAlertPresets,
    },
    {
      id: 'priceAlertPush',
      writers: ['src/features/priceAlerts/pushRuntime.ts'],
      medium: 'SecureStore',
      keys: [PUSH_TOKEN_KEY, PUSH_ACTIVE_KEY],
      keyPrefixes: [],
      tier: 'sign-out',
      clear: clearPriceAlertPushOnTeardown,
    },
    {
    id: 'rampStatusCredential',
    writers: ['src/features/ramp/statusCredentialStore.ts'],
    medium: 'SecureStore',
    keys: [STATUS_CREDENTIAL_KEY],
    keyPrefixes: [],
    tier: 'sign-out',
    clear: clearStatusCredential,
  },
  {
    id: 'delegationMarkers',
    writers: ['src/features/bots/delegationMarkers.ts'],
    medium: 'AsyncStorage',
    keys: [],
    keyPrefixes: [DELEGATION_MARKER_PREFIX],
    tier: 'account-deletion',
    clear: clearDelegationMarkersOnAccountDeletion,
  },
  {
    id: 'threads',
    writers: ['src/features/threads/threadsStore.ts'],
    medium: 'AsyncStorage',
    keys: [THREADS_STORAGE_KEY],
    keyPrefixes: [],
    tier: 'sign-out',
    clear: clearThreadsOnSignOut,
  },
  {
    id: 'portfolioName',
    writers: ['src/features/onboarding/portfolioNameStore.ts'],
    medium: 'AsyncStorage',
    keys: [PORTFOLIO_NAME_STORAGE_KEY],
    keyPrefixes: [],
    tier: 'sign-out',
    clear: clearPortfolioNameOnSignOut,
  },
  {
    id: 'receiptSnapshots',
    writers: ['src/features/activity/receiptSnapshotStore.ts'],
    medium: 'AsyncStorage',
    keys: [RECEIPT_SNAPSHOTS_KEY],
    keyPrefixes: [],
    tier: 'sign-out',
    clear: clearReceiptSnapshotsOnSignOut,
  },
  {
    id: 'chartRanges',
    writers: ['src/features/prices/chartRangePreference.ts'],
    medium: 'AsyncStorage',
    keys: [CHART_RANGE_STORAGE_KEY],
    keyPrefixes: [],
    tier: 'sign-out',
    clear: clearChartRangePreferenceOnSignOut,
  },
  {
    id: 'aiConsent',
    writers: ['src/features/aiConsent/aiConsentStore.ts'],
    medium: 'AsyncStorage',
    keys: [AI_CONSENT_STORAGE_KEY],
    keyPrefixes: [],
    tier: 'sign-out',
    clear: clearAiConsentOnPhone,
  },
  {
    id: 'watchlist',
    writers: ['src/features/watchlist/watchlistStore.ts'],
    medium: 'AsyncStorage',
    keys: [WATCHLIST_STORAGE_KEY, DIY_WATCHLISTS_STORAGE_KEY],
    keyPrefixes: [],
    tier: 'sign-out',
    clear: clearWatchlistFromPhone,
  },
  {
    // The Apple 1.2 local hide is "for this install" by design.
    id: 'reportedTokens',
    writers: ['src/features/moderation/reportedTokenStore.ts'],
    medium: 'AsyncStorage',
    keys: [REPORTED_TOKENS_STORAGE_KEY],
    keyPrefixes: [],
    tier: 'account-deletion',
    clear: clearReportedTokensFromPhone,
  },
  {
    id: 'aiNudge',
    writers: ['src/features/aiConnect/ui/aiConnectNudgeStore.ts'],
    medium: 'AsyncStorage',
    keys: [AI_CONNECT_NUDGE_STORAGE_KEY],
    keyPrefixes: [],
    tier: 'account-deletion',
    clear: clearAiConnectNudgeFromPhone,
  },
  {
    // Keyed by cluster and owner wallet, and never read for another wallet.
    id: 'priorRecipients',
    writers: ['src/features/send/priorRecipients.ts'],
    medium: 'AsyncStorage',
    keys: [],
    keyPrefixes: [`${PRIOR_RECIPIENTS_KEY_PREFIX}:`],
    tier: 'account-deletion',
    clear: () => removeAsyncStorageKeysWithPrefix(`${PRIOR_RECIPIENTS_KEY_PREFIX}:`),
  },
  {
    // Keyed by Privy user id so the offer never repeats for that person. No
    // screen claims it yet; the key is cleared all the same.
    id: 'mfaEnrollmentOffer',
    writers: ['src/features/security/mfaEnrollmentOffer.ts'],
    medium: 'AsyncStorage',
    keys: [],
    keyPrefixes: [MFA_ENROLLMENT_OFFER_KEY_PREFIX],
    tier: 'account-deletion',
    clear: () => removeAsyncStorageKeysWithPrefix(MFA_ENROLLMENT_OFFER_KEY_PREFIX),
  },
  {
    // Sign-out clears the lock through `resetSessionLocalState` (never for a
    // connected wallet, by design). A deleted account clears it here as well.
    id: 'appLockChoice',
    writers: ['src/features/security/appLock.ts'],
    medium: 'AsyncStorage',
    keys: [APP_LOCK_KEY],
    keyPrefixes: [],
    tier: 'account-deletion',
    clear: clearAppLockPreference,
  },
  {
    id: 'appLockPasscode',
    writers: ['src/features/security/appLock.ts'],
    medium: 'SecureStore',
    keys: [APP_LOCK_CREDENTIAL_KEY],
    keyPrefixes: [],
    tier: 'account-deletion',
    clear: clearAppLockPreference,
  },
  {
    id: 'appLockAttempts',
    writers: ['src/features/security/appLock.ts'],
    medium: 'SecureStore',
    keys: [APP_LOCK_ATTEMPTS_KEY],
    keyPrefixes: [],
    tier: 'account-deletion',
    clear: clearAppLockAttempts,
  },
  {
    id: 'importedMnemonic',
    writers: [
      'src/features/session/importedMnemonicStore.ts',
      '../../packages/wallet/src/secureStore.ts',
    ],
    medium: 'SecureStore',
    keys: [...IMPORTED_MNEMONIC_KEYS],
    keyPrefixes: [],
    tier: 'account-deletion',
    clear: () => importedMnemonicStore.remove(),
  },
  {
    id: 'importedRestingPasscode',
    writers: ['src/features/security/appLock.ts'],
    medium: 'SecureStore',
    keys: [
      IMPORTED_RESTING_APP_LOCK_CREDENTIAL_KEY,
      IMPORTED_RESTING_APP_LOCK_ATTEMPTS_KEY,
    ],
    keyPrefixes: [],
    tier: 'account-deletion',
    clear: clearImportedRestingPasscode,
  },
  {
    id: 'importedResting',
    writers: ['src/features/session/importedResting.ts'],
    medium: 'SecureStore',
    keys: [IMPORTED_RESTING_KEY],
    keyPrefixes: [],
    tier: 'account-deletion',
    clear: () => importedRestingStore.clear(),
  },
  {
    // A connected wallet's sign-out drops the token through
    // `clearConnectedSession`. A deleted account drops the local token here,
    // without a round trip to the wallet app.
    id: 'mwaSession',
    writers: ['src/features/connect/mwaSessionStore.ts'],
    medium: 'SecureStore',
    keys: [MWA_AUTH_TOKEN_REF],
    keyPrefixes: [],
    tier: 'account-deletion',
    clear: () => mwaSessionStore.remove(),
  },
  {
    id: 'aiCredentials',
    writers: ['src/features/aiConnect/auth/tokenStore.ts'],
    medium: 'SecureStore',
    keys: [AI_CREDENTIAL_INDEX_KEY],
    keyPrefixes: [AI_CREDENTIAL_KEY_PREFIX],
    tier: 'account-deletion',
    clear: () => forgetAiCredentialsOnPhone(),
  },
  {
    id: 'analyticsInstallId',
    writers: ['src/lib/analyticsInstallId.ts'],
    medium: 'AsyncStorage',
    keys: [ANALYTICS_INSTALL_ID_KEY],
    keyPrefixes: [],
    tier: 'account-deletion',
    clear: rotateAnalyticsInstallId,
  },
] satisfies PerUserLocalStore[]);

/**
 * Per-user, but its keys belong to someone else and a session action clears
 * them. Every sign-out and the delete screen run that action.
 */
export const SESSION_OWNED_LOCAL_STORES = Object.freeze([
  {
    id: 'privySession',
    writers: ['src/features/security/privyStorage.ts'],
    medium: 'SecureStore',
    clearedBy: "Privy's logout(); the SDK names its own keys",
  },
] as const);

/** Kept across sign-out and account deletion on purpose. */
export const DEVICE_SCOPED_KEYS = Object.freeze([
  {
    key: PUSH_PENDING_KEY,
    writer: 'src/features/priceAlerts/pushRuntime.ts',
    medium: 'SecureStore',
    reason:
      'deletion-only row id and capability awaiting server acknowledgement; survives teardown and holds no push token or wallet',
  },
  {
    key: 'hasLaunchedBefore',
    writer: 'src/features/session/SessionContext.tsx',
    reason: 'the first-launch marker for this install; it names no one',
  },
  {
    key: '@corso/analytics/onboardingCompleted',
    writer: 'src/lib/analytics.ts',
    reason: "the once-per-install guard on one analytics event; it holds '1' and no id",
  },
  {
    key: '@corso/analytics/optOut',
    writer: 'src/lib/analyticsPreference.ts',
    reason:
      'the device-local analytics opt-out; clearing it would silently turn analytics back on',
  },
  {
    key: '@corso/disclosures/lastKnownGood/v1',
    writer: 'src/features/disclosures/disclosureCache.ts',
    reason: 'the server-written disclosure set, the same for everyone',
  },
  {
    key: HIDE_BALANCES_STORAGE_KEY,
    writer: 'src/features/balances/hideBalancesPreference.ts',
    reason:
      "the per-device Hide balances choice; it holds '1' or '0' and names no one",
  },
  {
    key: HOW_IT_WORKS_SEEN_KEY,
    writer: 'src/features/howItWorks/howItWorksPreference.ts',
    reason: 'once-per-install intro marker, names no one',
  },
  {
    key: RETURNING_DINARIO_NOTE_SEEN_KEY,
    writer: 'src/features/session/returningDinarioNote.ts',
    reason:
      'the returning-user note is shown once per phone; clearing it on sign-out would show it again. Names no one',
  },
  {
    key: PENDING_SIGN_OUT_CLEAR_KEY,
    writer: 'src/features/session/pendingSignOutClear.ts',
    reason:
      'a sign-out clear that has not finished on this phone; it names no one and is removed once that clear finishes',
  },
] as const);

export async function clearPerUserLocalStores(tier: LocalClearTier): Promise<LocalClearOutcome> {
  const storesByClear = new Map<() => Promise<void>, string[]>();
  for (const store of PER_USER_LOCAL_STORES) {
    if (tier === 'sign-out' && store.tier !== 'sign-out') continue;
    const ids = storesByClear.get(store.clear);
    if (ids) ids.push(store.id);
    else storesByClear.set(store.clear, [store.id]);
  }
  let pending = [...storesByClear.keys()];
  for (let attempt = 0; attempt < 2 && pending.length > 0; attempt += 1) {
    const failed: (() => Promise<void>)[] = [];
    for (const clear of pending) {
      try {
        await clear();
      } catch {
        failed.push(clear);
      }
    }
    pending = failed;
  }
  return { unfinished: pending.flatMap((clear) => storesByClear.get(clear) ?? []) };
}

export function __resetLocalClearRegistryForTests(): void {
  unconfirmedAiCredentials.clear();
}

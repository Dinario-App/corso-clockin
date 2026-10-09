import { EXPORT_CONSENT_VERSION } from '@/src/features/export/exportConfig';

export const EXPORT_CONSENT_COPY = {
  version: EXPORT_CONSENT_VERSION,

  gate1: {
    title: 'Before you export your private key',
    lede:
      'Your private key is the only thing needed to move your funds. Anyone who sees it, copies it, or photographs it can take everything in this wallet, immediately and permanently.',
    bullets: [
      'Corso cannot see your key, cannot recover it, and cannot reverse a transfer made with it.',
      'Corso support will never ask you for it. Anyone who does is trying to steal from you.',
      'Do not screenshot it, photograph it, type it into another app, paste it into a message, or store it in cloud notes or a password manager you do not fully control.',
      'Make sure no one can see your screen and no camera is pointed at it.',
      'Corso blocks screenshots where your device supports it. This does not stop a second camera.',
    ],
    outro:
      'The next screen opens the export page, operated by Corso. Your key is shown by your wallet provider inside that page and is never sent to Corso.',
    cancel: 'Cancel',
    confirm: 'I understand, continue',
    /** Shown until the user has scrolled the interstitial to the end. */
    scrollHint: 'Scroll to the end to continue',
  },

  gate2: {
    body: 'Your private key will appear here. Confirm no one else can see your screen.',
    reveal: 'Reveal private key',
  },

  gate3: {
    body: 'You are now the only person responsible for that key. If you saved it, store it somewhere only you can reach. If you think anyone else saw it, move your funds to a new wallet now.',
    done: 'Done',
  },

  errors: {
    entryDisabled:
      "Key export isn't available in this build. Nothing was opened.",
    consentUnavailable:
      "We couldn't show the full export warning, so we didn't open the export page. Try again.",
    originUnreachable:
      "We couldn't reach the Corso export page, so we didn't open it. Check your connection and try again.",
    stepUpRequired:
      'Export needs a security check first. Nothing was opened.',
    navigationBlocked:
      'The export page tried to go somewhere unexpected, so we closed it. Nothing was revealed.',
    exportFailed:
      "The export didn't finish. No key was shown. You can try again.",
    exportCancelled: 'Export cancelled. No key was shown.',
    notEmbeddedWallet:
      'This wallet was imported or connected, so Corso has nothing to export. You already hold its key.',
  },
} as const;

/** Every bullet + paragraph that MUST be present for Gate 1 to be complete. */
export function gate1RequiredBlocks(): string[] {
  return [
    EXPORT_CONSENT_COPY.gate1.title,
    EXPORT_CONSENT_COPY.gate1.lede,
    ...EXPORT_CONSENT_COPY.gate1.bullets,
    EXPORT_CONSENT_COPY.gate1.outro,
  ];
}

export type ConsentStage = 'gate1' | 'launching' | 'webview' | 'gate3' | 'closed';

export type Gate1State = {
  copyRendered: boolean;
  /** User reached the end of the scrollable interstitial. */
  scrolledToEnd: boolean;
  /** User pressed "I understand, continue". */
  acknowledged: boolean;
};

/** Primary action stays disabled until the copy rendered AND was scrolled. */
export function isGate1ConfirmEnabled(state: Gate1State): boolean {
  return state.copyRendered === true && state.scrolledToEnd === true;
}

export type LaunchDecision =
  | { launch: true }
  | {
      launch: false;
      reason:
        | 'entry_disabled'
        | 'consent_incomplete'
        | 'step_up_missing'
        | 'not_embedded_wallet';
    };

export function canLaunchExportWebView(input: {
  entryEnabled: boolean;
  gate1: Gate1State;
  stepUpPassed: boolean;
  sessionType: string | undefined | null;
}): LaunchDecision {
  if (!input.entryEnabled) return { launch: false, reason: 'entry_disabled' };
  if (input.sessionType !== 'privy_embedded') {
    return { launch: false, reason: 'not_embedded_wallet' };
  }
  if (
    !input.gate1.copyRendered ||
    !input.gate1.scrolledToEnd ||
    !input.gate1.acknowledged
  ) {
    return { launch: false, reason: 'consent_incomplete' };
  }
  if (!input.stepUpPassed) return { launch: false, reason: 'step_up_missing' };
  return { launch: true };
}

/** User-facing copy for a refused launch. Honest, never blank. */
export function launchRefusalMessage(
  reason: Exclude<LaunchDecision, { launch: true }>['reason'],
): string {
  switch (reason) {
    case 'entry_disabled':
      return EXPORT_CONSENT_COPY.errors.entryDisabled;
    case 'consent_incomplete':
      return EXPORT_CONSENT_COPY.errors.consentUnavailable;
    case 'step_up_missing':
      return EXPORT_CONSENT_COPY.errors.stepUpRequired;
    case 'not_embedded_wallet':
      return EXPORT_CONSENT_COPY.errors.notEmbeddedWallet;
    default:
      return EXPORT_CONSENT_COPY.errors.consentUnavailable;
  }
}

export type CaptureReadiness =
  | { status: 'pending' }
  | { status: 'ready' }
  | { status: 'best_effort'; reason: string }
  | { status: 'failed'; reason: string };

/** Grid is editable only after capture protection is ready or best-effort. */
export function isImportGridEditable(readiness: CaptureReadiness): boolean {
  return readiness.status === 'ready' || readiness.status === 'best_effort';
}

/**
 * Resolve readiness after a platform capture-setup attempt.
 * Android: reject → fail-closed (not editable).
 * iOS / other: reject → best-effort (still editable; banner path may apply).
 */
export function resolveCaptureSetupResult(args: {
  platform: 'android' | 'ios' | 'web' | string;
  ok: boolean;
  errorMessage?: string;
}): CaptureReadiness {
  if (args.ok) return { status: 'ready' };
  const reason = args.errorMessage?.trim() || 'capture_setup_failed';
  if (args.platform === 'android') {
    return { status: 'failed', reason };
  }
  return { status: 'best_effort', reason };
}

/**
 * Best-effort response when the OS reports active screen recording (iOS isCaptured).
 * Does not block the flow — remask + warning only.
 */
export function respondToRecordingCapture(isCaptured: boolean): {
  remask: boolean;
  showWarning: boolean;
} {
  if (isCaptured) {
    return { remask: true, showWarning: true };
  }
  return { remask: false, showWarning: false };
}

/** BIP-39 wordlist indexes matching a lowercase prefix (public dictionary only). */
export function bip39SuggestionIndexes(
  wordlist: readonly string[],
  prefix: string,
  limit = 6,
): number[] {
  if (!prefix) return [];
  const indexes: number[] = [];
  for (let i = 0; i < wordlist.length; i += 1) {
    if (wordlist[i]!.startsWith(prefix)) {
      indexes.push(i);
      if (indexes.length >= limit) break;
    }
  }
  return indexes;
}

/**
 * Whether switching 24→12 needs an explicit confirm before discarding words 13–24.
 */
export function needsDiscardConfirm(args: {
  currentLength: 12 | 24;
  nextLength: 12 | 24;
  filledBeyond12: boolean;
}): boolean {
  return (
    args.currentLength === 24 &&
    args.nextLength === 12 &&
    args.filledBeyond12
  );
}

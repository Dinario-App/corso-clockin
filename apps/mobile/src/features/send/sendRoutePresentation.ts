import { copy } from '@/constants/copy';
import { isFeeRateLabel } from '@/src/lib/feeRateLabel';
import { BOTTOM_SHEET_CONTENT_INSET } from '@/src/ui/primitives/bottomSheetPresentation.js';
import { colors, spacing } from '@/src/ui/tokens';

export const GRID_STEP_UP_PROVEN = false;

export const SEND_SCREEN_GUTTER = Math.max(
  0,
  spacing.gutter - BOTTOM_SHEET_CONTENT_INSET,
);

export const SEND_FORBIDDEN_DOOR_LABELS = [
  'Import recovery phrase',
  'Connect an existing wallet',
  'Connect with Seed Vault',
  'Continue with Apple',
  'Continue with Google',
  'Passkey',
  'Face ID',
  'Privy',
  'Squads',
  'Grid',
] as const;

export const SEND_FORBIDDEN_FEE_LABELS = [
  '85 bps',
  '0.85%',
  'Corso fee',
] as const;

export const SEND_CLEAR_LABEL = 'Clear';
export const SEND_SCAN_LABEL = 'Scan';
export const SEND_BACK_LABEL = 'Back';

export const SEND_SHIPPED_ADDRESS_ERROR = 'Enter a valid Solana address.';
export const SEND_SHIPPED_SOL_BALANCE_ERROR =
  'Not enough SOL to cover network fees';
export const SEND_SHIPPED_USDC_BALANCE_ERROR = 'Not enough USDC';

export type SendSourceState =
  | 'F076'
  | 'F077'
  | 'F078'
  | 'F079'
  | 'F080'
  | 'F081'
  | 'F167'
  | 'F082'
  | 'F083'
  | 'F084'
  | 'F085'
  | 'F086'
  | 'F087'
  | 'F088';

export type SendFeeStatus = 'idle' | 'loading' | 'ready' | 'error';

export type SendReviewRowKey =
  | 'to'
  | 'networkFee'
  | 'total'
  | 'rent'
  | 'solRequired';

export type SendStepUpChrome = {
  column: 'grid-account';
  noticeVisible: boolean;
  noticeText: string | null;
  challengeCta: 'none';
  importConnectChallenge: false;
  verifyCtaVisible: false;
};

export type SendScanChrome = {
  /** The scanner is live. It opens as a state of this sheet, never a route. */
  gated: false;
  liveScanner: true;
  usesTapTarget: true;
  lookLive: true;
  glyph: 'scan';
  glyphColor: string;
  surfaceColor: string;
  reason: null;
  accessibilityRole: 'button';
  accessibilityLabel: string;
  accessibilityHint: string;
  accessibilityState: { disabled: false };
};

export type SendFeeChrome = {
  kind: 'idle' | 'estimating' | 'ready' | 'unavailable';
  label: string;
  guessed: false;
  retryVisible: boolean;
  retryLabel: string | null;
};

export type SendBackChrome = {
  disabled: boolean;
  accessibilityLabel: string;
  accessibilityState: { disabled: boolean };
};

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asFeeStatus(value: unknown): SendFeeStatus {
  if (
    value === 'idle' ||
    value === 'loading' ||
    value === 'ready' ||
    value === 'error'
  ) {
    return value;
  }
  return 'idle';
}

function asSafeFeeLamports(value: unknown): number | null {
  if (typeof value !== 'number') return null;
  if (!Number.isSafeInteger(value) || value <= 0) return null;
  return value;
}

export function isSendReviewEnabled(input: {
  recipientValid?: unknown;
  amountPresent?: unknown;
  feeStatus?: unknown;
  feeLamports?: unknown;
  overBalance?: unknown;
}): boolean {
  const feeLamports = asSafeFeeLamports(input.feeLamports);
  return (
    asBoolean(input.recipientValid) &&
    asBoolean(input.amountPresent) &&
    asFeeStatus(input.feeStatus) === 'ready' &&
    feeLamports !== null &&
    !asBoolean(input.overBalance)
  );
}

export function resolveSendFeeChrome(input: {
  feeStatus?: unknown;
  feeLamports?: unknown;
}): SendFeeChrome {
  const status = asFeeStatus(input.feeStatus);
  if (status === 'loading') {
    return {
      kind: 'estimating',
      label: copy.send.feeEstimating,
      guessed: false,
      retryVisible: false,
      retryLabel: null,
    };
  }
  if (status === 'error' || (status === 'ready' && asSafeFeeLamports(input.feeLamports) === null)) {
    return {
      kind: 'unavailable',
      label: copy.send.feeUnavailable,
      guessed: false,
      retryVisible: true,
      retryLabel: copy.send.feeRetry,
    };
  }
  if (status === 'ready' && asSafeFeeLamports(input.feeLamports) !== null) {
    return {
      kind: 'ready',
      label: copy.send.feeLabel,
      guessed: false,
      retryVisible: false,
      retryLabel: null,
    };
  }
  return {
    kind: 'idle',
    label: copy.send.feeUnknown,
    guessed: false,
    retryVisible: false,
    retryLabel: null,
  };
}

export function resolveSendBackChrome(input: {
  busy?: unknown;
}): SendBackChrome {
  const disabled = asBoolean(input.busy);
  return {
    disabled,
    accessibilityLabel: SEND_BACK_LABEL,
    accessibilityState: { disabled },
  };
}

export function resolveSendScanChrome(): SendScanChrome {
  return {
    gated: false,
    liveScanner: true,
    usesTapTarget: true,
    lookLive: true,
    glyph: 'scan',
    glyphColor: colors.ink,
    surfaceColor: colors.glassFill,
    reason: null,
    accessibilityRole: 'button',
    accessibilityLabel: SEND_SCAN_LABEL,
    accessibilityHint: copy.send.scanHint,
    accessibilityState: { disabled: false },
  };
}

export function resolveSendStepUpChrome(input: {
  showNotice?: unknown;
  thresholdLabel?: unknown;
  gridStepUpProven?: unknown;
}): SendStepUpChrome {
  const proven = asBoolean(input.gridStepUpProven) && GRID_STEP_UP_PROVEN;
  const threshold =
    typeof input.thresholdLabel === 'string' ? input.thresholdLabel.trim() : '';
  const noticeVisible = asBoolean(input.showNotice) && threshold.length > 0;
  void proven;
  return {
    column: 'grid-account',
    noticeVisible,
    noticeText: noticeVisible ? copy.stepup.reviewNotice(threshold) : null,
    challengeCta: 'none',
    importConnectChallenge: false,
    verifyCtaVisible: false,
  };
}

export function resolveSendReviewRowKeys(input: {
  asset?: unknown;
  needsDestinationAta?: unknown;
}): SendReviewRowKey[] {
  const rows: SendReviewRowKey[] = ['to', 'networkFee'];
  if (input.asset === 'USDC') {
    if (asBoolean(input.needsDestinationAta)) {
      rows.push('rent');
    }
    rows.push('solRequired');
    return rows;
  }
  rows.push('solRequired', 'total');
  return rows;
}

export function resolveSendReviewRowLabels(input: {
  asset?: unknown;
  needsDestinationAta?: unknown;
}): string[] {
  const keys = resolveSendReviewRowKeys(input);
  return keys.map((key) => {
    switch (key) {
      case 'to':
        return copy.send.reviewTo;
      case 'networkFee':
        return copy.send.reviewFee;
      case 'total':
        return copy.send.reviewTotal;
      case 'rent':
        return copy.send.rentLabel;
      case 'solRequired':
        return copy.send.totalCostLabel;
    }
  });
}

export function resolveSendSourceState(input: {
  sendEnabled?: unknown;
  step?: unknown;
  busy?: unknown;
  cancelled?: unknown;
  sendFailed?: unknown;
  showStepUpNotice?: unknown;
  feeStatus?: unknown;
  overBalance?: unknown;
  amountBlurred?: unknown;
  recipientEmpty?: unknown;
  recipientValid?: unknown;
  recipientBlurred?: unknown;
  amountPresent?: unknown;
  feeLamports?: unknown;
}): SendSourceState {
  if (input.sendEnabled === false) {
    return 'F088';
  }
  if (input.step === 'success') {
    return 'F085';
  }
  if (input.step === 'review') {
    if (asBoolean(input.busy)) return 'F084';
    if (asBoolean(input.cancelled)) return 'F087';
    if (asBoolean(input.sendFailed)) return 'F086';
    if (asBoolean(input.showStepUpNotice)) return 'F083';
    return 'F082';
  }

  const fee = resolveSendFeeChrome({
    feeStatus: input.feeStatus,
    feeLamports: input.feeLamports,
  });
  if (fee.kind === 'unavailable') return 'F080';
  if (fee.kind === 'estimating') return 'F079';
  if (asBoolean(input.overBalance) && asBoolean(input.amountBlurred)) {
    return 'F078';
  }
  if (
    !asBoolean(input.recipientEmpty) &&
    !asBoolean(input.recipientValid) &&
    asBoolean(input.recipientBlurred)
  ) {
    return 'F077';
  }
  if (
    isSendReviewEnabled({
      recipientValid: input.recipientValid,
      amountPresent: input.amountPresent,
      feeStatus: input.feeStatus,
      feeLamports: input.feeLamports,
      overBalance: input.overBalance,
    })
  ) {
    return 'F081';
  }
  if (asBoolean(input.recipientValid)) {
    return 'F167';
  }
  return 'F076';
}

export function resolveSendComposeError(input: {
  frame?: unknown;
  formError?: unknown;
}): string | null {
  if (typeof input.formError === 'string' && input.formError.trim()) {
    return input.formError.trim();
  }
  if (input.frame === 'F077') return SEND_SHIPPED_ADDRESS_ERROR;
  if (input.frame === 'F078') return SEND_SHIPPED_SOL_BALANCE_ERROR;
  return null;
}

export function resolveSendPrimaryLabel(frame: SendSourceState): string {
  switch (frame) {
    case 'F082':
    case 'F083':
    case 'F084':
      return copy.send.confirm;
    case 'F085':
      return copy.send.successDone;
    case 'F086':
      return copy.send.review;
    case 'F087':
      return copy.send.review;
    default:
      return copy.send.review;
  }
}

export function isSendCancelledError(message: unknown): boolean {
  if (typeof message !== 'string') return false;
  const trimmed = message.trim();
  return (
    trimmed === copy.send.errorCancelled || trimmed.startsWith('Transaction not sent')
  );
}

export function assertNoForbiddenSendDoors(labels: unknown[]): void {
  for (const label of labels) {
    if (typeof label !== 'string') continue;
    const normalized = label.trim().toLowerCase();
    for (const forbidden of SEND_FORBIDDEN_DOOR_LABELS) {
      if (normalized.includes(forbidden.toLowerCase())) {
        throw new Error(`Forbidden send door label: ${label}`);
      }
    }
  }
}

export function assertNoCorsoFeeOnSend(labels: unknown[]): void {
  for (const label of labels) {
    if (typeof label !== 'string') continue;
    const normalized = label.trim().toLowerCase();
    if (normalized.includes('withdraw')) {
      throw new Error(`Forbidden send copy: ${label}`);
    }
    if (
      isFeeRateLabel(label) ||
      SEND_FORBIDDEN_FEE_LABELS.some((forbidden) => normalized.includes(forbidden.toLowerCase()))
    ) {
      throw new Error(`Forbidden Corso fee on Send: ${label}`);
    }
  }
}

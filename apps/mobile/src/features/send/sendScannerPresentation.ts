/**
 * The scanner is a state of the Send sheet, not a destination.
 *
 * Everything here is pure so the camera-denied path can be tested without a
 * camera. `SendScanner.tsx` supplies the permission value and renders what
 * comes back.
 */
import { copy } from '@/constants/copy';
import type {
  ScanRejection,
  ScannedRequest,
} from '@/src/features/send/solanaPayRequest';

/** Mirrors the three answers a camera permission request can give. */
export type CameraPermission = 'undetermined' | 'granted' | 'denied';

export type SendScannerBody = 'asking' | 'live' | 'denied';

export type SendScannerChrome = {
  body: SendScannerBody;
  title: string;
  /** Null while the camera is live — the viewfinder is the instruction. */
  body_text: string | null;
  hint: string | null;
  /** Rendered as a GlassPill. Null when the state has no action of its own. */
  actionLabel: string | null;
  action: 'open-settings' | null;
  closeLabel: string;
  cameraActive: boolean;
};

export function resolveSendScannerChrome(input: {
  permission?: unknown;
}): SendScannerChrome {
  const permission: CameraPermission =
    input.permission === 'granted' || input.permission === 'denied'
      ? input.permission
      : 'undetermined';

  if (permission === 'granted') {
    return {
      body: 'live',
      title: copy.send.scanTitle,
      body_text: null,
      hint: copy.send.scanHint,
      actionLabel: null,
      action: null,
      closeLabel: copy.send.scanClose,
      cameraActive: true,
    };
  }

  if (permission === 'denied') {
    return {
      body: 'denied',
      title: copy.send.scanDeniedTitle,
      body_text: copy.send.scanDeniedBody,
      hint: null,
      actionLabel: copy.send.scanOpenSettings,
      action: 'open-settings',
      closeLabel: copy.send.scanClose,
      cameraActive: false,
    };
  }

  return {
    body: 'asking',
    title: copy.send.scanTitle,
    body_text: copy.send.scanAsking,
    hint: null,
    actionLabel: null,
    action: null,
    closeLabel: copy.send.scanClose,
    cameraActive: false,
  };
}

/** One sentence for anything the camera read that Corso will not use. */
export function scanRejectionMessage(reason: ScanRejection): string {
  switch (reason) {
    case 'bad-amount':
      return copy.send.scanBadAmount;
    case 'unsupported-token':
      return copy.send.scanUnsupportedToken;
    case 'not-solana':
    case 'transaction-request':
    case 'empty':
    case 'malformed':
      return copy.send.scanNotSolana;
    case 'self':
      return copy.send.addressSelf;
    case 'system-program':
      return copy.send.addressBurn;
    case 'token-mint':
      return copy.send.addressTokenMint;
    case 'off-curve':
      return copy.send.addressOffCurve;
  }
}

/**
 * What the code filled in, said out loud.
 *
 * A payment code that carries an amount must never apply it quietly — the
 * person scanning did not type that number.
 */
export function scanPrefillNotice(request: ScannedRequest): string | null {
  if (request.amount !== null) {
    return copy.send.scanFilled(request.amount, request.asset);
  }
  if (request.assetFromRequest) {
    return copy.send.scanFilledAsset(request.asset);
  }
  return null;
}

import type { SignerCapabilities } from '@corso/wallet';
import type { SessionType } from '@/src/features/session/types';
import { MwaError } from './mwaTypes';

export function assertMwaMoneyPathAvailable(input: {
  sessionType: SessionType;
  capabilities: SignerCapabilities;
  readOnly?: boolean;
  connectedStatus?: 'none' | 'restoring' | 'ready' | 'degraded';
}): void {
  if (input.sessionType !== 'connected_external') {
    return;
  }
  if (input.readOnly === true) throw new MwaError('unsupported_capability');
  if (input.connectedStatus !== 'ready') {
    throw new MwaError('reauthorization_failed');
  }
  if (input.capabilities.signTransaction !== true) {
    throw new MwaError('unsupported_capability');
  }
}

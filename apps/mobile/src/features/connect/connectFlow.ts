import { MwaError, isMwaError, type MwaIdentity } from './mwaTypes';
export type ConnectState = 'idle' | 'opening' | 'connected' | 'cancelled' | 'wallet_not_found' | 'timeout' | 'wrong_cluster' | 'failed';
export const MWA_IDENTITY: MwaIdentity = Object.freeze({ name: 'Corso', uri: 'https://corso.trade', icon: 'site/assets/favicon-pari-32.png' });
export function validMwaIdentity(identity: MwaIdentity): boolean {
  try {
    const uri = new URL(identity.uri);
    if (!identity.icon || identity.icon.trim() !== identity.icon || /^[a-z][a-z\d+.-]*:/i.test(identity.icon) || identity.icon.startsWith('//')) return false;
    const icon = new URL(identity.icon, uri);
    return identity.name === 'Corso' && uri.protocol === 'https:' && icon.protocol === 'https:' && uri.origin === icon.origin && !uri.username && !uri.password && !icon.username && !icon.password;
  } catch { return false; }
}
export function normalizeMwaTransportError(error: unknown): unknown {
  if (isMwaError(error)) return error;
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
  switch (code) {
    case 'ERROR_WALLET_NOT_FOUND': return new MwaError('wallet_not_found');
    case 'ERROR_SESSION_TIMEOUT': return new MwaError('timeout');
    case -7: return new MwaError('wrong_cluster');
    case -1:
    case 'ERROR_SESSION_CLOSED':
    case 'ERROR_ASSOCIATION_CANCELLED': return new MwaError('cancelled');
    default: return error;
  }
}
export function connectFailureState(error: unknown): ConnectState {
  if (isMwaError(error) && ['cancelled', 'wallet_not_found', 'timeout', 'wrong_cluster'].includes(error.code)) return error.code as ConnectState;
  return 'failed';
}
export async function runConnectFlow<T>(args: { connect: () => Promise<T>; apply: (value: T) => void; update: (state: ConnectState) => void }): Promise<void> {
  args.update('opening');
  try { const result = await args.connect(); args.apply(result); args.update('connected'); }
  catch (error) { args.update(connectFailureState(error)); }
}

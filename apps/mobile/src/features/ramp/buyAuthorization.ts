import { Buffer } from 'buffer';
import type { RampAsset } from '@/src/features/ramp/rampAssets';

export type BuyAuthorizationSession = {
  type: 'privy_embedded' | 'imported_seed' | 'connected_external';
  address: string;
};

export type BuyAuthorizationSigner = BuyAuthorizationSession & {
  signMessage(message: Uint8Array): Promise<Uint8Array>;
  clear?: () => void;
};

export type AuthorizedRampPayload = {
  walletAddress: string;
  asset: RampAsset;
  redirectUrl: string;
  provider: 'moonpay';
  defaultCurrencyCode?: string;
  baseCurrencyAmount?: number;
};

export type BuyAuthorizationErrorCode =
  | 'declined'
  | 'unavailable'
  | 'expired'
  | 'door_unsupported'
  | 'session_changed';

export class BuyAuthorizationError extends Error {
  constructor(readonly code: BuyAuthorizationErrorCode) {
    super('Buy authorization could not be completed.');
    this.name = 'BuyAuthorizationError';
  }
}

export function buildBuyAuthorizationMessage(input: {
  walletAddress: string;
  asset: RampAsset;
  nonce: string;
  expiresAt: string;
}): Uint8Array {
  return Buffer.from(
    `Corso Buy authorization v1\n\n` +
      `I control this wallet and I'm starting a purchase in Corso.\n` +
      `This message cannot move funds and cannot be used to sign a transaction.\n\n` +
      `Wallet: ${input.walletAddress}\n` +
      `Buying: ${input.asset} on Solana\n` +
      `Code:   ${input.nonce}\n` +
      `Expires: ${input.expiresAt}`,
    'utf8',
  );
}

function sameSession(
  expected: BuyAuthorizationSession,
  current: BuyAuthorizationSession | null,
): boolean {
  return (
    current?.type === expected.type && current.address === expected.address
  );
}

function requireLiveSession(args: {
  expected: BuyAuthorizationSession;
  currentSession: () => BuyAuthorizationSession | null;
  isLocked: () => boolean;
}) {
  if (!sameSession(args.expected, args.currentSession())) {
    throw new BuyAuthorizationError('session_changed');
  }
  if (args.isLocked()) {
    throw new BuyAuthorizationError('unavailable');
  }
}

function isUserCancellation(error: unknown): boolean {
  return (
    error instanceof Error &&
    /cancel|canceled|cancelled|user_canceled/i.test(error.message)
  );
}

export async function authorizeBuyRamp<T>(args: {
  body: AuthorizedRampPayload;
  currentSession: () => BuyAuthorizationSession | null;
  isLocked: () => boolean;
  issueChallenge(input: {
    walletAddress: string;
    asset: RampAsset;
  }): Promise<{
    nonce: string;
    expiresAt: string;
    issuedFor: { walletAddress: string; asset: RampAsset };
    [key: string]: unknown;
  }>;
  getSigner(
    expected: BuyAuthorizationSession,
  ): Promise<BuyAuthorizationSigner>;
  submitSession(
    body: AuthorizedRampPayload & { nonce: string; signature: string },
  ): Promise<T>;
  now?: () => number;
}): Promise<T> {
  const session = args.currentSession();
  if (!session || session.address !== args.body.walletAddress) {
    throw new BuyAuthorizationError('session_changed');
  }
  if (session.type === 'connected_external') {
    throw new BuyAuthorizationError('door_unsupported');
  }
  requireLiveSession({
    expected: session,
    currentSession: args.currentSession,
    isLocked: args.isLocked,
  });

  let challenge;
  try {
    challenge = await args.issueChallenge({
      walletAddress: args.body.walletAddress,
      asset: args.body.asset,
    });
  } catch {
    throw new BuyAuthorizationError('unavailable');
  }

  const expiresAtMs = Date.parse(challenge.expiresAt);
  if (
    !/^[A-Za-z0-9_-]{16,128}$/.test(challenge.nonce) ||
    !Number.isFinite(expiresAtMs) ||
    challenge.issuedFor?.walletAddress !== args.body.walletAddress ||
    challenge.issuedFor?.asset !== args.body.asset
  ) {
    throw new BuyAuthorizationError('unavailable');
  }
  const now = args.now ?? Date.now;
  if (expiresAtMs <= now()) {
    throw new BuyAuthorizationError('expired');
  }

  requireLiveSession({
    expected: session,
    currentSession: args.currentSession,
    isLocked: args.isLocked,
  });
  let signer: BuyAuthorizationSigner | undefined;
  let signatureBytes: Uint8Array;
  try {
    signer = await args.getSigner(session);
    requireLiveSession({
      expected: session,
      currentSession: args.currentSession,
      isLocked: args.isLocked,
    });
    if (!sameSession(session, signer)) {
      throw new BuyAuthorizationError('session_changed');
    }
    signatureBytes = await signer.signMessage(
      buildBuyAuthorizationMessage({
        walletAddress: args.body.walletAddress,
        asset: args.body.asset,
        nonce: challenge.nonce,
        expiresAt: challenge.expiresAt,
      }),
    );
  } catch (error) {
    if (error instanceof BuyAuthorizationError) throw error;
    throw new BuyAuthorizationError(
      isUserCancellation(error) ? 'declined' : 'unavailable',
    );
  } finally {
    signer?.clear?.();
  }

  if (signatureBytes.length !== 64) {
    throw new BuyAuthorizationError('unavailable');
  }
  if (expiresAtMs <= now()) {
    throw new BuyAuthorizationError('expired');
  }
  requireLiveSession({
    expected: session,
    currentSession: args.currentSession,
    isLocked: args.isLocked,
  });

  const result = await args.submitSession({
    ...args.body,
    nonce: challenge.nonce,
    signature: Buffer.from(signatureBytes).toString('base64'),
  });
  requireLiveSession({
    expected: session,
    currentSession: args.currentSession,
    isLocked: args.isLocked,
  });
  return result;
}

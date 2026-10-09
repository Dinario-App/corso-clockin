import type { PublicAppConfig } from '@/src/lib/apiConfig';
import { observeRampIp } from '@/src/features/ramp/observeRampIp';
import {
  buildRampSessionPayload,
  type RampSessionPayload,
} from '@/src/features/ramp/buildRampSessionPayload';
import type { RampAsset } from '@/src/features/ramp/rampAssets';
import {
  authorizeBuyRamp,
  BuyAuthorizationError,
  type BuyAuthorizationSession,
  type BuyAuthorizationSigner,
} from '@/src/features/ramp/buyAuthorization';
import type {
  BuyAuthAnalyticsEvent,
  BuyAuthFailureReason,
} from '@/src/features/ramp/buyAuthAnalytics';

export type { RampAsset };

export type RampSessionRequest = {
  walletAddress: string;
  /** Bounded SOL | USDC — required; never invents a default for the network path. */
  asset: RampAsset;
  provider?: 'moonpay';
  defaultCurrencyCode?: string;
  baseCurrencyAmount?: number;
  /**
   * Exact HTTPS return URL (same value for API redirectUrl and WebBrowser).
   * Must already be validated or will be re-validated in buildRampSessionPayload.
   */
  redirectUrl: string;
};

export type RampSessionResponse = {
  url: string;
  sessionId: string;
  provider: 'moonpay';
  asset?: RampAsset;
};

export type RampSessionError = {
  error: string;
  message: string;
};

export type RampSessionAuthorizationContext = {
  currentSession: () => BuyAuthorizationSession | null;
  isLocked: () => boolean;
  getSigner(
    expected: BuyAuthorizationSession,
  ): Promise<BuyAuthorizationSigner>;
  onBuyAuthEvent?(event: BuyAuthAnalyticsEvent): void;
};

function buyAuthFailureReason(error: string): BuyAuthFailureReason {
  const code = error.trim().toLowerCase();
  if (code.includes('declined')) return 'declined';
  if (code.includes('expired')) return 'expired';
  if (code.includes('mismatch') || code.includes('session_changed')) {
    return 'mismatch';
  }
  if (code.includes('replayed')) return 'replayed';
  if (code.includes('door_unsupported')) return 'door_unsupported';
  return 'unavailable';
}

function apiBaseUrl(): string | null {
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, '');
}

export async function createRampSession(
  body: RampSessionRequest,
  authorization: RampSessionAuthorizationContext,
): Promise<
  | { ok: true; data: RampSessionResponse }
  | { ok: false; status: number; error: string; message: string }
> {
  const base = apiBaseUrl();
  if (!base) {
    return {
      ok: false,
      status: 0,
      error: 'api_unreachable',
      message: 'API URL is not configured.',
    };
  }

  const built = buildRampSessionPayload({
    walletAddress: body.walletAddress,
    asset: body.asset,
    redirectUrl: body.redirectUrl,
    defaultCurrencyCode: body.defaultCurrencyCode,
    baseCurrencyAmount: body.baseCurrencyAmount,
  });

  if (!built.ok) {
    return {
      ok: false,
      status: 0,
      error: built.error,
      message: 'Could not start Buy.',
    };
  }

  const payload: RampSessionPayload = built.body;
  const authSession = authorization.currentSession();
  const emitAuth = authorization.onBuyAuthEvent ?? (() => undefined);
  if (authSession) {
    emitAuth({
      name: 'buy_auth_started',
      properties: { session_type: authSession.type },
    });
  }

  try {
    const result = await authorizeBuyRamp({
      body: payload,
      currentSession: authorization.currentSession,
      isLocked: authorization.isLocked,
      getSigner: authorization.getSigner,
      issueChallenge: async (challengeBody) => {
        const response = await fetch(`${base}/v1/ramps/challenge`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(challengeBody),
        });
        const json = (await response.json()) as {
          nonce?: string;
          expiresAt?: string;
          issuedFor?: { walletAddress?: string; asset?: RampAsset };
          error?: string;
        };
        if (
          !response.ok ||
          typeof json.nonce !== 'string' ||
          typeof json.expiresAt !== 'string' ||
          typeof json.issuedFor?.walletAddress !== 'string' ||
          (json.issuedFor.asset !== 'SOL' && json.issuedFor.asset !== 'USDC')
        ) {
          throw new Error('Buy authorization is unavailable.');
        }
        return {
          nonce: json.nonce,
          expiresAt: json.expiresAt,
          issuedFor: {
            walletAddress: json.issuedFor.walletAddress,
            asset: json.issuedFor.asset,
          },
        };
      },
      submitSession: async (authorizedPayload) => {
        const ipAttestationToken = await observeRampIp(base, authorizedPayload);
        const live = authorization.currentSession();
        if (!authSession || live?.type !== authSession.type || live.address !== authSession.address) {
          throw new BuyAuthorizationError('session_changed');
        }
        if (authorization.isLocked()) throw new BuyAuthorizationError('unavailable');
        const response = await fetch(`${base}/v1/ramps/session`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...authorizedPayload, ...(ipAttestationToken ? { ipAttestationToken } : {}) }),
        });
        const json = (await response.json()) as
          | RampSessionResponse
          | RampSessionError;
        if (!response.ok) {
          const err = json as RampSessionError;
          return {
            ok: false as const,
            status: response.status,
            error: err.error ?? 'ramp_failed',
            message: err.message ?? 'Could not start Buy.',
          };
        }
        return { ok: true as const, data: json as RampSessionResponse };
      },
    });
    if (authSession) {
      if (result.ok) {
        emitAuth({
          name: 'buy_auth_succeeded',
          properties: { session_type: authSession.type },
        });
      } else {
        emitAuth({
          name: 'buy_auth_failed',
          properties: {
            session_type: authSession.type,
            reason: buyAuthFailureReason(result.error),
          },
        });
      }
    }
    return result;
  } catch (error) {
    if (error instanceof BuyAuthorizationError) {
      if (authSession) {
        const reason = buyAuthFailureReason(error.code);
        emitAuth({
          name:
            reason === 'door_unsupported'
              ? 'buy_auth_blocked'
              : 'buy_auth_failed',
          properties: { session_type: authSession.type, reason },
        });
      }
      return {
        ok: false,
        status: 0,
        error: `ramp_auth_${error.code}`,
        message: 'Buy authorization could not be completed.',
      };
    }
    if (authSession) {
      emitAuth({
        name: 'buy_auth_failed',
        properties: {
          session_type: authSession.type,
          reason: 'unavailable',
        },
      });
    }
    return {
      ok: false,
      status: 0,
      error: 'network_error',
      message: 'Could not reach Buy service.',
    };
  }
}

export type { PublicAppConfig };

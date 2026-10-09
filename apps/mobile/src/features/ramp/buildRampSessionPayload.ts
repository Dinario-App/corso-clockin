/**
 * Pure ramp session request builder.
 * Bounds asset to SOL|USDC and requires a validated HTTPS redirectUrl.
 */

import {
  isBoundedRampAsset,
  type RampAsset,
} from '@/src/features/ramp/rampAssets';
import { validateRampReturnUrl } from '@/src/features/ramp/rampReturnUrl';

export type RampSessionPayload = {
  walletAddress: string;
  provider: 'moonpay';
  asset: RampAsset;
  redirectUrl: string;
  defaultCurrencyCode?: string;
  baseCurrencyAmount?: number;
};

export type BuildRampSessionPayloadResult =
  | { ok: true; body: RampSessionPayload }
  | {
      ok: false;
      error:
        | 'invalid_wallet'
        | 'invalid_asset'
        | 'ramp_redirect_not_configured'
        | 'ramp_redirect_not_allowed';
    };

/**
 * Build the JSON body for POST /v1/ramps/session.
 * Fails closed on missing/invalid HTTPS return URL or non-bounded asset.
 */
export function buildRampSessionPayload(args: {
  walletAddress: string;
  asset: unknown;
  /** Pre-read env or injected URL string — still re-validated here. */
  redirectUrl: string | undefined | null;
  defaultCurrencyCode?: string;
  baseCurrencyAmount?: number;
}): BuildRampSessionPayloadResult {
  const wallet = args.walletAddress.trim();
  if (!wallet) {
    return { ok: false, error: 'invalid_wallet' };
  }

  if (!isBoundedRampAsset(args.asset)) {
    return { ok: false, error: 'invalid_asset' };
  }

  const redirect = validateRampReturnUrl(args.redirectUrl);
  if (!redirect.ok) {
    return {
      ok: false,
      error:
        redirect.reason === 'missing'
          ? 'ramp_redirect_not_configured'
          : 'ramp_redirect_not_allowed',
    };
  }

  const body: RampSessionPayload = {
    walletAddress: wallet,
    provider: 'moonpay',
    asset: args.asset,
    redirectUrl: redirect.url,
  };

  if (args.defaultCurrencyCode !== undefined) {
    body.defaultCurrencyCode = args.defaultCurrencyCode;
  }
  if (args.baseCurrencyAmount !== undefined) {
    body.baseCurrencyAmount = args.baseCurrencyAmount;
  }

  return { ok: true, body };
}

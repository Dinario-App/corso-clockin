import {
  clampRampAsset,
  isRampAssetSelectable,
  type RampAsset,
  type RampFlags,
} from '@/src/features/ramp/rampAssets';
import {
  resolveRampErrorMessage,
  type RampErrorCopyKey,
} from '@/src/features/ramp/mapRampError';
import { validateRampReturnUrl } from '@/src/features/ramp/rampReturnUrl';

export type BuyRampErrorMessages = Record<RampErrorCopyKey, string>;

export type BuyContinueMessages = BuyRampErrorMessages & {
  missingAddress: string;
};

export type CreateRampSessionFn = (body: {
  walletAddress: string;
  asset: RampAsset;
  redirectUrl: string;
  baseCurrencyAmount?: number;
}) => Promise<
  | { ok: true; data: { url: string; sessionId: string; provider: string } }
  | { ok: false; error: string; message?: string }
>;

export type OpenAuthSessionFn = (
  widgetUrl: string,
  returnUrl: string,
) => Promise<{ type: string }>;

export type RampOpenedEvent = {
  provider: string;
  asset: RampAsset;
};

export type OnRampOpenedFn = (event: RampOpenedEvent) => void;

const APPROVED_MOONPAY_WIDGET_ORIGINS = new Set([
  'https://buy-sandbox.moonpay.com',
  'https://buy.moonpay.com',
]);

const MOONPAY_CURRENCY_CODE_BY_ASSET: Record<RampAsset, string> = {
  SOL: 'sol',
  USDC: 'usdc_sol',
};

type ExpectedMoonPayWidget = {
  baseCurrencyAmount?: number;
  provider: string;
  walletAddress: string;
  asset: RampAsset;
  redirectUrl: string;
  sessionId: string;
};

type RampWidgetUrlValidation = { ok: true; url: string } | { ok: false };

/**
 * Validate the API-returned widget URL against the API's exact MoonPay contract.
 * No wildcard subdomains, alternate paths, credentials, fragments, duplicated
 * signed fields, or substitutions from the request/session being opened.
 */
export function validateMoonPayWidgetUrl(
  value: string | undefined | null,
  expected: ExpectedMoonPayWidget,
): RampWidgetUrlValidation {
  const raw = value?.trim() ?? '';
  if (!raw) return { ok: false };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false };
  }

  if (
    url.protocol !== 'https:' ||
    !APPROVED_MOONPAY_WIDGET_ORIGINS.has(url.origin) ||
    url.pathname !== '/' ||
    url.username !== '' ||
    url.password !== '' ||
    url.hash !== ''
  ) {
    return { ok: false };
  }

  if (expected.provider !== 'moonpay' || expected.sessionId.trim() === '') {
    return { ok: false };
  }

  const exactlyOne = (key: string): string | null => {
    const values = url.searchParams.getAll(key);
    return values.length === 1 ? values[0]! : null;
  };

  const apiKey = exactlyOne('apiKey');
  const signature = exactlyOne('signature');
  if (
    apiKey === null ||
    apiKey.trim() === '' ||
    signature === null ||
    signature.trim() === '' ||
    exactlyOne('walletAddress') !== expected.walletAddress ||
    exactlyOne('currencyCode') !==
      MOONPAY_CURRENCY_CODE_BY_ASSET[expected.asset] ||
    exactlyOne('redirectURL') !== expected.redirectUrl ||
    exactlyOne('externalTransactionId') !== expected.sessionId
  ) {
    return { ok: false };
  }

  if (
    expected.baseCurrencyAmount !== undefined &&
    (exactlyOne('baseCurrencyAmount') === null ||
      Number(exactlyOne('baseCurrencyAmount')) !==
        expected.baseCurrencyAmount ||
      exactlyOne('baseCurrencyCode') !== 'usd')
  )
    return { ok: false };

  return { ok: true, url: url.href };
}

export type BuyContinueResult =
  | {
      ok: true;
      asset: RampAsset;
      sessionId: string;
      provider: string;
      widgetUrl: string;
      returnUrl: string;
      browserType: string;
    }
  | { ok: false; errorMessage: string };

/**
 * Build the error-message map used by Buy screens from the real copy dictionary shape.
 */
export function buyRampErrorMessages(buy: {
  disabled: string;
  errorReturnNotConfigured: string;
  errorAssetDisabled: string;
  unsupportedGeo: string;
  errorProviderUnsupported: string;
  authDeclined: string;
  authUnavailable: string;
  authExpired: string;
  authDoorUnsupported: string;
  errorGeneric: string;
}): BuyRampErrorMessages {
  return {
    disabled: buy.disabled,
    returnNotConfigured: buy.errorReturnNotConfigured,
    assetDisabled: buy.errorAssetDisabled,
    unsupportedGeo: buy.unsupportedGeo,
    providerUnsupported: buy.errorProviderUnsupported,
    authDeclined: buy.authDeclined,
    authUnavailable: buy.authUnavailable,
    authExpired: buy.authExpired,
    authDoorUnsupported: buy.authDoorUnsupported,
    generic: buy.errorGeneric,
  };
}

export async function runBuyContinue(args: {
  walletAddress: string | undefined | null;
  selectedAsset: RampAsset | null;
  flags: RampFlags;
  baseCurrencyAmount?: number;
  /** Raw env / injected return URL candidate. */
  returnUrlRaw: string | undefined | null;
  messages: BuyContinueMessages;
  createSession: CreateRampSessionFn;
  openAuthSession: OpenAuthSessionFn;
  /** Emitted exactly once after widget validation and immediately before open. */
  onRampOpened: OnRampOpenedFn;
}): Promise<BuyContinueResult> {
  const flags: RampFlags = {
    rampEnabled: args.flags.rampEnabled === true,
    rampUsdcEnabled: args.flags.rampUsdcEnabled === true,
  };

  const wallet = args.walletAddress?.trim() ?? '';
  if (!wallet) {
    return { ok: false, errorMessage: args.messages.missingAddress };
  }

  if (
    args.selectedAsset !== null &&
    !isRampAssetSelectable(args.selectedAsset, flags)
  ) {
    return { ok: false, errorMessage: args.messages.assetDisabled };
  }

  const asset = clampRampAsset(args.selectedAsset, flags);
  if (!asset) {
    return { ok: false, errorMessage: args.messages.disabled };
  }

  const returnUrl = validateRampReturnUrl(args.returnUrlRaw);
  if (!returnUrl.ok) {
    return { ok: false, errorMessage: args.messages.returnNotConfigured };
  }

  if (
    args.baseCurrencyAmount !== undefined &&
    (!Number.isFinite(args.baseCurrencyAmount) || args.baseCurrencyAmount <= 0)
  ) {
    return { ok: false, errorMessage: args.messages.generic };
  }

  const session = await args.createSession({
    walletAddress: wallet,
    asset,
    redirectUrl: returnUrl.url,
    ...(args.baseCurrencyAmount === undefined
      ? {}
      : { baseCurrencyAmount: args.baseCurrencyAmount }),
  });

  if (!session.ok) {
    return {
      ok: false,
      errorMessage: resolveRampErrorMessage(session.error, args.messages),
    };
  }

  const widgetUrl = validateMoonPayWidgetUrl(session.data.url, {
    provider: session.data.provider,
    walletAddress: wallet,
    asset,
    redirectUrl: returnUrl.url,
    sessionId: session.data.sessionId,
    baseCurrencyAmount: args.baseCurrencyAmount,
  });
  if (!widgetUrl.ok) {
    return {
      ok: false,
      errorMessage: args.messages.providerUnsupported,
    };
  }

  args.onRampOpened({
    provider: session.data.provider,
    asset,
  });

  const browserResult = await args.openAuthSession(
    widgetUrl.url,
    returnUrl.url,
  );

  return {
    ok: true,
    asset,
    sessionId: session.data.sessionId,
    provider: session.data.provider,
    widgetUrl: widgetUrl.url,
    returnUrl: returnUrl.url,
    browserType: browserResult.type,
  };
}

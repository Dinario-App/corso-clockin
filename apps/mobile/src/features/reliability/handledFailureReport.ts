import * as Sentry from '@sentry/react-native';
import { SwapApiError } from '@/src/features/swap/swapApi';
import {
  SWAP_ERROR_CODE_SET,
  type SWAP_ERROR_CODES,
  type SWAP_FAILURE_BUCKETS,
} from '@/src/features/security/mobileDiagnosticVocabulary';

export type SwapFailureCode =
  | (typeof SWAP_ERROR_CODES)[number]
  | (typeof SWAP_FAILURE_BUCKETS)[number];

export type HandledFailureTags = {
  feature: 'swap';
  stage: 'confirm';
  code: SwapFailureCode;
};

export type HandledFailureCapture = (
  error: unknown,
  context: { level: 'warning'; tags: HandledFailureTags },
) => void;

const captureThroughSentry: HandledFailureCapture = (error, context) => {
  Sentry.captureException(error, context);
};

/**
 * Stable, message-free code for a confirm-stage swap failure. Every signing
 * gate refusal (`assertSafeToSign.ts`, `assertSwapSemantics.ts`) ends in
 * "Refusing to sign".
 */
export function classifySwapFailure(error: unknown): SwapFailureCode {
  try {
    if (error instanceof SwapApiError) {
      // `code` is typed string but can be any JSON shape from a response body.
      const code: unknown = error.code;
      if (typeof code !== 'string') return 'swap_api_error';
      if (SWAP_ERROR_CODE_SET.has(code)) return code as SwapFailureCode;
      const status = httpStatusOf(code);
      if (status !== null && code === `http_${status}`) {
        if (status >= 400 && status < 500) return 'swap_http_4xx';
        if (status >= 500 && status < 600) return 'swap_http_5xx';
      }
      return 'swap_api_error';
    }
    if (error instanceof Error) {
      const message: unknown = error.message;
      return typeof message === 'string' && /Refusing to sign/.test(message)
        ? 'signing_refused'
        : 'execute_or_confirm_failed';
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

function httpStatusOf(code: string): number | null {
  if (!code.startsWith('http_')) return null;
  const status = Number(code.slice('http_'.length));
  return Number.isInteger(status) ? status : null;
}

/** Report one handled failure. Never throws; returns whether capture completed. */
export function reportHandledFailure(
  error: unknown,
  tags: HandledFailureTags,
  capture: HandledFailureCapture = captureThroughSentry,
): boolean {
  try {
    capture(error, { level: 'warning', tags: { ...tags } });
    return true;
  } catch {
    return false;
  }
}

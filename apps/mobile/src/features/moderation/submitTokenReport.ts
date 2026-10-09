/** The five closed reasons, in the order the menu renders them. */
export const REPORT_REASONS = [
  'hate',
  'sexual',
  'violence',
  'impersonation',
  'other',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export type SubmitTokenReportArgs = {
  mint: string;
  reason: ReportReason;
  /** The label as this screen rendered it. Optional; the mint is enough. */
  name?: string | null;
  symbol?: string | null;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  apiBaseUrl?: string | null;
};

export type SubmitTokenReportResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | 'missing_api_url'
        | 'network'
        | 'aborted'
        | 'http'
        | 'rate_limited'
        | 'invalid';
      httpStatus?: number;
    };

function resolveApiBaseUrl(override?: string | null): string | null {
  if (override !== undefined) {
    if (override === null) return null;
    const trimmed = override.trim();
    return trimmed.length > 0 ? trimmed.replace(/\/$/, '') : null;
  }
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  return raw ? raw.replace(/\/$/, '') : null;
}

/**
 * The body, built from a closed field list. Empty or whitespace labels are
 * dropped rather than sent as `""`, and both are trimmed to the server's caps
 * so a long name is a shorter report rather than a 400.
 */
export function buildTokenReportBody(args: {
  mint: string;
  reason: ReportReason;
  name?: string | null;
  symbol?: string | null;
}): {
  mint: string;
  reason: ReportReason;
  name?: string;
  symbol?: string;
} {
  const name =
    typeof args.name === 'string' ? args.name.trim().slice(0, 64) : '';
  const symbol =
    typeof args.symbol === 'string' ? args.symbol.trim().slice(0, 32) : '';
  return {
    mint: args.mint,
    reason: args.reason,
    ...(name.length > 0 ? { name } : {}),
    ...(symbol.length > 0 ? { symbol } : {}),
  };
}

export async function submitTokenReport(
  args: SubmitTokenReportArgs,
): Promise<SubmitTokenReportResult> {
  const base = resolveApiBaseUrl(args.apiBaseUrl);
  if (!base) return { ok: false, code: 'missing_api_url' };

  let response: Response;
  try {
    response = await (args.fetchImpl ?? globalThis.fetch)(
      `${base}/v1/moderation/report`,
      {
        method: 'POST',
        signal: args.signal,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify(buildTokenReportBody(args)),
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError')
      return { ok: false, code: 'aborted' };
    return { ok: false, code: 'network' };
  }

  if (response.status === 429)
    return { ok: false, code: 'rate_limited', httpStatus: 429 };
  if (response.status === 400 || response.status === 413)
    return { ok: false, code: 'invalid', httpStatus: response.status };
  if (!response.ok)
    return { ok: false, code: 'http', httpStatus: response.status };
  return { ok: true };
}

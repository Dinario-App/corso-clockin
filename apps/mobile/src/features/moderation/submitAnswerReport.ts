import type {
  ReportReason,
  SubmitTokenReportResult,
} from './submitTokenReport';

export type AnswerReportTarget = {
  answerId: string;
  question: string;
  answer: string;
  source: 'corso' | 'connected_ai';
};

export type SubmitAnswerReportArgs = AnswerReportTarget & {
  reason: ReportReason;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  apiBaseUrl?: string | null;
};

export type SubmitAnswerReportResult = SubmitTokenReportResult;

function resolveApiBaseUrl(override?: string | null): string | null {
  if (override !== undefined) {
    if (override === null) return null;
    const trimmed = override.trim();
    return trimmed.length > 0 ? trimmed.replace(/\/$/, '') : null;
  }
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  return raw ? raw.replace(/\/$/, '') : null;
}

/** Build from a closed field list so reporter identity cannot ride along. */
export function buildAnswerReportBody(
  args: AnswerReportTarget & { reason: ReportReason },
) {
  return {
    answerId: args.answerId.trim().slice(0, 128),
    question: args.question.trim().slice(0, 512),
    answer: args.answer.trim().slice(0, 2_000),
    source: args.source,
    reason: args.reason,
  };
}

export async function submitAnswerReport(
  args: SubmitAnswerReportArgs,
): Promise<SubmitTokenReportResult> {
  const base = resolveApiBaseUrl(args.apiBaseUrl);
  if (!base) return { ok: false, code: 'missing_api_url' };

  let response: Response;
  try {
    response = await (args.fetchImpl ?? globalThis.fetch)(
      `${base}/v1/moderation/report-answer`,
      {
        method: 'POST',
        signal: args.signal,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify(buildAnswerReportBody(args)),
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

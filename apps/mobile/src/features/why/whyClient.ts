import { parseWhyResponse, type WhyResponse } from '@corso/why';

/** The surfaces the engine serves today (`plan` is contract-only). */
export type WhyClientSurface = 'review' | 'moving' | 'strip';

export const WHY_CLIENT_MAX_MINTS: Record<WhyClientSurface, number> = {
  review: 1,
  strip: 5,
  moving: 10,
};

export type FetchWhyArgs = {
  /** The client gate: `readLaunchDockBuildFlag()`. False → no request. */
  enabled: boolean;
  surface: WhyClientSurface;
  mints: readonly string[];
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  apiBaseUrl?: string | null;
};

function resolveApiBaseUrl(override?: string | null): string | null {
  if (override !== undefined) {
    if (override === null) return null;
    const trimmed = override.trim();
    return trimmed.length > 0 ? trimmed.replace(/\/$/, '') : null;
  }
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, '');
}

export async function fetchWhy(
  args: FetchWhyArgs,
): Promise<WhyResponse | null> {
  if (!args.enabled) return null;
  const mints = [...new Set(args.mints)];
  if (mints.length === 0 || mints.length > WHY_CLIENT_MAX_MINTS[args.surface])
    return null;

  const base = resolveApiBaseUrl(args.apiBaseUrl);
  if (!base) return null;

  const query = `surface=${encodeURIComponent(args.surface)}&mints=${mints
    .map(encodeURIComponent)
    .join(',')}`;
  const fetchImpl = args.fetchImpl ?? globalThis.fetch;
  let response: Response;
  try {
    response = await fetchImpl(`${base}/v1/why?${query}`, {
      method: 'GET',
      signal: args.signal,
      // Native-only contract: never attach Origin.
      headers: { accept: 'application/json' },
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    return null;
  }
  const parsed = parseWhyResponse(raw);
  // A response for another surface is not an answer to this request.
  return parsed && parsed.surface === args.surface ? parsed : null;
}

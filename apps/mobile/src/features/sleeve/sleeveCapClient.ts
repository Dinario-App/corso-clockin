/**
 * GET/PUT /v1/swap/sleeve-cap. Same bearer header as swap orders.
 * Unknown, error and timeout stay unknown. This client never sells.
 */
import {
  swapApiBaseUrl,
  swapBearerAuthorization,
} from '@/src/features/swap/swapApi';
import {
  isSleeveCapStep,
  type SleeveCapRead,
  type SleeveCapStep,
} from '@/src/features/sleeve/sleeveCap';

const CAP_ROUTE = '/v1/swap/sleeve-cap';

export type SleeveCapWriteResult = SleeveCapRead | { kind: 'rejected' };

export async function readSleeveCap(args: {
  getAccessToken?: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
} = {}): Promise<SleeveCapRead> {
  return requestCap('GET', undefined, args);
}

export async function writeSleeveCap(args: {
  capPercent: unknown;
  getAccessToken?: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<SleeveCapWriteResult> {
  if (!isSleeveCapStep(args.capPercent)) return { kind: 'rejected' };
  const read = await requestCap('PUT', args.capPercent, args);
  if (read.kind !== 'known' || read.capPercent !== args.capPercent) {
    return { kind: 'unknown' };
  }
  return read;
}

async function requestCap(
  method: 'GET' | 'PUT',
  capPercent: SleeveCapStep | undefined,
  args: {
    getAccessToken?: () => Promise<string | null>;
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
    timeoutMs?: number;
  },
): Promise<SleeveCapRead> {
  const base = swapApiBaseUrl();
  if (!base) return { kind: 'unknown' };
  const fetchImpl = args.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    args.timeoutMs ?? 8000,
  );
  const onParent = () => controller.abort();
  args.signal?.addEventListener('abort', onParent);
  if (args.signal?.aborted) controller.abort();
  try {
    const authorization = await swapBearerAuthorization(args.getAccessToken);
    const response = await fetchImpl(base + CAP_ROUTE, {
      method,
      headers: {
        Accept: 'application/json',
        ...(method === 'PUT' ? { 'Content-Type': 'application/json' } : {}),
        ...(authorization ? { Authorization: authorization } : {}),
      },
      ...(method === 'PUT'
        ? { body: JSON.stringify({ capPercent }) }
        : {}),
      signal: controller.signal,
    });
    if (!response.ok) return { kind: 'unknown' };
    return parseKnown(await response.json());
  } catch {
    return { kind: 'unknown' };
  } finally {
    clearTimeout(timer);
    args.signal?.removeEventListener('abort', onParent);
  }
}

function parseKnown(body: unknown): SleeveCapRead {
  if (!body || typeof body !== 'object') return { kind: 'unknown' };
  const capPercent = (body as { capPercent?: unknown }).capPercent;
  return isSleeveCapStep(capPercent)
    ? { kind: 'known', capPercent }
    : { kind: 'unknown' };
}

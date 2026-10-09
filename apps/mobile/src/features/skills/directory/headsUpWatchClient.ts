import { isValidPriceMint } from '@/src/features/balances/priceSnapshot';

import {
  HEADS_UP_TIMEFRAMES,
  type HeadsUpTimeframe,
} from './headsUpWatchTypes';
import {
  headsUpProofHeaders,
  type HeadsUpAccessArgs,
} from './headsUpAccessClient';
export {
  HEADS_UP_TIMEFRAMES,
  type HeadsUpTimeframe,
} from './headsUpWatchTypes';

export type AddHeadsUpWatchOutcome =
  | { ok: true; watchId: string }
  | {
      ok: false;
      code:
        | 'disabled'
        | 'invalid_request'
        | 'missing_api_url'
        | 'network'
        | 'aborted'
        | 'exists'
        | 'limit'
        | 'http'
        | 'schema';
    };

type AddHeadsUpWatchArgs = HeadsUpAccessArgs & {
  skillsEnabled: boolean;
  mint: string;
  timeframe: HeadsUpTimeframe;
};

function apiBaseUrl(override?: string | null): string | null {
  const raw =
    override === undefined ? process.env.EXPO_PUBLIC_API_URL : override;
  const trimmed = raw?.trim();
  return trimmed ? trimmed.replace(/\/$/, '') : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export async function addHeadsUpWatch(
  args: AddHeadsUpWatchArgs,
): Promise<AddHeadsUpWatchOutcome> {
  if (!args.skillsEnabled) return { ok: false, code: 'disabled' };
  if (
    !isValidPriceMint(args.walletAddress, 'mainnet-beta') ||
    !isValidPriceMint(args.mint, 'mainnet-beta') ||
    !HEADS_UP_TIMEFRAMES.includes(args.timeframe)
  ) {
    return { ok: false, code: 'invalid_request' };
  }
  const base = apiBaseUrl(args.apiBaseUrl);
  if (!base) return { ok: false, code: 'missing_api_url' };
  const assertCurrent = () => {
    if (args.signal?.aborted) throw new Error('Heads-Up request canceled.');
    args.assertCurrent();
  };
  let response: Response;
  try {
    const headers = await headsUpProofHeaders(args, {
      walletAddress: args.walletAddress,
      action: 'create',
      mint: args.mint,
      timeframe: args.timeframe,
    });
    assertCurrent();
    response = await (args.fetchImpl ?? globalThis.fetch)(
      `${base}/v1/skills/heads-up/watches`,
      {
        method: 'POST',
        signal: args.signal,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          walletAddress: args.walletAddress,
          mint: args.mint,
          timeframe: args.timeframe,
        }),
      },
    );
    assertCurrent();
  } catch (error) {
    if (args.signal?.aborted) return { ok: false, code: 'aborted' };
    if (error instanceof Error && error.name === 'AbortError')
      return { ok: false, code: 'aborted' };
    return { ok: false, code: 'network' };
  }
  if (response.status === 503) return { ok: false, code: 'disabled' };
  if (response.status === 409) {
    try {
      const body: unknown = await response.json();
      assertCurrent();
      return {
        ok: false,
        code:
          isRecord(body) && body.error === 'watch_exists' ? 'exists' : 'limit',
      };
    } catch {
      return { ok: false, code: 'schema' };
    }
  }
  if (!response.ok) return { ok: false, code: 'http' };
  let body: unknown;
  try {
    body = await response.json();
    assertCurrent();
  } catch {
    return { ok: false, code: 'schema' };
  }
  if (!isRecord(body) || body.ok !== true || !isRecord(body.watch))
    return { ok: false, code: 'schema' };
  const watch = body.watch;
  if (
    typeof watch.id !== 'string' ||
    watch.id.length === 0 ||
    watch.walletAddress !== args.walletAddress ||
    watch.mint !== args.mint ||
    watch.timeframe !== args.timeframe ||
    watch.lastSide !== null ||
    watch.lastBand !== null ||
    watch.lastAsOfMs !== null
  ) {
    return { ok: false, code: 'schema' };
  }
  return { ok: true, watchId: watch.id };
}

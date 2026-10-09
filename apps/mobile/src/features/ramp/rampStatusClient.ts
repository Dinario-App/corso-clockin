import type { SessionType } from '@/src/features/session/types';
import { holdingsUrl } from '@/src/features/balances/fetchHoldingsViaApi';

export type RampStatusItem = {
  id: string;
  asset: 'SOL' | 'USDC';
  status: 'pending' | 'completed' | 'failed';
};
export type RampStatusResult =
  | { ok: true; items: RampStatusItem[] }
  | { ok: false; reason?: 'reprove' | 'unavailable' };

/** Status data only: no redirects, checkout state, signatures or persisted token. */
export async function fetchRampStatus(args: {
  session: { type: SessionType; address: string } | null;
  cluster: 'devnet' | 'mainnet-beta';
  getAccessToken: () => Promise<string | null>;
  importedAccess?: {
    bearer: string;
    environment: 'sandbox' | 'production';
  } | null;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  apiBaseUrl?: string;
}): Promise<RampStatusResult> {
  const imported =
    args.session?.type === 'imported_seed' && args.importedAccess;
  if (args.session?.type !== 'privy_embedded' && !imported)
    return { ok: false };
  const safeBase = holdingsUrl(
    args.apiBaseUrl ?? process.env.EXPO_PUBLIC_API_URL,
  );
  if (!safeBase) return { ok: false };
  try {
    const token = imported ? imported.bearer : await args.getAccessToken();
    if (!token || args.signal?.aborted) return { ok: false };
    const response = await (args.fetchImpl ?? fetch)(
      new URL(
        imported ? '/v1/ramps/status/imported' : '/v1/ramps/status',
        safeBase,
      ).toString(),
      {
        method: 'GET',
        headers: {
          Authorization: `${imported ? 'RampStatus' : 'Bearer'} ${token}`,
        },
        signal: args.signal,
        redirect: 'error',
      },
    );
    if (!response.ok)
      return imported
        ? {
            ok: false,
            reason: response.status === 401 ? 'reprove' : 'unavailable',
          }
        : { ok: false };
    const body = await response.json();
    if (
      body?.owner !== args.session?.address ||
      body.cluster !== args.cluster ||
      !Array.isArray(body.items) ||
      body.items.length > 100
    )
      return { ok: false };
    const ids = new Set<string>();
    for (const item of body.items) {
      if (
        !item ||
        typeof item.id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          item.id,
        ) ||
        ids.has(item.id) ||
        (item.asset !== 'SOL' && item.asset !== 'USDC') ||
        !['pending', 'completed', 'failed'].includes(item.status)
      )
        return { ok: false };
      ids.add(item.id);
    }
    return {
      ok: true,
      items: body.items.map((item: RampStatusItem) => ({
        id: item.id,
        asset: item.asset,
        status: item.status,
      })),
    };
  } catch {
    return imported ? { ok: false, reason: 'unavailable' } : { ok: false };
  }
}

export function presentRampPending(
  items: readonly RampStatusItem[],
): RampStatusItem[] {
  return items.filter((item) => item.status === 'pending');
}

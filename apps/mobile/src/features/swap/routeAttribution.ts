import { copy } from '@/constants/copy';

/** Which Jupiter API produced this quote. Not a preference; an observation. */
export type SwapRouteApi = 'aggregator' | 'metis';

export type SwapRouteAttribution = {
  readonly api: SwapRouteApi;
  /** Cl. 2.3 label. Always rendered. Never carries the cl. 8.4 mark. */
  readonly routeLine: string;
  readonly poweredByLine: string;
};

/**
 * Metis quotes echo Jupiter's pinned `instructionVersion`. The Meta path has
 * no such field and the API sends explicit `null`.
 */
export function swapRouteApiFromInstructionVersion(
  instructionVersion: string | null,
): SwapRouteApi {
  return instructionVersion === 'V1' ? 'metis' : 'aggregator';
}

export function resolveSwapRouteAttribution(input: {
  readonly instructionVersion: string | null;
}): SwapRouteAttribution {
  const api = swapRouteApiFromInstructionVersion(input.instructionVersion);
  return {
    api,
    routeLine:
      api === 'metis'
        ? copy.swap.routeProviderAttribution
        : copy.swap.routeProviderAttributionAggregator,
    // Cl. 8.4, both branches, unconditionally. See the type doc.
    poweredByLine: copy.swap.routeProviderPoweredBy,
  };
}

export function resolveSwapRouteDisplayName(router: string | null): string {
  if (router === null) return copy.swap.routeUnknown;
  const names: Record<string, string> = copy.swap.routeNames;
  const key = router.toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(names, key)) {
    return copy.swap.routeUnknown;
  }
  return names[key];
}

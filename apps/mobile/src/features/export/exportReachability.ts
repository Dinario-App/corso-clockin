export type ReachabilityResult =
  | { reachable: true }
  | { reachable: false; reason: 'network' | 'http_error' | 'timeout' };

/** Classify a probe outcome. Pure — the caller owns the actual fetch. */
export function classifyReachability(input: {
  ok?: boolean;
  status?: number;
  threw?: boolean;
  timedOut?: boolean;
}): ReachabilityResult {
  if (input.timedOut) return { reachable: false, reason: 'timeout' };
  if (input.threw) return { reachable: false, reason: 'network' };
  if (input.ok === true && typeof input.status === 'number' && input.status < 400) {
    return { reachable: true };
  }
  return { reachable: false, reason: 'http_error' };
}

export const EXPORT_PROBE_TIMEOUT_MS = 8_000;

export async function probeExportOrigin(
  url: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = EXPORT_PROBE_TIMEOUT_MS,
): Promise<ReachabilityResult> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: 'HEAD',
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'manual',
      signal: controller.signal,
    });
    return classifyReachability({
      ok: response.ok,
      status: response.status,
    });
  } catch {
    return classifyReachability({ threw: true, timedOut });
  } finally {
    clearTimeout(timer);
  }
}

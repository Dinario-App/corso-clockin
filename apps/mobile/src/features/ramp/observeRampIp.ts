/** Optional observation has one 2s budget, including nonce issuance and bodies. */
export async function observeRampIp(
  apiBase: string,
  authorization: {
    walletAddress: string;
    asset: string;
    nonce: string;
    signature: string;
  },
): Promise<string | undefined> {
  const raw = process.env.EXPO_PUBLIC_IP_OBSERVER_URL?.trim();
  if (!raw) return undefined;
  let observer: URL;
  try {
    observer = new URL(raw);
    if (
      observer.protocol !== 'https:' ||
      observer.username ||
      observer.password ||
      observer.pathname !== '/' ||
      observer.search ||
      observer.hash ||
      raw.includes('\\')
    )
      return undefined;
  } catch {
    return undefined;
  }
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(`${apiBase}/v1/ramps/ip-nonce`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            walletAddress: authorization.walletAddress,
            asset: authorization.asset,
            nonce: authorization.nonce,
            signature: authorization.signature,
          }),
          signal: controller.signal,
          redirect: 'error',
        });
        if (!response.ok) return undefined;
        const issued = (await response.json()) as { nonce?: unknown };
        if (
          controller.signal.aborted ||
          typeof issued?.nonce !== 'string' ||
          !/^[A-Za-z0-9_-]{43}$/.test(issued.nonce)
        )
          return undefined;
        observer.pathname = '/v1/observe';
        observer.searchParams.set('n', issued.nonce);
        const observed = await fetch(observer.href, {
          signal: controller.signal,
          redirect: 'error',
          cache: 'no-store',
        });
        if (!observed.ok) return undefined;
        const body = (await observed.json()) as { token?: unknown };
        return !controller.signal.aborted &&
          typeof body?.token === 'string' &&
          body.token.length > 0 &&
          body.token.length <= 2048
          ? body.token
          : undefined;
      })(),
      new Promise<undefined>((resolve) => {
        timer = setTimeout(() => {
          controller.abort();
          resolve(undefined);
        }, 2000);
      }),
    ]);
  } catch {
    // No token, nonce, IP, signature, URL or network error goes to telemetry.
    return undefined;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

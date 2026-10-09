/** Chrome is required for MoonPay Google Pay; otherwise respect the OS default. */
export function chooseMoonPayBrowser(
  packages: readonly string[],
): string | undefined {
  return packages.includes('com.android.chrome')
    ? 'com.android.chrome'
    : undefined;
}

/** No script bridge: intercept the HTTPS return at the native navigation boundary. */
export function moonPayNavigation(
  raw: string,
  returnUrl: string,
): 'return' | 'allow' | 'external' | 'block' {
  try {
    const url = new URL(raw);
    const callback = new URL(returnUrl);
    if (url.protocol !== 'https:' || url.username || url.password)
      return 'block';
    if (
      url.origin === callback.origin &&
      url.pathname === callback.pathname &&
      [...callback.searchParams].every(
        ([key, value]) =>
          url.searchParams.getAll(key).length === 1 &&
          url.searchParams.get(key) === value,
      )
    )
      return 'return';
    return [
      'https://buy.moonpay.com',
      'https://buy-sandbox.moonpay.com',
    ].includes(url.origin)
      ? 'allow'
      : 'external';
  } catch {
    return 'block';
  }
}

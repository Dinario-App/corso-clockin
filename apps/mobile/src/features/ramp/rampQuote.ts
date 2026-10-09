import { useEffect, useState } from 'react';

export type RampQuote = {
  baseCurrencyAmount: number;
  totalAmount: number;
  feeAmount: number;
  networkFeeAmount: number;
  quoteCurrencyAmount: number;
  extraFeeAmount: number;
  expiresAt: string;
  minBuyAmount?: number | null;
  maxBuyAmount?: number | null;
};
export type LoadRampQuote = (
  amount: number,
  signal: AbortSignal,
) => Promise<unknown>;
const number = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** Unknown validity or an unrepresented extra fee cannot price these four rows. */
export function parseRampQuote(
  value: unknown,
  now = Date.now(),
): RampQuote | null {
  if (!value || typeof value !== 'object') return null;
  const q = value as Record<string, unknown>;
  if (
    !number(q.baseCurrencyAmount) ||
    !number(q.totalAmount) ||
    !number(q.feeAmount) ||
    !number(q.networkFeeAmount) ||
    !number(q.quoteCurrencyAmount) ||
    q.extraFeeAmount !== 0 ||
    typeof q.expiresAt !== 'string' ||
    !Number.isFinite(Date.parse(q.expiresAt)) ||
    Date.parse(q.expiresAt) <= now ||
    (q.expiresIn != null && (!number(q.expiresIn) || q.expiresIn <= 0)) ||
    (q.minBuyAmount != null && !number(q.minBuyAmount)) ||
    (q.maxBuyAmount != null && !number(q.maxBuyAmount))
  )
    return null;
  return q as unknown as RampQuote;
}

export async function fetchRampQuote(
  baseUrl: string | undefined,
  amount: number,
  signal: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  if (!baseUrl) return null;
  const response = await fetchImpl(
    `${baseUrl}/v1/ramp/quote?asset=USDC&amount=${encodeURIComponent(String(amount))}`,
    {
      method: 'GET',
      signal,
      cache: 'no-store',
    },
  );
  if (!response.ok) return null;
  return response.json();
}

export const loadRampQuote: LoadRampQuote = (amount, signal) =>
  fetchRampQuote(
    process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, ''),
    amount,
    signal,
  );

type State = {
  amount: number;
  value: RampQuote | null;
  loading: boolean;
} | null;
/** Memory-only; every request/amount change, blur, error and expiry discards the quote. */
export function useRampQuote(
  amount: number | null,
  enabled: boolean,
  load?: LoadRampQuote,
) {
  const [state, setState] = useState<State>(null);
  useEffect(() => {
    setState(null);
    if (!enabled || amount === null || !load) return;
    let current = true;
    const controller = new AbortController();
    let expiry: ReturnType<typeof setTimeout> | undefined;
    setState({ amount, value: null, loading: true });
    const timeout = setTimeout(() => {
      controller.abort();
      if (current) setState(null);
    }, 5_000);
    void load(amount, controller.signal)
      .then((value) => {
        if (!current || controller.signal.aborted) return;
        clearTimeout(timeout);
        const quote = parseRampQuote(value);
        setState({ amount, value: quote, loading: false });
        if (quote) {
          // Re-check wall-clock expiry at every render as well. Timer delays are
          // bounded to avoid JS's signed-32-bit timeout overflow.
          const expire = () => {
            if (!current) return;
            const remaining = Date.parse(quote.expiresAt) - Date.now();
            if (remaining <= 0) setState(null);
            else
              expiry = setTimeout(expire, Math.min(remaining, 2_147_483_647));
          };
          expire();
        }
      })
      .catch(() => {
        if (current) setState(null);
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      current = false;
      controller.abort();
      clearTimeout(timeout);
      if (expiry !== undefined) clearTimeout(expiry);
    };
  }, [amount, enabled, load]);
  const value =
    enabled && state?.amount === amount ? parseRampQuote(state.value) : null;
  const inRange =
    value === null ||
    amount === null ||
    ((value.minBuyAmount == null || amount >= value.minBuyAmount) &&
      (value.maxBuyAmount == null || amount <= value.maxBuyAmount));
  return {
    // A minimum-adjusted quote is not a quote for the selected amount.
    quote: value?.baseCurrencyAmount === amount && inRange ? value : null,
    limits: value?.baseCurrencyAmount === amount || !inRange ? value : null,
    inRange,
    loading: enabled && state?.amount === amount && state.loading,
  };
}

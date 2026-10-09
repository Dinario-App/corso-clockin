export type QuoteAgeAtSigningEvent = {
  name: 'swap_quote_age_at_signing';
  properties: { age_ms: number };
};

/**
 * Coarse timing only: no mints, request id, wallet, or amount enter this event.
 */
export function quoteAgeAtSigningEvent(args: {
  quoteAppliedAtMs: number;
  nowMs: number;
}): QuoteAgeAtSigningEvent {
  return {
    name: 'swap_quote_age_at_signing',
    properties: {
      age_ms: Math.max(0, Math.floor(args.nowMs - args.quoteAppliedAtMs)),
    },
  };
}

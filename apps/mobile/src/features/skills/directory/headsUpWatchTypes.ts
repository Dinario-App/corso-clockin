export const HEADS_UP_TIMEFRAMES = ['1m', '5m', '1H', '4H', '1D'] as const;
export type HeadsUpTimeframe = (typeof HEADS_UP_TIMEFRAMES)[number];

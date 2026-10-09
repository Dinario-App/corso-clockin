/** Params arrive as strict decimal strings; these format them for reading. */
export type WhyFormat = {
  /** `+2.10` → `2.1%` (unsigned; the template says up or down). */
  pct: (value: string) => string;
  /** `+2.10` → `+2.1%` (signed, for offsets with no direction word). */
  signedPct: (value: string) => string;
  /** `18.20` → `18.2%`. */
  share: (value: string) => string;
  /** `1500.00` → `$1,500`. */
  money: (value: string) => string;
  /** `1.40` → `1.4`. */
  ratio: (value: string) => string;
};

export const WHY_TEMPLATE_VERSION = 1;

export const whyCopyV1 = {
  title: "What we're seeing",
  lines: {
    price_up_today: (p: { changePct: string }, f: WhyFormat) =>
      `Up ${f.pct(p.changePct)} today`,
    price_down_today: (p: { changePct: string }, f: WhyFormat) =>
      `Down ${f.pct(p.changePct)} today`,
    price_steady_today: (p: { changePct: string }, f: WhyFormat) =>
      `Little change today (${f.signedPct(p.changePct)})`,
    price_up_week: (p: { changePct: string }, f: WhyFormat) =>
      `Up ${f.pct(p.changePct)} this week`,
    price_down_week: (p: { changePct: string }, f: WhyFormat) =>
      `Down ${f.pct(p.changePct)} this week`,
    price_near_month_high: (p: { belowHighPct: string }, f: WhyFormat) =>
      `Within ${f.share(p.belowHighPct)} of its high for the month`,
    price_near_month_low: (p: { aboveLowPct: string }, f: WhyFormat) =>
      `Within ${f.share(p.aboveLowPct)} of its low for the month`,
    price_near_month_average: (p: { offsetPct: string }, f: WhyFormat) =>
      `Near its average for the month (${f.signedPct(p.offsetPct)})`,
    order_flow_skew: (
      p: { direction: 'up' | 'down'; ratio: string },
      f: WhyFormat,
    ) =>
      p.direction === 'up'
        ? `More volume as the price rose, ${f.ratio(p.ratio)} to 1`
        : `More volume as the price fell, ${f.ratio(p.ratio)} to 1`,
    order_flow_balanced: (_p: { ratio: string }, _f: WhyFormat) =>
      'Volume was about even as the price rose and fell',
    volume_today: (p: { volumeUsd: string }, f: WhyFormat) =>
      `${f.money(p.volumeUsd)} changed hands today`,
    holders_concentrated: (p: { top10Pct: string }, f: WhyFormat) =>
      `The top 10 holders hold ${f.share(p.top10Pct)} of it`,
    holders_spread: (p: { top10Pct: string }, f: WhyFormat) =>
      `Spread widely: the top 10 holders hold ${f.share(p.top10Pct)}`,
    liquidity_thin: (p: { liquidityUsd: string }, f: WhyFormat) =>
      `Thin market: about ${f.money(p.liquidityUsd)} of depth`,
    liquidity_deep: (p: { liquidityUsd: string }, f: WhyFormat) =>
      `Deep market: about ${f.money(p.liquidityUsd)} of depth`,
    chart_trend_up: (p: { timeframe: WhyTimeframe }, _f: WhyFormat) =>
      `Chart rising over the ${TIMEFRAME[p.timeframe]}`,
    chart_trend_down: (p: { timeframe: WhyTimeframe }, _f: WhyFormat) =>
      `Chart falling over the ${TIMEFRAME[p.timeframe]}`,
    chart_trend_mixed: (p: { timeframe: WhyTimeframe }, _f: WhyFormat) =>
      `No clear trend over the ${TIMEFRAME[p.timeframe]}`,
    market_mood: (p: { mood: WhyMood; index: number }, _f: WhyFormat) =>
      `Crypto mood: ${MOOD[p.mood]} (${p.index} of 100)`,
    safety_checks_flagged: (p: { flagCount: number }, _f: WhyFormat) =>
      p.flagCount === 1
        ? '1 token check raised a flag'
        : `${p.flagCount} token checks raised a flag`,
    filing_recent: (
      p: { form: WhyFilingForm; daysAgo: number },
      _f: WhyFormat,
    ) =>
      `${FILING[p.form]} ${p.daysAgo === 0 ? 'today' : p.daysAgo === 1 ? '1 day ago' : `${p.daysAgo} days ago`}`,
    plan_legs_mixed_today: (
      p: { upCount: number; downCount: number },
      _f: WhyFormat,
    ) => `${p.upCount} up and ${p.downCount} down today`,
    plan_all_near_month_average: (p: { maxOffsetPct: string }, f: WhyFormat) =>
      `Every asset within ${f.share(p.maxOffsetPct)} of its monthly average`,
  },
  /** The small grey basis label: `Order flow · 1 day`. */
  basis: {
    price: 'Price',
    order_flow: 'Order flow',
    trading_volume: 'Volume',
    holders: 'Holders',
    liquidity: 'Market depth',
    chart: 'Chart',
    market_mood: 'Market mood',
    safety_checks: 'Token checks',
    filings: 'Filings',
    plan: 'Plan',
  },
  window: { 24: '1 day', 168: '7 days', 720: '30 days' },
  asOf: (clock: string) => `As of ${clock}`,
  review: {
    unavailable:
      "Couldn't load what we're seeing just now. The price and costs below are live.",
  },
  strip: {
    unavailable: "Couldn't load what we're seeing just now.",
  },
  details: {
    heading: 'What you saw',
    frozenNote: "Saved as you saw it. It won't change later.",
    capturedAt: (clock: string) => `At Review · ${clock}`,
    quoteHeading: 'Quote you saw',
    youPay: 'You pay',
    youGetAbout: 'You get about',
    youGetAtLeast: 'You get at least',
    fee: 'Corso fee',
    priceCanMove: 'Price can move',
    priceCanMoveValue: (percent: string) => `up to ${percent}`,
    priceCanMoveAuto: 'set automatically',
    whyUnavailable: "What we're seeing wasn't available at Review.",
    savedWithOtherVersion: 'This record was saved in a newer version of Corso.',
  },
} as const;

export type WhyTimeframe = 'hour' | 'four_hours' | 'day';
export type WhyMood =
  | 'extreme_fear'
  | 'fear'
  | 'neutral'
  | 'greed'
  | 'extreme_greed';
export type WhyFilingForm = 'insider_filing' | 'fund_holdings_filing';

const TIMEFRAME: Record<WhyTimeframe, string> = {
  hour: 'last hour',
  four_hours: 'last 4 hours',
  day: 'last day',
};
const MOOD: Record<WhyMood, string> = {
  extreme_fear: 'extreme fear',
  fear: 'fear',
  neutral: 'neutral',
  greed: 'greed',
  extreme_greed: 'extreme greed',
};
const FILING: Record<WhyFilingForm, string> = {
  insider_filing: 'An insider filing',
  fund_holdings_filing: 'A fund holdings filing',
};

/** Every template set by version. A snapshot renders with its own. */
export const WHY_COPY_BY_VERSION = { 1: whyCopyV1 } as const;

export const VITALS_SCHEMA_VERSION = 1 as const;

export const VITALS_TIMEFRAMES = ['1m', '5m', '1h', '4h', '1d', '1w'] as const;
export type TimeframeId = (typeof VITALS_TIMEFRAMES)[number];

export const VITAL_KEYS = [
  'price',
  'liquidity',
  'volume',
  'holders',
  'safety',
  'age',
] as const;
export type VitalKey = (typeof VITAL_KEYS)[number];

export const VITALS_SECTIONS = [
  'price',
  'market',
  'holders',
  'safety',
  'chart',
] as const;
export type VitalsSection = (typeof VITALS_SECTIONS)[number];

/** `onchain_intel` = the server's computed sniper / bundler / insider-cluster layer. */
export type SafetySource =
  | 'rugcheck'
  | 'birdeye_security'
  | 'onchain_rpc'
  | 'onchain_intel';
export type SafetySourceV2 = SafetySource | 'solana_tracker' | 'unrecognised';
export type SafetyFlagSourceLabel =
  | SafetySource
  | `${SafetySource}+${SafetySource}`;
export type SafetyFlagSourceLabelV2 =
  | SafetySourceV2
  | `${SafetySourceV2}+${SafetySourceV2}`;

export type SafetyFlagKey =
  | 'mint_authority'
  | 'freeze_authority'
  | 'lp_lock'
  | 'top10_concentration'
  | 'transfer_fee'
  | 'mutable_metadata'
  | 'rugged'
  | 'insider_network'
  | 'low_liquidity'
  // Mint-intelligence receipts. Any of them can honestly read 'insufficient data'.
  | 'sniper_share'
  | 'bundler_share'
  | 'insider_cluster';

export type SafetyFlagKeyV2 =
  | SafetyFlagKey
  | 'permanent_delegate'
  | 'transfer_hook'
  | 'default_frozen'
  | 'dev_share'
  | 'rug_check_unavailable'
  | 'non_transferable'
  | 'pausable'
  | 'paused'
  | 'unrecognised';

export type SafetyFlagLevel = 'danger' | 'warn' | 'info' | 'ok';

export type SafetyFlag = {
  key: SafetyFlagKey;
  level: SafetyFlagLevel;
  label: string;
  value?: string;
  source: SafetyFlagSourceLabel;
};

export type SafetyFlagV2 = Omit<SafetyFlag, 'key' | 'source'> & {
  key: SafetyFlagKeyV2;
  source: SafetyFlagSourceLabelV2;
};

export type SafetyVerdictLevel = 'green' | 'amber' | 'red' | 'unknown';

export type SafetyCheckStatus = 'ok' | 'failed' | 'not_wired';

export type SafetyCheckRead = {
  status: SafetyCheckStatus;
  asOf: string | null;
};

export type SafetyCatalogFact = {
  key:
    | 'mint_authority'
    | 'freeze_authority'
    | 'permanent_delegate'
    | 'default_frozen'
    | 'transfer_hook'
    | 'transfer_fee'
    | 'non_transferable'
    | 'pausable'
    | 'paused'
    | 'rugged'
    | 'top10_concentration'
    | 'dev_share'
    | 'sniper_share'
    | 'insider_cluster'
    | 'bundler_share'
    | 'lp_lock'
    | 'low_liquidity';
  level: SafetyFlagLevel;
  value: string | null;
  source:
    | 'onchain_rpc'
    | 'solana_tracker'
    | 'birdeye_security'
    | 'onchain_intel';
};

export type SafetyCatalogV1 = {
  v: 1;
  lifecycle: 'curve' | 'graduated' | null;
  /** Per-check receipts; coverage uses these statuses, never fact values. */
  checkResults?: {
    top10_holders: 'answered' | 'incomplete' | 'not_applicable' | 'not_read';
  };
  /** Required observations a source read did not actually return. */
  requiredObservationsMissing?: Array<'top1_holder' | 'liquidity'>;
  checkedExtensions: Array<
    | 'permanent_delegate'
    | 'default_frozen'
    | 'transfer_hook'
    | 'transfer_fee'
    | 'non_transferable'
    | 'pausable'
  >;
  facts: SafetyCatalogFact[];
};

export type SafetyVerdictV2 = {
  verdict: SafetyVerdictLevel;
  flags: SafetyFlagV2[];
  sources: SafetySourceV2[];
  checks: {
    core: SafetyCheckRead;
    enrichment: SafetyCheckRead;
  };
  trusted: boolean;
  catalog?: SafetyCatalogV1;
};

export type SafetyVerdictV3 = {
  /** Additive flags omitted from frozen v2 so build-56 keeps mounting. */
  flagAdditions: SafetyFlagV2[];
};

export type SafetyVerdict = {
  verdict: SafetyVerdictLevel;
  scoreNormalised: number | null;
  flags: SafetyFlagV2[];
  reconciled: boolean;
  sources: SafetySourceV2[];
  asOf: string;
  /** Build-56 truth contract. Legacy fields remain for build-54/55 readers. */
  v2?: SafetyVerdictV2;
  /** Additive current flags; v2 remains the frozen build-56 projection. */
  v3?: SafetyVerdictV3;
};

export type Candle = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

export type HolderTag = 'bundler' | 'sniper' | 'insider' | 'dev';

export type VitalsPrice = {
  usd: number;
  changePctFrame: number | null;
  changePct24h: number | null;
  marketCapUsd: number | null;
  fdvUsd: number | null;
  asOf: string;
  source: 'jupiter';
};

export type VitalsMarket = {
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  buySellRatio24h: number | null;
  marketCapUsd?: number | null;
  fdvUsd?: number | null;
  source: 'birdeye' | 'geckoterminal';
  asOf: string;
  cached?: true;
};

export type VitalsHolders = {
  count: number | null;
  top10Pct: number | null;
  top1Pct: number | null;
  behaviorTags?: HolderTag[];
  source: 'birdeye';
  asOf: string;
  cached?: true;
};

export type VitalsChart = {
  kind: 'candlestick';
  mint: string;
  timeframe: TimeframeId;
  seedCandles?: Candle[];
  source: 'birdeye' | 'geckoterminal';
};

export type VitalsTradeLeadIn = {
  swap: {
    fromSymbol: string;
    toSymbol: string;
    toMint: string;
    toDecimals: number;
    inAmountAtomic: string;
    amountGuard?: 'sol-reserve';
  };
};

export type VitalsDisclosures = {
  isInformationNotAdvice: true;
  sourcesLabel: string;
  lossNudge: string;
};

export type VitalsPayload = {
  render: 'token_vitals';
  schemaVersion: typeof VITALS_SCHEMA_VERSION;
  token: {
    mint: string;
    symbol: string;
    name: string;
    iconUrl?: string;
    isVerified: boolean;
    ageMinutes: number | null;
  };
  timeframe: TimeframeId;
  allowedTimeframes: TimeframeId[];
  emphasize?: VitalKey[];
  price: VitalsPrice | null;
  market: VitalsMarket | null;
  holders: VitalsHolders | null;
  safety: SafetyVerdict;
  chart: VitalsChart;
  tradeLeadIn?: VitalsTradeLeadIn;
  disclosures: VitalsDisclosures;
};

export type VitalsDisambiguationChoice = {
  mint: string;
  symbol: string;
  name: string | null;
  isVerified: boolean | null;
  liquidityUsd: number | null;
};

export type VitalsDisambiguation = {
  render: 'token_vitals_disambiguate';
  schemaVersion: typeof VITALS_SCHEMA_VERSION;
  query: string;
  choices: VitalsDisambiguationChoice[];
};

export type VitalsAnswer = VitalsPayload | VitalsDisambiguation;

export function isTimeframeId(value: unknown): value is TimeframeId {
  return (
    typeof value === 'string' &&
    (VITALS_TIMEFRAMES as readonly string[]).includes(value)
  );
}

export const BACKPACK_SECURITIES_HARD_DENY_COUNTRIES = [
  'US',
  'GB',
  'AE',
  'JP',
] as const;

/**
 * EEA contracting parties: the EU 27 plus Iceland, Liechtenstein, and
 * Norway. Switzerland is not a party. Membership is the list itself.
 */
export const BACKPACK_EEA_COUNTRIES: readonly string[] = [
  'AT',
  'BE',
  'BG',
  'CY',
  'CZ',
  'DE',
  'DK',
  'EE',
  'ES',
  'FI',
  'FR',
  'GR',
  'HR',
  'HU',
  'IE',
  'IS',
  'IT',
  'LI',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'NO',
  'PL',
  'PT',
  'RO',
  'SE',
  'SI',
  'SK',
];

/** Seeker preview application id. Any other id leaves simulation off. */
export const PREVIEW_PACKAGE_ID = 'com.dinario.app.preview';

/**
 * Spellings that are not the alpha-2 code itself. Resolved before the
 * alpha-2 pattern so `UK` does not read as an unknown region.
 */
const SIGNAL_ALIAS: Readonly<Record<string, string>> = {
  UK: 'GB',
  USA: 'US',
  GBR: 'GB',
  ARE: 'AE',
  JPN: 'JP',
  UAE: 'AE',
  'UNITED KINGDOM': 'GB',
  'UNITED STATES': 'US',
  'UNITED ARAB EMIRATES': 'AE',
  JAPAN: 'JP',
};

/**
 * Territory and reserved region codes whose parent is a hard-deny or
 * EEA state. French outermost regions and Saint-Martin, Åland, the
 * reserved Canary Islands and Ceuta/Melilla codes, and the US
 * territories. Azores and Madeira have no alpha-2 of their own.
 */
export const BACKPACK_TERRITORY_PARENT: Readonly<Record<string, string>> = {
  GF: 'FR',
  GP: 'FR',
  MQ: 'FR',
  RE: 'FR',
  YT: 'FR',
  MF: 'FR',
  AX: 'FI',
  IC: 'ES',
  EA: 'ES',
  AS: 'US',
  GU: 'US',
  MP: 'US',
  PR: 'US',
  UM: 'US',
  VI: 'US',
};

/**
 * Officially assigned ISO 3166-1 alpha-2 codes this module has placed
 * outside the hard-deny set and the EEA. Territory codes above are
 * absent. SJ (Svalbard and Jan Mayen) and BV (Bouvet Island) are
 * officially assigned and absent: this module cannot place either
 * code outside the EEA. Anything not in this list, the deny lists, or
 * the territory map is unreadable.
 */
export const BACKPACK_PLACED_OUTSIDE_COUNTRIES: readonly string[] = [
  'AD',
  'AF',
  'AG',
  'AI',
  'AL',
  'AM',
  'AO',
  'AQ',
  'AR',
  'AU',
  'AW',
  'AZ',
  'BA',
  'BB',
  'BD',
  'BF',
  'BH',
  'BI',
  'BJ',
  'BL',
  'BM',
  'BN',
  'BO',
  'BQ',
  'BR',
  'BS',
  'BT',
  'BW',
  'BY',
  'BZ',
  'CA',
  'CC',
  'CD',
  'CF',
  'CG',
  'CH',
  'CI',
  'CK',
  'CL',
  'CM',
  'CN',
  'CO',
  'CR',
  'CU',
  'CV',
  'CW',
  'CX',
  'DJ',
  'DM',
  'DO',
  'DZ',
  'EC',
  'EG',
  'EH',
  'ER',
  'ET',
  'FJ',
  'FK',
  'FM',
  'FO',
  'GA',
  'GD',
  'GE',
  'GG',
  'GH',
  'GI',
  'GL',
  'GM',
  'GN',
  'GQ',
  'GS',
  'GT',
  'GW',
  'GY',
  'HK',
  'HM',
  'HN',
  'HT',
  'ID',
  'IL',
  'IM',
  'IN',
  'IO',
  'IQ',
  'IR',
  'JE',
  'JM',
  'JO',
  'KE',
  'KG',
  'KH',
  'KI',
  'KM',
  'KN',
  'KP',
  'KR',
  'KW',
  'KY',
  'KZ',
  'LA',
  'LB',
  'LC',
  'LK',
  'LR',
  'LS',
  'LY',
  'MA',
  'MC',
  'MD',
  'ME',
  'MG',
  'MH',
  'MK',
  'ML',
  'MM',
  'MN',
  'MO',
  'MR',
  'MS',
  'MU',
  'MV',
  'MW',
  'MX',
  'MY',
  'MZ',
  'NA',
  'NC',
  'NE',
  'NF',
  'NG',
  'NI',
  'NP',
  'NR',
  'NU',
  'NZ',
  'OM',
  'PA',
  'PE',
  'PF',
  'PG',
  'PH',
  'PK',
  'PM',
  'PN',
  'PS',
  'PW',
  'PY',
  'QA',
  'RS',
  'RU',
  'RW',
  'SA',
  'SB',
  'SC',
  'SD',
  'SG',
  'SH',
  'SL',
  'SM',
  'SN',
  'SO',
  'SR',
  'SS',
  'ST',
  'SV',
  'SX',
  'SY',
  'SZ',
  'TC',
  'TD',
  'TF',
  'TG',
  'TH',
  'TJ',
  'TK',
  'TL',
  'TM',
  'TN',
  'TO',
  'TR',
  'TT',
  'TV',
  'TW',
  'TZ',
  'UA',
  'UG',
  'UY',
  'UZ',
  'VA',
  'VC',
  'VE',
  'VG',
  'VN',
  'VU',
  'WF',
  'WS',
  'YE',
  'ZA',
  'ZM',
  'ZW',
];

const HARD_DENY = new Set<string>(BACKPACK_SECURITIES_HARD_DENY_COUNTRIES);
const EEA = new Set<string>(BACKPACK_EEA_COUNTRIES);
const PLACED_OUTSIDE = new Set<string>(BACKPACK_PLACED_OUTSIDE_COUNTRIES);

export type ShelfReason =
  | 'hard-deny'
  | 'eea'
  | 'missing-signals'
  | 'unreadable-signal'
  | 'conflicting-signals'
  | 'signals-agree';

export type ShelfDecision = {
  showBackpackShelf: boolean;
  reason: ShelfReason;
  country?: string;
  /** True only when the preview simulation supplied the region used. */
  simulated: boolean;
};

export type BackpackShelfSignals = {
  deviceRegion?: string | null;
  /** Existing config `jurisdiction`, for example `US-FL` or `SG`. */
  serverJurisdiction?: string | null;
  simulatedRegion?: string | null;
  /** Exact `'1'` arms the switch. Every other value is off. */
  simulatedRegionFlag?: string | null;
  /** Native application id. Simulation requires the preview package. */
  previewApplicationId?: string | null;
};

export type ServedJurisdiction = {
  jurisdiction?: string | null;
  jurisdictionStatus?: 'resolved' | 'unknown' | 'stale';
};

type CountryRead =
  | { kind: 'absent' }
  | { kind: 'unreadable' }
  | { kind: 'hard-deny'; country: string }
  | { kind: 'eea'; country: string }
  | { kind: 'clear'; country: string };

function classify(code: string, hasSubdivision: boolean): CountryRead {
  const parent = BACKPACK_TERRITORY_PARENT[code];
  const resolved = parent ?? code;
  if (HARD_DENY.has(resolved)) return { kind: 'hard-deny', country: resolved };
  if (resolved === 'EU' || EEA.has(resolved)) {
    return { kind: 'eea', country: resolved };
  }
  if (parent !== undefined || hasSubdivision || !PLACED_OUTSIDE.has(code)) {
    return { kind: 'unreadable' };
  }
  return { kind: 'clear', country: code };
}

function readSignal(value: string | null | undefined): CountryRead {
  if (value == null) return { kind: 'absent' };
  if (typeof value !== 'string') return { kind: 'unreadable' };
  const cleaned = value
    .trim()
    .toUpperCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, ' ');
  if (cleaned === '') return { kind: 'unreadable' };
  const alias = SIGNAL_ALIAS[cleaned];
  if (alias !== undefined) return classify(alias, false);
  const match = /^([A-Z]{2})(?:-([A-Z0-9]{1,3}))?$/.exec(cleaned);
  if (match === null) return { kind: 'unreadable' };
  return classify(match[1], match[2] !== undefined);
}

function decide(
  reads: readonly CountryRead[],
  simulated: boolean,
): ShelfDecision {
  const hard = reads.find((read) => read.kind === 'hard-deny');
  if (hard !== undefined && hard.kind === 'hard-deny') {
    return {
      showBackpackShelf: false,
      reason: 'hard-deny',
      country: hard.country,
      simulated,
    };
  }
  const eea = reads.find((read) => read.kind === 'eea');
  if (eea !== undefined && eea.kind === 'eea') {
    return {
      showBackpackShelf: false,
      reason: 'eea',
      country: eea.country,
      simulated,
    };
  }
  if (reads.some((read) => read.kind === 'unreadable')) {
    return {
      showBackpackShelf: false,
      reason: 'unreadable-signal',
      simulated,
    };
  }
  const clear = reads.filter(
    (read): read is { kind: 'clear'; country: string } => read.kind === 'clear',
  );
  if (simulated) {
    if (clear.length !== 1) {
      return {
        showBackpackShelf: false,
        reason: 'missing-signals',
        simulated,
      };
    }
    return {
      showBackpackShelf: true,
      reason: 'signals-agree',
      country: clear[0].country,
      simulated,
    };
  }
  if (clear.length < 2) {
    return {
      showBackpackShelf: false,
      reason: 'missing-signals',
      simulated,
    };
  }
  if (clear[0].country === clear[1].country) {
    return {
      showBackpackShelf: true,
      reason: 'signals-agree',
      country: clear[0].country,
      simulated,
    };
  }
  return {
    showBackpackShelf: false,
    reason: 'conflicting-signals',
    simulated,
  };
}

function simulationArmed(signals: BackpackShelfSignals): boolean {
  return (
    signals.previewApplicationId === PREVIEW_PACKAGE_ID &&
    signals.simulatedRegionFlag === '1'
  );
}

export function evaluateBackpackSecuritiesShelf(
  signals: BackpackShelfSignals = {},
): ShelfDecision {
  if (simulationArmed(signals)) {
    return decide([readSignal(signals.simulatedRegion)], true);
  }
  return decide(
    [readSignal(signals.serverJurisdiction), readSignal(signals.deviceRegion)],
    false,
  );
}

/**
 * Region code from a caller-supplied localization snapshot.
 * Returns null when the snapshot is missing or blank.
 */
export function deviceRegionSignal(
  localization: { regionCode?: string | null } | null | undefined,
): string | null {
  if (localization == null) return null;
  const code = localization.regionCode;
  if (typeof code !== 'string') return null;
  const trimmed = code.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * The served jurisdiction, and only when its status is `resolved`.
 * Stale, unknown, and absent observations contribute no country.
 * A `country` property on the object is not read.
 */
export function serverJurisdictionFromConfig(
  config: ServedJurisdiction | null | undefined,
): string | null {
  if (config == null) return null;
  if (config.jurisdictionStatus !== 'resolved') return null;
  if (typeof config.jurisdiction !== 'string') return null;
  const trimmed = config.jurisdiction.trim();
  return trimmed === '' ? null : trimmed;
}

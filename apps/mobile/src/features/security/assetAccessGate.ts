export type AssetClass =
  | 'digital-commodity'
  | 'tokenised-equity'
  | 'suspected-equity';

export type AssetAction = 'view' | 'acquire' | 'dispose';

/**
 * ISO 3166-1 alpha-2, optionally with an ISO 3166-2 subdivision: `US`, `US-NY`,
 * `GB`, `DE`. `null` means the resolver could not determine one.
 */
export type Jurisdiction = string | null;

export type AccessDecision =
  | { allowed: true }
  | { allowed: false; reason: AccessDenialReason };

export type AccessDenialReason =
  /** No jurisdiction was resolved. Absence is not a permission. */
  | 'jurisdiction_unknown'
  /** A jurisdiction was resolved but is too coarse to evaluate the policy. */
  | 'jurisdiction_underspecified'
  /** Tokenised equities are not offered at v1 in any jurisdiction. */
  | 'equities_not_offered'
  /** This jurisdiction is excluded for this asset class. */
  | 'jurisdiction_restricted';

export const TOKENISED_EQUITY_MINTS: ReadonlySet<string> = new Set<string>([
  'SPCXxcqXj6e5dJDVNovHN8744zkbhM2bYudU45BimGb', // SPCX · SpaceX
  'SKHYhSjuRWHgikq8eRKbtBbpABgJSkd7ytQV14i9EQ3', // SKHY · SK Hynix
  'MUxEsUKSMACyw5fZf68wxf5FLnZVhtU9CwH8uNNGay1', // MU · Micron Technology
  'AMC1qwR9KhiyrQBRPrxnfo4JfMeMZqEBvt5tgTytNNoc', // AMC · AMC Entertainment
  'AMD8XwJXgQ9WV45Wyj9yFLejxzf2J6VM1PJY8bJEjeES', // AMD · Advanced Micro Devices
  'BEBVfXZ8uCxRBuunEbW9wcq9r7W9ySNo14oJBJkDgpZx', // BE · Bloom Energy
  'BLKKYfF41c6xRPrtX1rdYbxLE1xxEdZUnxQsB5hcZ8Nf', // BLK · BlackRock
  'DJTu7vi8norVzdVAffgvb39VP7wjKeTsgaMBJrzfxvoF', // DJT · Trump Media & Technology Group
  'DKNGQFNGQmoBdXSRGKJ8tTu7uPDasw5JDcfMmWniNfow', // DKNG · DraftKings
  'DRAMjSWR7HRfJKjRkvQWYL2bcaejaVhuxEcjf4pAY4Cw', // DRAM · Roundhill Memory ETF
  'EWY4owSJYMpwN33qGDu5gGxpkQkpMJu8ZUsQJaNZG5dv', // EWY · iShares MSCI South Korea ETF
  'HiMSSzzwkZkrXJ4PGVJRdtfLaANeAztjjcgk5Dxe7Lwx', // HIMS · Hims & Hers Health
  'MSTRdWXMeZxdE8osAQy3fA4rvTY5rgummDSMEx6U7Nz', // MSTR · Strategy
  'N7Q5fYX7YRnDQksfdBKnoUb3awm92n7QNAD35X3Rq1X', // NOK · Nokia Oyj
  'NFLX7qV57zuVxCoHy3s1jiGZyALraLNwttbxdvmYJLJ', // NFLX · Netflix
  'NKEda5nHhNGgjrE9nDdMvaEmkmJ96qqxzBVZEcKmjSg', // NKE · Nike
  'PUSAG1stksTcAoK9MjinEHUwAYRJsbovywYCk37m6hy', // PUSA · Powerus Corporation
  'RKLBnAXGqv31iZomqsuAWkQm1aqC7JwwvbCfzGdqAhz', // RKLB · Rocket Lab
  'SNDKbwMUQvZhnLnxLduradgLHG5KrPuKwpnrkkGRhfH', // SNDK · Sandisk
  'TTWofwAge91oFhZs7kpQdyrVRkmevgM88xijGvQFbKo', // TTWO · Take-Two Interactive
]);

const EQUITY_SYMBOL_SUFFIXES = ['x', 'on'] as const;

const EQUITY_NAME_MARKERS = [
  // Word-bounded. Unanchored `/xstocks/i` matched `FoxStocks`, `MaxStocks` and
  // even the literal string "not xstocks" — cross-model review demonstrated
  // that last one by running it. At v1 a false positive is a global acquire
  // outage for that token, so the marker has to be a word rather than a
  // substring. `[\s-]?` covers `xStocks`, `x-stocks` and `x stocks`.
  // `stocks?` — the plural was wrong. The issuer's own on-chain names are
  // **singular**: `Tesla xStock`, not `Tesla xStocks`. Cross-model review ran
  // `{symbol:'TSLAX', name:'Tesla xStock'}` and got `digital-commodity` back,
  // which also made the earlier "the name closes TSLAX" claim false. The
  // marketing pages say xStocks; the tokens say xStock.
  /(?:^|[\s(\[-])x[\s-]?stocks?\b/i,
  // Both spellings. `/tokeniz/` alone missed the British "Tokenised".
  /\bondo[\s-]+token(?:iz|is)ed\b/i,
  /\bbackpack[\s-]+securities\b/i,
] as const;

export const COMMODITY_RESTRICTED_JURISDICTIONS: ReadonlySet<string> = new Set([
  'US-NY',
]);

const SUPPORTED_COUNTRIES: ReadonlySet<string> = new Set(['US']);

/**
 * Country codes whose subdivision must be known before a commodity acquisition
 * can be evaluated, because a restriction exists somewhere inside them.
 *
 * Without this, a resolver returning a bare `US` would silently pass a New York
 * user — the restriction would exist in the constant and never fire.
 */
const SUBDIVISION_REQUIRED_COUNTRIES: ReadonlySet<string> = new Set(['US']);

/**
 * Valid US subdivisions, so `US-NYC`, `US-36` and `US-N` cannot masquerade as
 * one. A subdivision Corso does not recognise is refused, not cleared.
 */
const US_SUBDIVISIONS: ReadonlySet<string> = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI',
  'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN',
  'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH',
  'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA',
  'WV', 'WI', 'WY',
  // Territories, listed so they are a deliberate decision rather than an
  // accident of the 50-state list.
  'AS', 'GU', 'MP', 'PR', 'VI', 'UM',
  // Military mail codes. Real ISO 3166-2:US entries and real US users — an
  // Armed Forces address is a person, and omitting these refused them as an
  // unrecognised subdivision. Found by cross-model review; the 50-state list
  // felt complete and was not.
  'AA', 'AE', 'AP',
]);

/** Subdivision allowlists per country. Absent means none is recognised. */
const SUBDIVISIONS_BY_COUNTRY: ReadonlyMap<string, ReadonlySet<string>> =
  new Map([['US', US_SUBDIVISIONS]]);

const JURISDICTION_SHAPE = /^([A-Z]{2})(?:-([A-Z0-9]{1,3}))?$/;

type ParsedJurisdiction = { country: string; subdivision: string | null };

/**
 * Parse, or return `null` for anything that is not a well-formed code.
 *
 * `null` here means *unparseable*, and the caller treats it exactly like an
 * absent jurisdiction: a refusal. Malformed input is not a permission.
 */
function parseJurisdiction(jurisdiction: string): ParsedJurisdiction | null {
  const match = JURISDICTION_SHAPE.exec(jurisdiction.trim().toUpperCase());
  if (!match) return null;
  return { country: match[1], subdivision: match[2] ?? null };
}

/**
 * Classify a mint.
 *
 * Registry first, then the symbol convention. An unlisted mint with an ordinary
 * symbol is a digital commodity — which is the correct default, because the
 * alternative refuses every memecoin in the product.
 */
export function classifyAsset(args: {
  mint: string;
  symbol?: string | null;
  /** Token name, when known. The strongest available signal. */
  name?: string | null;
}): AssetClass {
  if (TOKENISED_EQUITY_MINTS.has(args.mint)) return 'tokenised-equity';

  const name = args.name?.trim();
  if (name && EQUITY_NAME_MARKERS.some((marker) => marker.test(name))) {
    return 'suspected-equity';
  }

  const symbol = args.symbol?.trim();
  if (symbol) {
    for (const suffix of EQUITY_SYMBOL_SUFFIXES) {
      // Suffix must be a real suffix on a longer symbol: `TSLAx` yes, `x` no,
      // and the part before it must be plausible ticker shape.
      if (
        symbol.length > suffix.length &&
        symbol.endsWith(suffix) &&
        /^[A-Z0-9.]{1,8}$/.test(symbol.slice(0, symbol.length - suffix.length))
      ) {
        return 'suspected-equity';
      }
    }
  }

  return 'digital-commodity';
}

/**
 * The policy.
 *
 * Every refusal names a reason. A caller that cannot render a reason should not
 * be calling this.
 */
export function resolveAssetAccess(args: {
  assetClass: AssetClass;
  jurisdiction: Jurisdiction;
  action: AssetAction;
}): AccessDecision {
  // Viewing and exiting are never gated, in any jurisdiction, for any class.
  // This branch is the one that keeps a restricted user from being trapped, and
  // it deliberately runs before every other check including the unknown
  // jurisdiction refusal.
  if (args.action === 'view' || args.action === 'dispose') {
    return { allowed: true };
  }

  if (args.jurisdiction == null) {
    return { allowed: false, reason: 'jurisdiction_unknown' };
  }

  // v1: not offered anywhere. Checked before jurisdiction specificity, because
  // the answer does not depend on where the user is.
  if (
    args.assetClass === 'tokenised-equity' ||
    args.assetClass === 'suspected-equity'
  ) {
    return { allowed: false, reason: 'equities_not_offered' };
  }

  const parsed = parseJurisdiction(args.jurisdiction);
  if (parsed == null) {
    // Unparseable is treated as absent. `''`, `USA-NY` and `US_NY` are not
    // jurisdictions we can evaluate, so they cannot be jurisdictions we clear.
    return { allowed: false, reason: 'jurisdiction_unknown' };
  }

  const { country, subdivision } = parsed;

  // Allowlist, not denylist. An unserved or unrecognised country is refused,
  // which is also correct for the product: v1 ships in the US only.
  if (!SUPPORTED_COUNTRIES.has(country)) {
    return { allowed: false, reason: 'jurisdiction_restricted' };
  }

  if (SUBDIVISION_REQUIRED_COUNTRIES.has(country) && subdivision == null) {
    return { allowed: false, reason: 'jurisdiction_underspecified' };
  }

  // A subdivision we do not recognise cannot be cleared. `US-NYC`, `US-36` and
  // `US-N` are not states, and treating them as "some other state, therefore
  // fine" is how the New York restriction was bypassed.
  if (subdivision != null) {
    const known = SUBDIVISIONS_BY_COUNTRY.get(country);
    if (!known || !known.has(subdivision)) {
      return { allowed: false, reason: 'jurisdiction_unknown' };
    }
  }

  const full = subdivision ? `${country}-${subdivision}` : country;
  if (
    COMMODITY_RESTRICTED_JURISDICTIONS.has(full) ||
    COMMODITY_RESTRICTED_JURISDICTIONS.has(country)
  ) {
    return { allowed: false, reason: 'jurisdiction_restricted' };
  }

  return { allowed: true };
}

/** Convenience for the common call: classify, then decide. */
export function resolveMintAccess(args: {
  mint: string;
  symbol?: string | null;
  name?: string | null;
  jurisdiction: Jurisdiction;
  action: AssetAction;
}): AccessDecision {
  return resolveAssetAccess({
    assetClass: classifyAsset({
      mint: args.mint,
      symbol: args.symbol,
      name: args.name,
    }),
    jurisdiction: args.jurisdiction,
    action: args.action,
  });
}

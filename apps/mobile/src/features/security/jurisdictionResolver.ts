import {
  COMMODITY_RESTRICTED_JURISDICTIONS,
  type Jurisdiction,
} from './assetAccessGate';

/**
 * Where a jurisdiction claim came from, most trustworthy first.
 *
 * `api-ip` is observed server-side from the connecting address. `device-region`
 * is the OS locale region, which the user can change. `store-territory` is the
 * storefront the app was installed from, which is stable but can lag a move by
 * a long time.
 */
export type JurisdictionSource = 'api-ip' | 'device-region' | 'store-territory';

const SOURCE_RANK: Record<JurisdictionSource, number> = {
  'api-ip': 0,
  'device-region': 1,
  'store-territory': 2,
};

export type JurisdictionSignal = {
  source: JurisdictionSource;
  /** Raw and possibly malformed. Normalisation happens here, not at the edge. */
  value: string | null | undefined;
};

export type JurisdictionResolution = {
  jurisdiction: Jurisdiction;
  /**
   * `restricted` — a signal named a restricted place and it was taken.
   * `agreed` — every usable signal named the same place.
   * `single` — exactly one usable signal.
   * `conflict` — usable signals disagreed. `jurisdiction` is `null`.
   * `none` — nothing usable. `jurisdiction` is `null`.
   */
  basis: 'restricted' | 'agreed' | 'single' | 'conflict' | 'none';
};

/** Same shape the gate parses. Anything else is discarded, not repaired. */
const SHAPE = /^([A-Z]{2})(?:-([A-Z0-9]{1,3}))?$/;

/**
 * Case and separator only. Nothing else is repaired.
 *
 * ⚠️ **Locale tags are not accepted, and that is deliberate.** An earlier
 * version tried to be helpful with `en-US`, and it was wrong twice over. A
 * language-region tag and a country-subdivision tag are **the same shape**:
 * `EN-US` matched the strict pattern first and came back as "country EN,
 * subdivision US", and `fr-CA` came back as "France, subdivision CA" — a real
 * country with a plausible-looking subdivision, which is the worst possible
 * failure because it looks correct. A fallback branch that split on `-` then
 * also turned `US--NY` into a bare `NY`.
 *
 * There is no way to tell a locale from a jurisdiction by shape, so the module
 * does not try. **The caller knows which it holds and extracts the region
 * itself.** Guessing here is exactly the "repair into a guess" this file claims
 * not to do, and it did it.
 */
function normalise(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().toUpperCase().replace(/_/g, '-');
  return SHAPE.test(cleaned) ? cleaned : null;
}

/**
 * Resolve one jurisdiction from the available signals.
 *
 * Returns `null` rather than a best guess whenever the signals do not support a
 * single answer. The gate treats `null` as a refusal, which is the intended
 * outcome: not knowing where someone is is not permission to serve them.
 */
export function resolveJurisdiction(
  signals: readonly JurisdictionSignal[],
): JurisdictionResolution {
  const present = signals.filter(
    (signal) => signal.value !== null && signal.value !== undefined,
  );
  const usable = present
    .map((signal) => ({ source: signal.source, value: normalise(signal.value) }))
    .filter((signal): signal is { source: JurisdictionSource; value: string } =>
      signal.value !== null,
    )
    .sort((a, b) => SOURCE_RANK[a.source] - SOURCE_RANK[b.source]);

  const unreadable = present.length - usable.length;

  if (usable.length === 0) return { jurisdiction: null, basis: 'none' };

  // Rule 1. A restriction anywhere in the signal set wins outright, whatever
  // its source rank. This is the spoofed-device-region case.
  const restricted = usable.find((signal) =>
    isRestricted(signal.value),
  );
  if (restricted) {
    return { jurisdiction: restricted.value, basis: 'restricted' };
  }

  // An unreadable signal could have been anything, including a restriction, so
  // the readable ones cannot be trusted to agree. Checked *after* rule 1 on
  // purpose: a signal we can read and that names a restriction still wins, so
  // garbage alongside `US-NY` refuses for the right reason.
  if (unreadable > 0) {
    return { jurisdiction: null, basis: 'conflict' };
  }

  const distinct = new Set(usable.map((signal) => signal.value));
  if (distinct.size === 1) {
    return {
      jurisdiction: usable[0].value,
      basis: usable.length === 1 ? 'single' : 'agreed',
    };
  }

  // Rule 2. Disagreement with no restriction in sight means we do not know.
  return { jurisdiction: null, basis: 'conflict' };
}

/**
 * Whether a code names a restricted place, at country or subdivision level.
 *
 * Checking the country prefix as well matters: if a whole country is ever
 * restricted, `XX-YY` must inherit it rather than slipping past on an exact
 * string match. That is the bypass class cross-model review found in the gate.
 */
function isRestricted(value: string): boolean {
  if (COMMODITY_RESTRICTED_JURISDICTIONS.has(value)) return true;
  const country = value.split('-')[0];
  return COMMODITY_RESTRICTED_JURISDICTIONS.has(country);
}

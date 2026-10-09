export const REQUIRED_DISCLOSURE_IDS = [
  /** 1. Corso's role in a swap. */
  'role',
  /** 2. Fees and how they are calculated. */
  'fees',
  /** 3. Conflicts of interest. */
  'conflicts',
  /** 4. Limitations — what Corso does not do or promise. */
  'limitations',
  /** 5. Software parameters — how the thing actually works. */
  'software-parameters',
  /** 6. Cybersecurity. */
  'cybersecurity',
  /** 7. Protection of user swap information, including MEV. */
  'swap-information',
  /** 8. Venue integration and how Jupiter was evaluated. */
  'venue',
  /** 9. Default parameters, including slippage. */
  'defaults',
] as const;

export type DisclosureId = (typeof REQUIRED_DISCLOSURE_IDS)[number];

export const REQUIRED_DISCLOSURE_COUNT = 9;

export type Disclosure = {
  id: DisclosureId;
  /** Short heading shown in the list. */
  title: string;
  /** The disclosure itself. Never empty. */
  body: string;
};

export type DisclosureSet = {
  /**
   * The not-registered disclaimer. Rendered on Review alongside the fee, and at
   * the head of the disclosure list.
   */
  disclaimer: string;
  /** All nine, in `REQUIRED_DISCLOSURE_IDS` order. */
  disclosures: Disclosure[];
};

export type DisclosureSetFailure =
  /** Nothing arrived, or it was not an object. */
  | 'disclosures_unavailable'
  /** The not-registered disclaimer was missing or blank. */
  | 'disclaimer_missing'
  /** One or more of the nine was absent. */
  | 'disclosure_missing'
  /** An id arrived that is not one of the nine. */
  | 'disclosure_unrecognised'
  /** An id arrived twice, so a duplicate could stand in for a missing one. */
  | 'disclosure_duplicated'
  /** A disclosure arrived with an empty title or body. */
  | 'disclosure_empty'
  | 'disclosure_misordered';

export type DisclosureSetResult =
  | { ok: true; set: DisclosureSet }
  | { ok: false; reason: DisclosureSetFailure };

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Validate an untrusted payload into a complete disclosure set.
 *
 * Used by the API on the way out and by the client on the way in — the same
 * function, so "complete" cannot mean two different things at the two ends.
 *
 * Every branch returns a refusal. There is no partial success and no repair: a
 * set that is missing one disclosure is not a set with eight, it is a door that
 * does not open.
 */
export function parseDisclosureSet(input: unknown): DisclosureSetResult {
  if (!input || typeof input !== 'object') {
    return { ok: false, reason: 'disclosures_unavailable' };
  }

  const raw = input as { disclaimer?: unknown; disclosures?: unknown };

  const disclaimer = nonEmptyString(raw.disclaimer);
  if (disclaimer === null) {
    return { ok: false, reason: 'disclaimer_missing' };
  }

  if (!Array.isArray(raw.disclosures)) {
    return { ok: false, reason: 'disclosures_unavailable' };
  }

  const seen = new Set<string>();
  const parsed: Disclosure[] = [];

  for (const entry of raw.disclosures) {
    if (!entry || typeof entry !== 'object') {
      return { ok: false, reason: 'disclosure_empty' };
    }
    const item = entry as { id?: unknown; title?: unknown; body?: unknown };

    const id = nonEmptyString(item.id);
    if (id === null) {
      return { ok: false, reason: 'disclosure_empty' };
    }
    // An unrecognised id is refused rather than ignored. Ignoring it would let a
    // server rename `fees` to `fee` and satisfy nothing while looking full.
    if (!(REQUIRED_DISCLOSURE_IDS as readonly string[]).includes(id)) {
      return { ok: false, reason: 'disclosure_unrecognised' };
    }
    if (seen.has(id)) {
      return { ok: false, reason: 'disclosure_duplicated' };
    }
    seen.add(id);

    const title = nonEmptyString(item.title);
    const body = nonEmptyString(item.body);
    if (title === null || body === null) {
      return { ok: false, reason: 'disclosure_empty' };
    }

    parsed.push({ id: id as DisclosureId, title, body });
  }

  // Count is checked against the named constant rather than the array length,
  // so deleting an entry from REQUIRED_DISCLOSURE_IDS fails here instead of
  // silently redefining what nine means.
  if (
    parsed.length !== REQUIRED_DISCLOSURE_COUNT ||
    REQUIRED_DISCLOSURE_IDS.length !== REQUIRED_DISCLOSURE_COUNT
  ) {
    return { ok: false, reason: 'disclosure_missing' };
  }
  for (const required of REQUIRED_DISCLOSURE_IDS) {
    if (!seen.has(required)) {
      return { ok: false, reason: 'disclosure_missing' };
    }
  }

  for (let index = 0; index < REQUIRED_DISCLOSURE_IDS.length; index += 1) {
    if (parsed[index].id !== REQUIRED_DISCLOSURE_IDS[index]) {
      return { ok: false, reason: 'disclosure_misordered' };
    }
  }

  return { ok: true, set: { disclaimer, disclosures: parsed } };
}

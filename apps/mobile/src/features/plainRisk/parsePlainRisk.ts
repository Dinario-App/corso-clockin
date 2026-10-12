
export const PLAIN_RISK_RULESETS = ['risk-v3', 'risk-v4'] as const;

export const HELD_REASON_CODES = ['permanent_delegate'] as const;

export const PLAIN_RISK_LEVELS = [
  'green',
  'amber',
  'red',
  'notEnoughData',
  'unavailable',
] as const;

export type PlainRiskLevel = (typeof PLAIN_RISK_LEVELS)[number];

export const PLAIN_RISK_REASON_CODES = [
  'cannot_sell',
  'mint_authority',
  'freeze_authority',
  'issuer_can_mint',
  'issuer_can_freeze',
  'issuer_can_move',
  'no_liquidity',
  'thin_liquidity',
  'low_liquidity',
  'holders_concentrated',
  'rugcheck_danger',
  'rugcheck_warning',
  'permanent_delegate',
  'rugged',
  'other_hard',
  'pausable',
  'transfer_hook',
  'transfer_fee',
  'lp_lock',
  'dev_share',
  'sniper_share',
  'insider_cluster',
  'bundler_share',
  'other_soft',
  'check_empty',
] as const;

export type PlainRiskReasonCode = (typeof PLAIN_RISK_REASON_CODES)[number];

export type PlainRiskReason = {
  code: PlainRiskReasonCode;
  issuer?: string;
  check?: string;
};

export type PlainRiskRead =
  | {
      level: Exclude<PlainRiskLevel, 'unavailable'>;
      reasons: readonly PlainRiskReason[];
      ruleset: (typeof PLAIN_RISK_RULESETS)[number];
      asOfMs: number;
      /**
       * Set when the server sent reasons this build can't put words to. The
       * level stands (a newer server knows more), and the sheet says
       * something else is flagged rather than listing only clean checks.
       */
      unreadReasons?: true;
    }
  | { level: 'unavailable' };

export const PLAIN_RISK_UNAVAILABLE: PlainRiskRead = Object.freeze({
  level: 'unavailable',
});

const DISCLOSURE_CODES: ReadonlySet<PlainRiskReasonCode> = new Set([
  'issuer_can_mint',
  'issuer_can_freeze',
  'issuer_can_move',
]);

const MAX_REASONS = 64;
const MAX_LABEL = 80;

function rec(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function label(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_LABEL
    ? trimmed
    : undefined;
}

function isKnown<T extends string>(
  list: readonly T[],
  value: unknown,
): value is T {
  return (
    typeof value === 'string' && (list as readonly string[]).includes(value)
  );
}

function wireLevel(value: unknown): PlainRiskLevel | null {
  if (value === 'not_enough_data') return 'notEnoughData';
  return isKnown(PLAIN_RISK_LEVELS, value) ? value : null;
}

function parseReason(raw: unknown): PlainRiskReason | null {
  const body = rec(raw);
  if (!body || !isKnown(PLAIN_RISK_REASON_CODES, body.code)) return null;
  const issuer = label(body.issuer);
  const check = label(body.check);
  if (DISCLOSURE_CODES.has(body.code) && !issuer) return null;
  if (body.code === 'check_empty' && !check) return null;
  return {
    code: body.code,
    ...(issuer ? { issuer } : {}),
    ...(check ? { check } : {}),
  };
}

/**
 * Read the plain-risk fields off a vitals body. Takes the whole body, so a
 * caller never has to know which keys carry the rule.
 */
export function parsePlainRisk(raw: unknown): PlainRiskRead {
  const body = rec(raw);
  if (!body) return PLAIN_RISK_UNAVAILABLE;

  const level = wireLevel(body.riskLevel);
  if (level == null || level === 'unavailable') return PLAIN_RISK_UNAVAILABLE;
  if (!isKnown(PLAIN_RISK_RULESETS, body.ruleset))
    return PLAIN_RISK_UNAVAILABLE;

  const asOfMs = body.asOfMs;
  if (typeof asOfMs !== 'number' || !Number.isFinite(asOfMs) || asOfMs <= 0) {
    return PLAIN_RISK_UNAVAILABLE;
  }

  if (!Array.isArray(body.reasons) || body.reasons.length > MAX_REASONS) {
    return PLAIN_RISK_UNAVAILABLE;
  }
  if (body.reasons.some((item) => isKnown(HELD_REASON_CODES, rec(item)?.code)))
    return PLAIN_RISK_UNAVAILABLE;
  const reasons: PlainRiskReason[] = [];
  let unknown = 0;
  for (const item of body.reasons) {
    const reason = parseReason(item);
    if (reason) reasons.push(reason);
    else unknown += 1;
  }

  let read = level;
  if (level === 'green') {
    if (unknown > 0) return PLAIN_RISK_UNAVAILABLE;
    if (
      reasons.some(
        (r) => !DISCLOSURE_CODES.has(r.code) && r.code !== 'check_empty',
      )
    ) {
      return PLAIN_RISK_UNAVAILABLE;
    }
    if (reasons.some((r) => r.code === 'check_empty')) read = 'notEnoughData';
  }

  return {
    level: read,
    reasons,
    ruleset: body.ruleset,
    asOfMs,
    ...(unknown > 0 ? { unreadReasons: true as const } : {}),
  };
}

/**
 * The read a surface paints for a vitals payload. A payload with no plain-risk
 * fields (an older server) reads `unavailable`: the parser leaves the key off
 * so the payload still round-trips, and this is where the absence fails closed.
 */
export function plainRiskOf(
  payload: { plainRisk?: PlainRiskRead } | null | undefined,
): PlainRiskRead {
  return payload?.plainRisk ?? PLAIN_RISK_UNAVAILABLE;
}

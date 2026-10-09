import { copy } from '@/constants/copy';
import { SOL_MINT, usdcMintForCluster } from '@/src/features/swap/tokens';
import {
  isSafetyCrossSkill,
  SKILL_HARD_BOUNDS,
  SKILL_SAFETY_CONDITIONS,
  type SkillLeg,
  type SkillSafetyCondition,
  type SkillTemplate,
} from './skillTemplate';

/** A token the user holds, offered as the token-slot choice. Never invented. */
export type SkillTokenChoice = {
  mint: string;
  symbol: string;
  decimals: number;
};

export type ConfigureSlotsInput = {
  token: SkillTokenChoice | null;
  /**
   * Decimal strings as typed. Unused by a `safety_cross` template, which has no
   * percentage; `safety` below is its threshold instead.
   */
  pct: string;
  safety: SkillSafetyCondition | null;
  amount: string;
  perFireMax: string;
  perDayMaxFires: string;
  perDayMax: string;
  minOutBps: string;
  expiryDays: string;
};

export type ConfigureSlotKey = keyof ConfigureSlotsInput;

export type ConfigureErrors = Partial<Record<ConfigureSlotKey, string>>;

type SkillMandateDraftBase = Readonly<{
  skillId: SkillTemplate['id'];
  sourceText: string;
  action: Readonly<{
    verb: 'swap';
    inputMint: string;
    inputSymbol: string;
    inputDecimals: number;
    outputMint: string;
    outputSymbol: string;
    amountBaseUnits: string;
  }>;
  caps: Readonly<{
    perFireMaxBaseUnits: string;
    perDayMaxFires: number;
    perDayMaxBaseUnits: string;
    minOutBps: number;
  }>;
  expiry: Readonly<{ expiresAt: string; days: number }>;
}>;

/** Mirrors `PriceCrossAuthoring['condition']` minus the server-owned baseline price. */
export type PriceCrossDraftCondition = Readonly<{
  leg: SkillLeg;
  pct: string;
  baselineMint: string;
  baselineSymbol: string;
}>;

export type SafetyCrossDraftCondition = Readonly<{
  safety: SkillSafetyCondition;
  baselineMint: string;
  baselineSymbol: string;
}>;

export type SkillMandateDraft =
  | (SkillMandateDraftBase &
      Readonly<{ trigger: 'price_cross'; condition: PriceCrossDraftCondition }>)
  | (SkillMandateDraftBase &
      Readonly<{
        trigger: 'safety_cross';
        condition: SafetyCrossDraftCondition;
      }>);

export const USDC_DECIMALS = 6;

const DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const INTEGER = /^(?:0|[1-9]\d*)$/;

export function isPositiveDecimal(value: string): boolean {
  const trimmed = value.trim();
  return DECIMAL.test(trimmed) && /[1-9]/.test(trimmed);
}

export function isPositiveInteger(value: string): boolean {
  const trimmed = value.trim();
  return INTEGER.test(trimmed) && trimmed !== '0';
}

/** Decimal display units → integer base units, string math only. Null on overflow of scale. */
export function toBaseUnits(decimal: string, decimals: number): string | null {
  const trimmed = decimal.trim();
  if (!DECIMAL.test(trimmed)) return null;
  const [whole, fraction = ''] = trimmed.split('.');
  if (fraction.length > decimals) return null;
  const digits = `${whole}${fraction.padEnd(decimals, '0')}`.replace(
    /^0+(?=\d)/,
    '',
  );
  return digits.length > 0 ? digits : '0';
}

/** Integer base units → decimal display, trimmed. */
export function fromBaseUnits(baseUnits: string, decimals: number): string {
  const digits = baseUnits.replace(/^0+(?=\d)/, '');
  if (decimals === 0) return digits;
  const padded = digits.padStart(decimals + 1, '0');
  const whole = padded.slice(0, padded.length - decimals);
  const fraction = padded.slice(padded.length - decimals).replace(/0+$/, '');
  return fraction.length > 0 ? `${whole}.${fraction}` : whole;
}

function compareBaseUnits(a: string, b: string): number {
  if (a.length !== b.length) return a.length - b.length;
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareDecimal(a: string, b: string): number {
  const scale = Math.max(
    a.split('.')[1]?.length ?? 0,
    b.split('.')[1]?.length ?? 0,
  );
  const left = toBaseUnits(a, scale);
  const right = toBaseUnits(b, scale);
  if (left === null || right === null) return 0;
  return compareBaseUnits(left, right);
}

/** Template defaults as the form's initial fill; the token stays empty. */
export function initialConfigureSlots(
  template: SkillTemplate,
): ConfigureSlotsInput {
  if (template.kind !== 'execute') {
    return {
      token: null,
      pct: '',
      safety: null,
      amount: '',
      perFireMax: '',
      perDayMaxFires: '',
      perDayMax: '',
      minOutBps: '',
      expiryDays: '',
    };
  }
  return {
    token: null,
    // Exactly one of these two is the template's threshold; the other stays
    // empty and is never read for that template.
    pct: isSafetyCrossSkill(template) ? '' : template.slots.pct.default,
    safety: isSafetyCrossSkill(template) ? template.slots.safety.default : null,
    amount: '',
    perFireMax: '',
    perDayMaxFires: String(template.slots.perDayMaxFires.default),
    perDayMax: '',
    minOutBps: String(template.slots.minOutBps.default),
    expiryDays: String(template.slots.expiryDays.default),
  };
}

export function resolveSkillPair(
  template: SkillTemplate,
  token: SkillTokenChoice,
  cluster: 'devnet' | 'mainnet-beta' | null,
): { input: SkillTokenChoice; output: SkillTokenChoice } | null {
  if (template.kind !== 'execute' || cluster === null) return null;
  const usdc: SkillTokenChoice = {
    mint: usdcMintForCluster(cluster),
    symbol: 'USDC',
    decimals: USDC_DECIMALS,
  };
  if (token.mint === usdc.mint) return null;
  return template.shape.pair === 'usdc_to_token'
    ? { input: usdc, output: token }
    : { input: token, output: usdc };
}

/** The list of tokens the user may name: what they hold, never a suggestion. */
export function tokenChoicesFromHoldings(
  lines: ReadonlyArray<{
    mint: string;
    symbol: string;
    decimals: number;
    atomic: string;
  }>,
): SkillTokenChoice[] {
  const seen = new Set<string>();
  const choices: SkillTokenChoice[] = [];
  for (const line of lines) {
    if (seen.has(line.mint)) continue;
    if (!/[1-9]/.test(line.atomic)) continue;
    seen.add(line.mint);
    choices.push({
      mint: line.mint,
      symbol: line.symbol,
      decimals: line.decimals,
    });
  }
  return choices;
}

export const NATIVE_TEST_TOKEN: SkillTokenChoice = Object.freeze({
  mint: SOL_MINT,
  symbol: 'SOL',
  decimals: 9,
});

export function validateConfigureSlots(
  template: SkillTemplate,
  slots: ConfigureSlotsInput,
  cluster: 'devnet' | 'mainnet-beta' | null,
): ConfigureErrors {
  const errors: ConfigureErrors = {};
  const c = copy.skills.configure.errors;
  if (template.kind !== 'execute') return errors;

  const pair = slots.token
    ? resolveSkillPair(template, slots.token, cluster)
    : null;
  if (!slots.token || !pair) errors.token = c.tokenRequired;

  const bounds = template.slots;
  if (isSafetyCrossSkill(template)) {
    if (
      slots.safety === null ||
      !SKILL_SAFETY_CONDITIONS.includes(slots.safety) ||
      !template.slots.safety.allowed.includes(slots.safety)
    ) {
      errors.safety = c.safetyRequired;
    }
  } else if (!isPositiveDecimal(slots.pct)) {
    errors.pct = c.positiveDecimal;
  } else if (
    compareDecimal(slots.pct, template.slots.pct.min) < 0 ||
    compareDecimal(slots.pct, template.slots.pct.max) > 0
  ) {
    errors.pct = c.thresholdRange(
      template.slots.pct.min,
      template.slots.pct.max,
    );
  }

  const inputDecimals = pair?.input.decimals ?? USDC_DECIMALS;
  const amount = isPositiveDecimal(slots.amount)
    ? toBaseUnits(slots.amount, inputDecimals)
    : null;
  const perFire = isPositiveDecimal(slots.perFireMax)
    ? toBaseUnits(slots.perFireMax, inputDecimals)
    : null;
  const perDay = isPositiveDecimal(slots.perDayMax)
    ? toBaseUnits(slots.perDayMax, inputDecimals)
    : null;
  if (amount === null) errors.amount = c.positiveDecimal;
  if (perFire === null) errors.perFireMax = c.positiveDecimal;
  if (perDay === null) errors.perDayMax = c.positiveDecimal;
  if (
    amount !== null &&
    perFire !== null &&
    compareBaseUnits(amount, perFire) > 0
  ) {
    errors.amount = c.amountOverPerFire;
  }
  if (
    perFire !== null &&
    perDay !== null &&
    compareBaseUnits(perFire, perDay) > 0
  ) {
    errors.perFireMax = c.perFireOverPerDay;
  }

  if (!isPositiveInteger(slots.perDayMaxFires)) {
    errors.perDayMaxFires = c.positiveInteger;
  } else {
    const fires = Number(slots.perDayMaxFires);
    if (
      fires < bounds.perDayMaxFires.min ||
      fires > bounds.perDayMaxFires.max
    ) {
      errors.perDayMaxFires = c.perDayFiresRange(bounds.perDayMaxFires.max);
    }
  }

  if (!isPositiveInteger(slots.minOutBps)) {
    errors.minOutBps = c.positiveInteger;
  } else {
    const bps = Number(slots.minOutBps);
    if (bps < bounds.minOutBps.min || bps > bounds.minOutBps.max) {
      errors.minOutBps = c.minOutBpsRange(bounds.minOutBps.max);
    }
  }

  if (!isPositiveInteger(slots.expiryDays)) {
    errors.expiryDays = c.positiveInteger;
  } else {
    const days = Number(slots.expiryDays);
    if (
      days < bounds.expiryDays.min ||
      days > Math.min(bounds.expiryDays.max, SKILL_HARD_BOUNDS.maxExpiryDays)
    ) {
      errors.expiryDays = c.expiryRange(bounds.expiryDays.max);
    }
  }
  return errors;
}

const DAY_MS = 24 * 60 * 60 * 1_000;

/**
 * Validated slots → inert draft. Returns null when validation fails, so a
 * draft can only exist for a fill inside the bounds. `now` is injected.
 */
export function buildSkillMandateDraft(args: {
  template: SkillTemplate;
  slots: ConfigureSlotsInput;
  cluster: 'devnet' | 'mainnet-beta' | null;
  now: Date;
}): SkillMandateDraft | null {
  const { template, slots, cluster, now } = args;
  if (template.kind !== 'execute') return null;
  if (Object.keys(validateConfigureSlots(template, slots, cluster)).length > 0)
    return null;
  if (!slots.token) return null;
  const pair = resolveSkillPair(template, slots.token, cluster);
  if (!pair) return null;
  const decimals = pair.input.decimals;
  const amountBaseUnits = toBaseUnits(slots.amount, decimals);
  const perFireMaxBaseUnits = toBaseUnits(slots.perFireMax, decimals);
  const perDayMaxBaseUnits = toBaseUnits(slots.perDayMax, decimals);
  if (
    amountBaseUnits === null ||
    perFireMaxBaseUnits === null ||
    perDayMaxBaseUnits === null
  ) {
    return null;
  }
  const days = Number(slots.expiryDays);
  const name = copy.skills.template[template.id].name;
  const c = copy.skills.configure;
  const common = {
    skillId: template.id,
    action: Object.freeze({
      verb: 'swap',
      inputMint: pair.input.mint,
      inputSymbol: pair.input.symbol,
      inputDecimals: decimals,
      outputMint: pair.output.mint,
      outputSymbol: pair.output.symbol,
      amountBaseUnits,
    }),
    caps: Object.freeze({
      perFireMaxBaseUnits,
      perDayMaxFires: Number(slots.perDayMaxFires),
      perDayMaxBaseUnits,
      minOutBps: Number(slots.minOutBps),
    }),
    expiry: Object.freeze({
      expiresAt: new Date(now.getTime() + days * DAY_MS).toISOString(),
      days,
    }),
  } as const;

  if (isSafetyCrossSkill(template)) {
    const safety = slots.safety;
    if (safety === null) return null;
    return Object.freeze({
      ...common,
      sourceText: `${name}: ${c.safetyCondition(slots.token.symbol, safety)}`,
      trigger: 'safety_cross',
      condition: Object.freeze({
        safety,
        baselineMint: slots.token.mint,
        baselineSymbol: slots.token.symbol,
      }),
    });
  }
  const pct = slots.pct.trim();
  return Object.freeze({
    ...common,
    sourceText: `${name}: ${c.condition(slots.token.symbol, template.shape.leg, pct)}`,
    trigger: 'price_cross',
    condition: Object.freeze({
      leg: template.shape.leg,
      pct,
      baselineMint: slots.token.mint,
      baselineSymbol: slots.token.symbol,
    }),
  });
}

export const SKILL_TEMPLATE_IDS = Object.freeze([
  'the_verdict',
  'heads_up',
] as const);

export type SkillTemplateId = (typeof SKILL_TEMPLATE_IDS)[number];

export type SkillKind = 'execute' | 'analytics';

export type SkillCategory = 'screen';

export type SkillTrigger = 'price_cross' | 'safety_cross';
export type SkillActionVerb = 'swap';
export type SkillLeg = 'up' | 'down';

export const SKILL_SAFETY_CONDITIONS = Object.freeze([
  'toAmberOrWorse',
  'toRed',
] as const);
export type SkillSafetyCondition = (typeof SKILL_SAFETY_CONDITIONS)[number];
/** The verdict observed when the rule is set. `unknown` is not a baseline. */
export type SkillKnownVerdict = 'green' | 'amber' | 'red';

/**
 * Which side of the swap the user's named token sits on. The other side is
 * the network's USDC, resolved from the live cluster at configure time — a
 * shape, not a mint: the template never names the USDC mint either.
 */
export type SkillPairShape = 'usdc_to_token' | 'token_to_usdc';

export type DecimalSlotBounds = Readonly<{
  /** Decimal string in display units; a suggestion the user may edit. */
  default: string;
  min: string;
  max: string;
}>;

export type IntegerSlotBounds = Readonly<{
  default: number;
  min: number;
  max: number;
}>;

export type PriceCrossShape = Readonly<{
  trigger: 'price_cross';
  leg: SkillLeg;
  verb: SkillActionVerb;
  pair: SkillPairShape;
}>;

export type SafetyCrossShape = Readonly<{
  trigger: 'safety_cross';
  verb: SkillActionVerb;
  pair: SkillPairShape;
}>;

export type ExecuteShape = PriceCrossShape | SafetyCrossShape;

/** Hard ceilings mirrored from `mandateModel.ts`; the user cannot exceed them. */
export const SKILL_HARD_BOUNDS = Object.freeze({
  maxMinOutBps: 5_000,
  maxExpiryDays: 30,
  defaultExpiryDays: 7,
  maxPerDayFires: 24,
});

/** The caps + expiry bounds every execute template carries, whatever its trigger. */
type ExecuteCapSlots = Readonly<{
  /** The user's token. `null` by construction; never populated by a template. */
  token: null;
  perDayMaxFires: IntegerSlotBounds;
  minOutBps: IntegerSlotBounds;
  expiryDays: IntegerSlotBounds;
}>;

export type PriceCrossSlots = ExecuteCapSlots &
  Readonly<{ pct: DecimalSlotBounds }>;

export type SafetyCrossSlots = ExecuteCapSlots &
  Readonly<{
    safety: Readonly<{
      default: SkillSafetyCondition;
      allowed: ReadonlyArray<SkillSafetyCondition>;
    }>;
  }>;

export type ExecuteSlots = PriceCrossSlots | SafetyCrossSlots;

export type SkillTemplate =
  | Readonly<{
      id: SkillTemplateId;
      version: 1;
      kind: 'execute';
      category: SkillCategory;
      shape: PriceCrossShape;
      slots: PriceCrossSlots;
    }>
  | Readonly<{
      id: SkillTemplateId;
      version: 1;
      kind: 'execute';
      category: SkillCategory;
      shape: SafetyCrossShape;
      slots: SafetyCrossSlots;
    }>
  | Readonly<{
      id: SkillTemplateId;
      version: 1;
      kind: 'analytics';
      category: SkillCategory;
      shape: null;
      slots: Readonly<{ token: null }>;
    }>;

const TEMPLATE_BY_ID: Readonly<Record<SkillTemplateId, SkillTemplate>> =
  Object.freeze({
    the_verdict: Object.freeze({
      id: 'the_verdict',
      version: 1,
      kind: 'analytics',
      category: 'screen',
      shape: null,
      slots: Object.freeze({ token: null }),
    }),
    heads_up: Object.freeze({
      id: 'heads_up',
      version: 1,
      kind: 'analytics',
      category: 'screen',
      shape: null,
      slots: Object.freeze({ token: null }),
    }),
  });

/** Curated first-party directory, in browse order. Finite by construction. */
export const FIRST_PARTY_SKILLS: ReadonlyArray<SkillTemplate> = Object.freeze(
  SKILL_TEMPLATE_IDS.map((id) => TEMPLATE_BY_ID[id]),
);

export const TESTABLE_SKILL_IDS: ReadonlySet<SkillTemplateId> = Object.freeze(
  new Set<SkillTemplateId>(['the_verdict', 'heads_up']),
);

export function isSkillTestable(id: SkillTemplateId): boolean {
  return TESTABLE_SKILL_IDS.has(id);
}

export function isSkillTemplateId(value: unknown): value is SkillTemplateId {
  return (
    typeof value === 'string' &&
    (SKILL_TEMPLATE_IDS as readonly string[]).includes(value)
  );
}

export function getSkillTemplate(id: SkillTemplateId): SkillTemplate {
  return TEMPLATE_BY_ID[id];
}

export function isSafetyCrossSkill(
  template: SkillTemplate,
): template is Extract<SkillTemplate, { shape: SafetyCrossShape }> {
  return (
    template.kind === 'execute' && template.shape.trigger === 'safety_cross'
  );
}

export function isPriceCrossSkill(
  template: SkillTemplate,
): template is Extract<SkillTemplate, { shape: PriceCrossShape }> {
  return (
    template.kind === 'execute' && template.shape.trigger === 'price_cross'
  );
}

/** Base58 body of a plausible Solana public key (32–44 chars, no 0/O/I/l). */
const MINT_LIKE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function findSkillTemplatePick(template: SkillTemplate): string | null {
  if (template.slots.token !== null) return 'slots.token';
  const visit = (value: unknown, path: string): string | null => {
    if (typeof value === 'string') return MINT_LIKE.test(value) ? path : null;
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        const hit = visit(value[index], `${path}[${index}]`);
        if (hit) return hit;
      }
      return null;
    }
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        const hit = visit(child, path ? `${path}.${key}` : key);
        if (hit) return hit;
      }
    }
    return null;
  };
  return visit(template, '');
}

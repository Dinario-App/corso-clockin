import { copy } from '@/constants/copy';
import { fromBaseUnits, type SkillMandateDraft } from './configureDraft';
import type { SimulateOutcome, SimulateResult } from './simulateClient';
import {
  FIRST_PARTY_SKILLS,
  isSafetyCrossSkill,
  isSkillTestable,
  type SkillKind,
  type SkillTemplate,
} from './skillTemplate';

export type SkillCard = {
  id: SkillTemplate['id'];
  kind: SkillKind;
  kindLabel: string;
  categoryLabel: string;
  name: string;
  what: string;
};

export function buildSkillCards(
  templates: ReadonlyArray<SkillTemplate> = FIRST_PARTY_SKILLS,
): SkillCard[] {
  return templates.map((template) => {
    const text = copy.skills.template[template.id];
    return {
      id: template.id,
      kind: template.kind,
      kindLabel: copy.skills.kind[template.kind],
      categoryLabel: copy.skills.category[template.category],
      name: text.name,
      what: text.what,
    };
  });
}

export type SkillPreview = {
  id: SkillTemplate['id'];
  kind: SkillKind;
  name: string;
  kindLabel: string;
  categoryLabel: string;
  whatHeading: string;
  what: string;
  neverHeading: string;
  softwarePolicyNote: string | null;
  never: readonly string[];
  testHeading: string;
  testable: boolean;
  testOn: string;
  testCta: string;
  testUnavailable: string;
  /** Only analytics skills retain the add action after autopilot retirement. */
  addCta: string | null;
  addedBody: string | null;
};

export function buildSkillPreview(template: SkillTemplate): SkillPreview {
  const text = copy.skills.template[template.id];
  return {
    id: template.id,
    kind: template.kind,
    name: text.name,
    kindLabel: copy.skills.kind[template.kind],
    categoryLabel: copy.skills.category[template.category],
    whatHeading: copy.skills.preview.whatItDoes,
    what: text.what,
    neverHeading: copy.skills.preview.whatItNeverDoes,
    softwarePolicyNote: template.kind === 'execute' ? copy.skills.preview.softwarePolicyNote : null,
    never: text.never,
    testHeading: copy.skills.preview.testHeading,
    testable: isSkillTestable(template.id),
    testOn: copy.skills.preview.testOn,
    testCta: copy.skills.preview.testCta,
    testUnavailable: copy.skills.preview.testNotInBuild,
    addCta:
      template.kind === 'execute'
        ? null
        : copy.skills.preview.addAnalytics,
    addedBody:
      template.kind === 'analytics'
        ? copy.skills.preview.addedAnalyticsBody
        : null,
  };
}

export type TestReadout = {
  title: string;
  /** Primary lines, in paint order. */
  lines: string[];
  /** Muted honesty / attribution lines, in paint order. */
  notes: string[];
  /**
   * `ink` is the resting readout. `danger` paints the sand safety hue when
   * the data is thin or the verdict raises flags — the one functional accent
   * this lane may use (START-HERE: no teal, no decorative color).
   */
  tone: 'ink' | 'danger';
};

/**
 * The readout the preview screen may paint, bound to the template family.
 * An analytics skill (The Verdict, Heads-Up) never receives an execute
 * result, so execute-only fields (fires, estimated slippage) cannot reach
 * the screen even if the simulate body claimed them. Returns null on any
 * failure or family mismatch; the caller paints nothing.
 */
export function selectTestReadout(
  template: SkillTemplate,
  outcome: SimulateOutcome,
): TestReadout | null {
  if (!outcome.ok) return null;
  const expected =
    template.id === 'heads_up'
      ? 'confluence'
      : isSafetyCrossSkill(template)
        ? 'safety'
        : template.kind;
  if (outcome.result.kind !== expected) return null;
  if (outcome.result.skillId !== template.id) return null;
  return buildTestReadout(outcome.result);
}

export function formatBpsLabel(bps: number): string {
  const percent = bps / 100;
  return `${Number.isInteger(percent) ? percent : Number(percent.toFixed(2))}%`;
}

function formatFireClock(atMs: number): string {
  const date = new Date(atMs);
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${month}/${day}`;
}

export function buildTestReadout(result: SimulateResult): TestReadout {
  const t = copy.skills.test;
  if (result.kind === 'execute') {
    const lines: string[] = [
      t.windowDays(result.windowDays),
      t.fireCount(result.fireCount),
    ];
    for (const fire of result.fires.slice(0, 5)) {
      lines.push(t.fireAt(formatFireClock(fire.atMs), `$${fire.priceUsd}`));
    }
    if (result.estSlippageBps !== null) {
      lines.push(t.estSlippage(formatBpsLabel(result.estSlippageBps)));
    }
    const notes: string[] = [copy.skills.preview.simulated];
    if (result.thinData) notes.push(t.thinData);
    notes.push(t.informationNotAdvice);
    return {
      title: t.title,
      lines,
      notes,
      tone: result.thinData ? 'danger' : 'ink',
    };
  }
  if (result.kind === 'safety') {
    const s = t.safety;
    const lines: string[] = [
      s.asOfNow,
      s.level[result.verdict],
      s.setAt(copy.skills.configure.safetyLevel[result.condition]),
      result.crossed ? s.wouldExit : s.wouldHold,
    ];
    return {
      title: t.title,
      lines,
      // No `simulated` note: this is a live read, not a replay, and the
      // honesty line says exactly that instead of borrowing the replay's.
      notes: [s.noHistory, t.informationNotAdvice],
      tone: result.crossed ? 'danger' : 'ink',
    };
  }
  if (result.kind === 'confluence') {
    return {
      title: t.title,
      lines: [
        t.confluence.timeframe(result.timeframe),
        t.confluence.side[result.side],
        t.confluence.score(result.score),
      ],
      notes: [t.informationNotAdvice],
      tone: result.side === 'bear' ? 'danger' : 'ink',
    };
  }
  const lines: string[] = [t.verdict[result.verdict]];
  for (const reading of result.readings) {
    const label = (t.reading as Record<string, string>)[reading.key];
    if (!label) continue; // unknown server key: dropped, never painted raw
    lines.push(`${label}: ${t.readingState[reading.state]}`);
  }
  return {
    title: t.title,
    lines,
    notes: [t.informationNotAdvice],
    tone:
      result.verdict === 'clear' || result.verdict === 'unknown'
        ? 'ink'
        : 'danger',
  };
}

export function describeSimulateFailure(
  outcome: Extract<SimulateOutcome, { ok: false }>,
): { text: string; retry: boolean } {
  const t = copy.skills.test;
  switch (outcome.code) {
    case 'disabled':
      return { text: t.disabled, retry: false };
    case 'unsupported_network':
      return { text: t.unsupportedNetwork, retry: false };
    case 'no_data':
      return { text: t.noData, retry: false };
    case 'invalid_request':
    case 'missing_api_url':
      return { text: t.unavailable, retry: false };
    default:
      return { text: t.unavailable, retry: true };
  }
}

export type EnvelopeRow = { label: string; value: string };

export function buildEnvelopeRows(draft: SkillMandateDraft): EnvelopeRow[] {
  const c = copy.skills.configure;
  const input = draft.action.inputSymbol;
  const decimals = draft.action.inputDecimals;
  return [
    {
      label: c.rules.trade,
      value: c.tradeLine(
        input,
        draft.action.outputSymbol,
        draft.trigger === 'safety_cross'
          ? c.safetyCondition(
              draft.condition.baselineSymbol,
              draft.condition.safety,
            )
          : c.condition(
              draft.condition.baselineSymbol,
              draft.condition.leg,
              draft.condition.pct,
            ),
      ),
    },
    {
      label: c.rules.mostPerTrade,
      value: `${fromBaseUnits(draft.caps.perFireMaxBaseUnits, decimals)} ${input}`,
    },
    {
      label: c.rules.mostPerDay,
      value: c.perDay(
        draft.caps.perDayMaxFires,
        `${fromBaseUnits(draft.caps.perDayMaxBaseUnits, decimals)} ${input}`,
      ),
    },
    {
      label: c.rules.slippageLimit,
      value: formatBpsLabel(draft.caps.minOutBps),
    },
    { label: c.rules.ends, value: c.endsIn(draft.expiry.days) },
  ];
}

export function analyticsPathStrings(): string[] {
  const out: string[] = [
    copy.skills.title,
    copy.skills.lead,
    copy.skills.browseHint,
  ];
  for (const template of FIRST_PARTY_SKILLS) {
    if (template.kind !== 'analytics') continue;
    const preview = buildSkillPreview(template);
    out.push(
      preview.name,
      preview.kindLabel,
      preview.categoryLabel,
      preview.whatHeading,
      preview.what,
      preview.neverHeading,
      preview.softwarePolicyNote ?? '',
      ...preview.never,
      preview.testHeading,
      preview.testOn,
      preview.testCta,
      preview.testUnavailable,
      ...(preview.addCta === null ? [] : [preview.addCta]),
      preview.addedBody ?? '',
    );
  }
  const t = copy.skills.test;
  out.push(
    t.title,
    ...Object.values(t.verdict),
    ...Object.values(t.reading),
    ...Object.values(t.readingState),
    t.disabled,
    t.unavailable,
    t.noData,
    t.unsupportedNetwork,
    t.retry,
    t.informationNotAdvice,
    copy.skills.preview.added,
    copy.skills.preview.pickToTest,
    copy.skills.preview.testing,
  );
  return out;
}

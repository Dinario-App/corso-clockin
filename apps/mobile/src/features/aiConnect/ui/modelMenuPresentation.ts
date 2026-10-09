import { copy } from '@/constants/copy';
import type { BrainSummary } from '../types';
import { BYO_AI_FLAGS_OFF, type ByoAiFlags } from '../flags';
import type { BrainProvider } from '../types';

/** The row that is always present, and the one Auto is checked on. */
export const MODEL_AUTO_ID = 'auto' as const;

export type ModelMenuRow = Readonly<{
  id: string;
  /** Monogram for the 30px badge well. Null on Auto, which uses the glyph. */
  badge: string | null;
  name: string;
  caption: string;
  /** The check disc: this row is where the next ask goes. */
  checked: boolean;
  accessibilityLabel: string;
}>;

export type ModelMenuGroup = Readonly<{
  label: string;
  rows: readonly ModelMenuRow[];
}>;

export type ModelMenuPresentation = Readonly<{
  auto: ModelMenuRow;
  groups: readonly ModelMenuGroup[];
  connect: Readonly<{
    label: string;
    caption: string | null;
    badges: readonly string[];
  }> | null;
  /** What the chip in the action row reads. */
  chipLabel: string;
  /**
   * The brain the next ask goes to, or null for Auto. Resolved rather than
   * echoed: a pick that names a brain this build cannot list (removed on the
   * connect screen, cut by a kill-switch, master switch off) reads as Auto
   * here, so the pane and the ask path can never disagree about where the
   * question is going.
   */
  selectedId: string | null;
}>;

const BRANDS: Readonly<
  Record<
    Exclude<BrainProvider, 'managed'>,
    { brand: string; badge: string; model: string }
  >
> = Object.freeze({
  grok: {
    brand: copy.ai.providerGrok,
    badge: 'GR',
    model: copy.ai.modelNameGrok,
  },
  xai: {
    brand: copy.ai.providerGrok,
    badge: 'GR',
    model: copy.ai.modelNameXai,
  },
  claude: {
    brand: copy.ai.providerClaude,
    badge: 'CL',
    model: copy.ai.modelNameClaude,
  },
  anthropic: {
    brand: copy.ai.providerClaude,
    badge: 'CL',
    model: copy.ai.modelNameAnthropic,
  },
  chatgpt: {
    brand: copy.ai.providerChatgpt,
    badge: 'GP',
    model: copy.ai.modelNameChatgpt,
  },
  openai: {
    brand: copy.ai.providerChatgpt,
    badge: 'GP',
    model: copy.ai.modelNameOpenai,
  },
});

/**
 * Ladder order (`index.DEFAULT_PROVIDER_ORDER`), collapsed to the three
 * brands so the pane reads in the order the pool actually asks in.
 */
const BRAND_ORDER: readonly Exclude<BrainProvider, 'managed'>[] = Object.freeze(
  ['grok', 'xai', 'claude', 'anthropic', 'chatgpt', 'openai'],
);

export function modelBrand(
  provider: Exclude<BrainProvider, 'managed'>,
): string {
  return BRANDS[provider].brand;
}

export function modelBadge(
  provider: Exclude<BrainProvider, 'managed'>,
): string {
  return BRANDS[provider].badge;
}

export function modelDisplayName(
  provider: Exclude<BrainProvider, 'managed'>,
): string {
  return BRANDS[provider].model;
}

function statusCaption(status: BrainSummary['status']): string {
  switch (status) {
    case 'ready':
      return copy.ai.statusReady;
    case 'needs_reconnect':
      return copy.ai.statusNeedsReconnect;
    case 'resting':
      return copy.ai.statusResting;
    case 'blocked':
      return copy.ai.statusBlocked;
  }
}

function autoRow(checked = true): ModelMenuRow {
  return Object.freeze({
    id: MODEL_AUTO_ID,
    badge: null,
    name: copy.ask.modelAuto,
    caption: copy.ask.modelAutoCaption,
    checked,
    accessibilityLabel: `${copy.ask.modelAuto}, ${copy.ask.modelAutoCaption}`,
  });
}

export const CONNECT_BRAND_BADGES = Object.freeze([
  BRANDS.grok.badge,
  BRANDS.claude.badge,
  BRANDS.chatgpt.badge,
]);

export function resolveModelMenuFocus(input: {
  configOk: boolean;
  flags: ByoAiFlags;
  listOk: boolean;
  brains: readonly BrainSummary[];
  previousBrains: readonly BrainSummary[];
}): { flags: ByoAiFlags; brains: readonly BrainSummary[] } {
  if (!input.configOk) {
    return { flags: BYO_AI_FLAGS_OFF, brains: [] };
  }
  if (!input.listOk) {
    return { flags: input.flags, brains: input.previousBrains };
  }
  return { flags: input.flags, brains: input.brains };
}

/**
 * The picker for an un-wired caller and for a build whose config never
 * answered: Auto alone, no door to a screen that would only say "not in this
 * build".
 */
export const MODEL_MENU_AUTO_ONLY: ModelMenuPresentation = Object.freeze({
  auto: autoRow(),
  groups: Object.freeze([]),
  connect: null,
  chipLabel: copy.ask.modelAuto,
  selectedId: null,
});

export function resolveModelMenu(input: {
  flags: ByoAiFlags;
  brains: readonly BrainSummary[];
  /** The pick from `modelSelection.ts`. Null, or anything unlistable, is Auto. */
  selectedId?: string | null;
}): ModelMenuPresentation {
  if (!input.flags.byoAiEnabled) return MODEL_MENU_AUTO_ONLY;

  // A pick only counts while the brain it names is still listed here.
  const picked =
    input.selectedId && input.selectedId !== MODEL_AUTO_ID
      ? (input.brains.find(
          (brain) =>
            brain.id === input.selectedId &&
            brain.kind !== 'managed' &&
            brain.provider in BRANDS,
        ) ?? null)
      : null;
  const selectedId = picked?.id ?? null;

  const byProvider = new Map<
    Exclude<BrainProvider, 'managed'>,
    ModelMenuRow[]
  >();
  for (const brain of input.brains) {
    if (brain.kind === 'managed') continue;
    const provider = brain.provider as Exclude<BrainProvider, 'managed'>;
    if (!(provider in BRANDS)) continue;
    const name = BRANDS[provider].model;
    const caption = statusCaption(brain.status);
    const rows = byProvider.get(provider) ?? [];
    rows.push(
      Object.freeze({
        id: brain.id,
        badge: BRANDS[provider].badge,
        name,
        caption,
        checked: brain.id === selectedId,
        accessibilityLabel: copy.ask.modelConnectedA11y(name, caption),
      }),
    );
    byProvider.set(provider, rows);
  }

  const groups: ModelMenuGroup[] = [];
  const seenBrand = new Set<string>();
  for (const provider of BRAND_ORDER) {
    const brand = BRANDS[provider].brand;
    if (seenBrand.has(brand)) continue;
    const rows = BRAND_ORDER.filter((p) => BRANDS[p].brand === brand).flatMap(
      (p) => byProvider.get(p) ?? [],
    );
    if (rows.length === 0) continue;
    seenBrand.add(brand);
    groups.push(
      Object.freeze({
        label: copy.ask.modelGroupConnected(brand),
        rows: Object.freeze(rows),
      }),
    );
  }

  return Object.freeze({
    auto: autoRow(selectedId === null),
    groups: Object.freeze(groups),
    connect: Object.freeze({
      label: copy.ask.modelConnect,
      caption:
        groups.length === 0 ? copy.ask.modelConnectCaption : null,
      badges: CONNECT_BRAND_BADGES,
    }),
    chipLabel: picked
      ? BRANDS[picked.provider as Exclude<BrainProvider, 'managed'>].brand
      : copy.ask.modelAuto,
    selectedId,
  });
}

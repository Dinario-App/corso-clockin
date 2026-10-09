import type { CorsoIconName } from '@/src/ui/icons/corsoIconNames';
import {
  GRABBER_HEIGHT,
  GRABBER_WIDTH,
} from '@/src/ui/primitives/grabberPresentation';
import { COMPOSER_REST_HEIGHT } from './composerPresentation';

export const QUICK_ACTION_HEIGHT = 55;
export const QUICK_ACTION_RADIUS = 16;
export const QUICK_ACTION_GAP = 9;
export const QUICK_ACTION_LABEL = { fontSize: 17, fontWeight: '500' } as const;
export const QUICK_ACTION_ICON = 22;
export const QUICK_ACTION_CHIP_PADDING_HORIZONTAL = 16;
export const QUICK_ACTION_ROW_PADDING_VERTICAL = 10;
export const QUICK_ACTION_ROW_PADDING_HORIZONTAL = 2;
export const QUICK_ACTION_RAIL_HEIGHT =
  QUICK_ACTION_HEIGHT + QUICK_ACTION_ROW_PADDING_VERTICAL * 2;

export const COMPOSER_GRABBER_ROW_HEIGHT = 16;
export const COMPOSER_GRABBER_HIT_TARGET = 44;
export const COMPOSER_GRABBER_HIT_SLOP =
  (COMPOSER_GRABBER_HIT_TARGET - COMPOSER_GRABBER_ROW_HEIGHT) / 2;
export const COMPOSER_GRABBER_WIDTH = GRABBER_WIDTH;
export const COMPOSER_GRABBER_DASH_HEIGHT = GRABBER_HEIGHT;

export function resolveQuickActionRailShown(input: {
  replyOnScreen: boolean;
}): boolean {
  return input.replyOnScreen !== true;
}

/**
 * The dock's own stack, without Home's canvas pad or tab-bar inset. After a
 * reply, with the bar yielded: 16 + 96. Empty Home: 75 + 96, no grabber.
 */
export function resolveComposerThreadDockHeight(input: {
  railShown: boolean;
  grabberShown: boolean;
}): number {
  return (
    COMPOSER_REST_HEIGHT +
    (input.grabberShown ? COMPOSER_GRABBER_ROW_HEIGHT : 0) +
    (input.railShown ? QUICK_ACTION_RAIL_HEIGHT : 0)
  );
}

export const QUICK_ACTION_ROW_FADE_START = 0.88;
/** How wide the fade is allowed to be at the row's right edge, in dp. */
export const QUICK_ACTION_ROW_FADE_WIDTH = 44;

export type QuickActionKind = 'fill' | 'route';

export type QuickAction = {
  readonly id: 'skills' | 'check-token' | 'swap' | 'moving' | 'set-rule';
  readonly kind: QuickActionKind;
  readonly glyph: CorsoIconName;
  readonly label: string;
  /** The text a `fill` chip writes into the field. `null` for `route`. */
  readonly fill: string | null;
  readonly accessibilityLabel: string;
  readonly accessibilityHint: string | null;
};

export type QuickActionCopy = {
  groupA11y: string;
  skills: string;
  skillsA11y: string;
  checkToken: string;
  checkTokenFill: string;
  swap: string;
  swapFill: string;
  moving: string;
  movingFill: string;
  setRule: string;
  setRuleFill: string;
  fillHint: string;
};

export function resolveQuickActions(input: {
  copy: QuickActionCopy;
  /** The Skills marketplace door. Absent → the Skills chip is not rendered. */
  canOpenSkills: boolean;
  /**
   * The rules/bots lane is served and reachable. Fail-closed: `false` and
   * `undefined` both drop the "Set a rule" chip.
   */
  canSetRules?: boolean;
}): readonly QuickAction[] {
  const { copy } = input;
  const setRule: readonly QuickAction[] =
    input.canSetRules === true
      ? [
          {
            id: 'set-rule',
            kind: 'fill',
            glyph: 'rule',
            label: copy.setRule,
            fill: copy.setRuleFill,
            accessibilityLabel: copy.setRule,
            accessibilityHint: copy.fillHint,
          },
        ]
      : [];
  const fills: readonly QuickAction[] = [
    {
      id: 'check-token',
      kind: 'fill',
      glyph: 'search',
      label: copy.checkToken,
      fill: copy.checkTokenFill,
      accessibilityLabel: copy.checkToken,
      accessibilityHint: copy.fillHint,
    },
    {
      id: 'swap',
      kind: 'fill',
      glyph: 'swap',
      label: copy.swap,
      fill: copy.swapFill,
      accessibilityLabel: copy.swap,
      accessibilityHint: copy.fillHint,
    },
    {
      id: 'moving',
      kind: 'fill',
      glyph: 'trend',
      label: copy.moving,
      fill: copy.movingFill,
      accessibilityLabel: copy.moving,
      accessibilityHint: copy.fillHint,
    },
    ...setRule,
  ];

  if (!input.canOpenSkills) return fills;

  return [
    {
      id: 'skills',
      kind: 'route',
      glyph: 'sparkle',
      label: copy.skills,
      fill: null,
      accessibilityLabel: copy.skillsA11y,
      accessibilityHint: null,
    },
    ...fills,
  ];
}

export type QuickActionInk = {
  /** Box label colour. */
  label: string;
  /** Leading glyph colour. */
  glyph: string;
};

export function resolveQuickActionInk(input: { ink: string }): QuickActionInk {
  return { label: input.ink, glyph: input.ink };
}

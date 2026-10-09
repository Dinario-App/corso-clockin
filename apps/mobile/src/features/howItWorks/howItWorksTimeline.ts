import { PRICE_CHART_FIRST_DRAW_MS } from '@/src/ui/charts/priceChartPresentation';
import { SEED_RISE_MS } from '@/src/ui/home/genUiMotion';
import {
  resolveChipDelayMs,
  resolveVerdictAssembly,
} from '@/src/ui/verdict/verdictCardPresentation';
import {
  HOW_IT_WORKS_CTA_FADE_MS,
  HOW_IT_WORKS_PAGE_SLIDE_MS,
  type HowItWorksBeatId,
} from './howItWorksPresentation';

export const HOW_IT_WORKS_HEADLINE_AT_MS = 0;
export const HOW_IT_WORKS_BODY_AT_MS = 120;
export const HOW_IT_WORKS_SCENE_AT_MS = 240;
/** The ease-out opacity reveal of the headline, the body and the scene. */
export const HOW_IT_WORKS_REVEAL_MS = 360;
/** Every scene completes within this long of its own start. */
export const HOW_IT_WORKS_SCENE_BUDGET_MS = 1600;
/** The whole intro, watched through with a Next tap as each beat lands. */
export const HOW_IT_WORKS_WATCHED_BUDGET_MS = 12_000;
/** Things that rise in (a card, a bubble) travel this far. */
export const HOW_IT_WORKS_RISE_PX = 12;

/* Scene-relative offsets (counted from HOW_IT_WORKS_SCENE_AT_MS). */

/** Beat 1: the first letter lands here, then one letter per step. */
export const HOW_IT_WORKS_TYPE_START_MS = 160;
export const HOW_IT_WORKS_TYPE_STEP_MS = 70;
/** Beat 2: the verdict card mounts under the echoed ask. */
export const HOW_IT_WORKS_CARD_AT_MS = 160;
/** Beat 2: the chart seed enters and draws the white line. */
export const HOW_IT_WORKS_SEED_AT_MS = 900;
/** Beat 3: the slide-to-sign pill rises under the review card. */
export const HOW_IT_WORKS_PILL_AT_MS = 240;
export const HOW_IT_WORKS_MENU_AT_MS = 200;
/**
 * Reanimated's perceptual spring duration. With a damping ratio under 1 the
 * spring overshoots once and settles by here; the rest of Reanimated's tail
 * (it runs 1.5× the perceptual duration) is sub-pixel.
 */
export const HOW_IT_WORKS_SPRING_MS = 530;
export const HOW_IT_WORKS_SPRING_DAMPING = 0.72;

/** The last beat's CTA fades in with its scene and arms when it is drawn. */
export const HOW_IT_WORKS_CTA_AT_MS = HOW_IT_WORKS_SCENE_AT_MS;
export const HOW_IT_WORKS_CTA_ARM_MS =
  HOW_IT_WORKS_CTA_AT_MS + HOW_IT_WORKS_CTA_FADE_MS;

export type HowItWorksCueKind =
  | 'fade'
  | 'rise'
  | 'spring'
  | 'type'
  | 'mount'
  | 'arm'
  | 'owned';

export type HowItWorksCueId =
  | 'headline'
  | 'body'
  | 'scene'
  | 'cta'
  | 'ctaArm'
  | 'composer'
  | 'type'
  | 'echo'
  | 'card'
  | 'row'
  | 'seed'
  | 'line'
  | 'review'
  | 'pill'
  | 'rule'
  | 'menu';

export type HowItWorksCue = Readonly<{
  id: HowItWorksCueId;
  kind: HowItWorksCueKind;
  /** Beat-relative start. */
  atMs: number;
  durationMs: number;
  /** Letter, row or monogram index for the repeated cues. */
  index?: number;
}>;

export type HowItWorksBeatTimeline = Readonly<{
  beat: HowItWorksBeatId;
  cues: readonly HowItWorksCue[];
  /** When the last scene cue has finished, beat-relative. */
  sceneCompleteAtMs: number;
  /** When everything on the page (the CTA included) has finished. */
  completeAtMs: number;
  ctaArmAtMs: number | null;
}>;

export type HowItWorksTimelineInput = Readonly<{
  beat: HowItWorksBeatId;
  isLast: boolean;
  reduceMotion: boolean;
  /** Beat 1: letters in the scripted ask. */
  typedLength: number;
  evidenceCount: number;
}>;

const SCENE = HOW_IT_WORKS_SCENE_AT_MS;

function cue(
  id: HowItWorksCueId,
  kind: HowItWorksCueKind,
  atMs: number,
  durationMs: number,
  index?: number,
): HowItWorksCue {
  return Object.freeze(index === undefined ? { id, kind, atMs, durationMs } : { id, kind, atMs, durationMs, index });
}

function sceneCues(input: HowItWorksTimelineInput): HowItWorksCue[] {
  switch (input.beat) {
    case 'ask': {
      const cues = [cue('composer', 'rise', SCENE, HOW_IT_WORKS_REVEAL_MS)];
      for (let i = 0; i < input.typedLength; i += 1) {
        cues.push(
          cue(
            'type',
            'type',
            SCENE + HOW_IT_WORKS_TYPE_START_MS + i * HOW_IT_WORKS_TYPE_STEP_MS,
            0,
            i,
          ),
        );
      }
      return cues;
    }
    case 'verdict': {
      const plan = resolveVerdictAssembly({ reduceMotion: false });
      const cardAt = SCENE + HOW_IT_WORKS_CARD_AT_MS;
      const seedAt = SCENE + HOW_IT_WORKS_SEED_AT_MS;
      const cues = [
        cue('echo', 'rise', SCENE, HOW_IT_WORKS_REVEAL_MS),
        cue('card', 'mount', cardAt, 0),
      ];
      for (let i = 0; i < input.evidenceCount; i += 1) {
        cues.push(
          cue('row', 'owned', cardAt + resolveChipDelayMs(i, plan), plan.stepDurationMs, i),
        );
      }
      cues.push(cue('seed', 'mount', seedAt, 0));
      cues.push(cue('seed', 'owned', seedAt, SEED_RISE_MS));
      cues.push(cue('line', 'owned', seedAt, PRICE_CHART_FIRST_DRAW_MS));
      return cues;
    }
    case 'sign':
      return [
        cue('review', 'rise', SCENE, HOW_IT_WORKS_REVEAL_MS),
        cue('pill', 'rise', SCENE + HOW_IT_WORKS_PILL_AT_MS, HOW_IT_WORKS_REVEAL_MS),
      ];
    case 'bots':
      return [cue('rule', 'rise', SCENE, HOW_IT_WORKS_REVEAL_MS)];
    case 'ai':
      return [
        cue('composer', 'rise', SCENE, HOW_IT_WORKS_REVEAL_MS),
        cue('menu', 'spring', SCENE + HOW_IT_WORKS_MENU_AT_MS, HOW_IT_WORKS_SPRING_MS),
      ];
  }
}

const end = (c: HowItWorksCue) => c.atMs + c.durationMs;

/**
 * One beat's authored timeline. Reduce Motion is the final state: every cue
 * lands at 0 with no duration, so the page mounts resolved and the last
 * beat's CTA is armed on the first frame.
 */
export function resolveHowItWorksBeatTimeline(
  input: HowItWorksTimelineInput,
): HowItWorksBeatTimeline {
  const scene = sceneCues(input);
  const cues: HowItWorksCue[] = [
    cue('headline', 'fade', HOW_IT_WORKS_HEADLINE_AT_MS, HOW_IT_WORKS_REVEAL_MS),
    cue('body', 'fade', HOW_IT_WORKS_BODY_AT_MS, HOW_IT_WORKS_REVEAL_MS),
    cue('scene', 'fade', SCENE, HOW_IT_WORKS_REVEAL_MS),
    ...scene,
  ];
  if (input.isLast) {
    cues.push(cue('cta', 'fade', HOW_IT_WORKS_CTA_AT_MS, HOW_IT_WORKS_CTA_FADE_MS));
    cues.push(cue('ctaArm', 'arm', HOW_IT_WORKS_CTA_ARM_MS, 0));
  }

  if (input.reduceMotion) {
    return Object.freeze({
      beat: input.beat,
      cues: Object.freeze(cues.map((c) => Object.freeze({ ...c, atMs: 0, durationMs: 0 }))),
      sceneCompleteAtMs: 0,
      completeAtMs: 0,
      ctaArmAtMs: input.isLast ? 0 : null,
    });
  }

  const sceneCompleteAtMs = Math.max(
    SCENE + HOW_IT_WORKS_REVEAL_MS,
    ...scene.map(end),
  );
  return Object.freeze({
    beat: input.beat,
    cues: Object.freeze(cues),
    sceneCompleteAtMs,
    completeAtMs: Math.max(...cues.map(end)),
    ctaArmAtMs: input.isLast ? HOW_IT_WORKS_CTA_ARM_MS : null,
  });
}

/**
 * The intro watched through: each beat plays to completion, then Next slides
 * the following page in. The first page has no slide.
 */
export function resolveHowItWorksWatchedMs(
  timelines: readonly HowItWorksBeatTimeline[],
): number {
  const beats = timelines.reduce((sum, t) => sum + t.completeAtMs, 0);
  return beats + Math.max(0, timelines.length - 1) * HOW_IT_WORKS_PAGE_SLIDE_MS;
}

export type HowItWorksClock = Readonly<{
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}>;

const GLOBAL_CLOCK: HowItWorksClock = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (handle) =>
    globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * Fires every cue the intro drives at its beat-relative time. A cue at 0 fires
 * synchronously, so the Reduce Motion final state is on the first frame.
 * `owned` cues are the real components' own clocks and are never fired here.
 * Returns the cancel for a page change or an unmount.
 */
export function scheduleHowItWorksCues(
  cues: readonly HowItWorksCue[],
  onCue: (cue: HowItWorksCue) => void,
  clock: HowItWorksClock = GLOBAL_CLOCK,
): () => void {
  const handles: unknown[] = [];
  let cancelled = false;
  for (const c of cues) {
    if (c.kind === 'owned') continue;
    if (c.atMs <= 0) {
      onCue(c);
      continue;
    }
    handles.push(
      clock.setTimeout(() => {
        if (!cancelled) onCue(c);
      }, c.atMs),
    );
  }
  return () => {
    cancelled = true;
    for (const handle of handles) clock.clearTimeout(handle);
  };
}

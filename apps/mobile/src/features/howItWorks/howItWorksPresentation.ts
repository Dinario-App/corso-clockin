import { howItWorksCopy } from '@/constants/copy/howItWorks';
import { SCROLL_FADE_BOTTOM } from '@/src/ui/primitives/scrollEdgeFadePresentation';

export const HOW_IT_WORKS_HREF = '/(auth)/how-it-works' as const;
export const HOME_HREF = '/(app)' as const;
export const CONNECT_AI_HREF = '/profile/ai' as const;

export const HOW_IT_WORKS_PAGE_SLIDE_MS = 267;
export const HOW_IT_WORKS_CTA_FADE_MS = 600;

export type HowItWorksFlagInput = Readonly<{
  botsEnabled: boolean;
  byoAiEnabled: boolean;
  chatgptEnabled: boolean;
  grokEnabled: boolean;
}>;

export const HOW_IT_WORKS_BEAT_IDS = [
  'ask',
  'verdict',
  'sign',
  'bots',
  'ai',
] as const;
export type HowItWorksBeatId = (typeof HOW_IT_WORKS_BEAT_IDS)[number];

export type HowItWorksBeat = Readonly<{
  id: HowItWorksBeatId;
  headline: string;
  body: string;
}>;

export type HowItWorksLeave = 'skip' | 'start-asking' | 'connect-ai';

export type HowItWorksPage = Readonly<{
  index: number;
  beat: HowItWorksBeat;
  isFirst: boolean;
  isLast: boolean;
  showSkip: boolean;
  showNext: boolean;
  showStartAsking: boolean;
  showConnectAi: boolean;
  dotCount: number;
}>;

export type HowItWorksMotion = Readonly<{
  pageDurationMs: number;
  ctaArmed: boolean;
  contentOpacity: number;
}>;

export function resolveHowItWorksAiBody(flags: {
  chatgptEnabled: boolean;
  grokEnabled: boolean;
}): string {
  const bodies = howItWorksCopy.beats.ai.body;
  if (flags.chatgptEnabled && flags.grokEnabled) {
    return bodies.signInChatgptAndGrok;
  }
  if (flags.chatgptEnabled) return bodies.signInChatgpt;
  if (flags.grokEnabled) return bodies.signInGrok;
  return bodies.keysOnly;
}

export function resolveHowItWorksBeats(
  flags: HowItWorksFlagInput,
): HowItWorksBeat[] {
  const beats: HowItWorksBeat[] = [
    {
      id: 'ask',
      headline: howItWorksCopy.beats.ask.headline,
      body: howItWorksCopy.beats.ask.body,
    },
    {
      id: 'verdict',
      headline: howItWorksCopy.beats.verdict.headline,
      body: howItWorksCopy.beats.verdict.body,
    },
    {
      id: 'sign',
      headline: howItWorksCopy.beats.sign.headline,
      body: howItWorksCopy.beats.sign.body,
    },
  ];
  if (flags.botsEnabled) {
    beats.push({
      id: 'bots',
      headline: howItWorksCopy.beats.bots.headline,
      body: howItWorksCopy.beats.bots.body,
    });
  }
  if (flags.byoAiEnabled) {
    beats.push({
      id: 'ai',
      headline: howItWorksCopy.beats.ai.headline,
      body: resolveHowItWorksAiBody(flags),
    });
  }
  return beats;
}

export function resolveHowItWorksPage(input: {
  index: number;
  beats: readonly HowItWorksBeat[];
}): HowItWorksPage {
  const count = Math.max(input.beats.length, 1);
  const index = Math.min(Math.max(input.index, 0), count - 1);
  const beat = input.beats[index] ?? input.beats[0];
  if (!beat) {
    throw new Error('How Corso works needs at least one beat');
  }
  const isLast = index === count - 1;
  return {
    index,
    beat,
    isFirst: index === 0,
    isLast,
    showSkip: !isLast,
    showNext: !isLast,
    showStartAsking: isLast,
    showConnectAi: isLast && beat.id === 'ai',
    dotCount: count,
  };
}

export function stepHowItWorksPage(
  index: number,
  count: number,
  delta: number,
): number {
  const last = Math.max(count - 1, 0);
  return Math.min(Math.max(index + delta, 0), last);
}

export function resolveFirstRunExit(
  seen: boolean,
): typeof HOW_IT_WORKS_HREF | typeof HOME_HREF {
  return seen ? HOME_HREF : HOW_IT_WORKS_HREF;
}

export function resolveUnlockExit(): typeof HOME_HREF {
  return HOME_HREF;
}

export function resolveHowItWorksLeave(
  choice: HowItWorksLeave,
): typeof HOME_HREF | typeof CONNECT_AI_HREF {
  return choice === 'connect-ai' ? CONNECT_AI_HREF : HOME_HREF;
}

export function resolveHowItWorksMotion(input: {
  reduceMotion: boolean;
  isLastBeat: boolean;
  ctaCueArmed: boolean;
}): HowItWorksMotion {
  if (input.reduceMotion) {
    return {
      pageDurationMs: 0,
      ctaArmed: input.isLastBeat,
      contentOpacity: 1,
    };
  }
  return {
    pageDurationMs: HOW_IT_WORKS_PAGE_SLIDE_MS,
    ctaArmed: input.isLastBeat && input.ctaCueArmed,
    contentOpacity: 1,
  };
}

/* ─── The page's scroll edge ─────────────────────────────────────────────── */

export function resolveHowItWorksPageFadeBottom(input: {
  contentHeight: number;
  viewportHeight: number;
  scrollY: number;
}): number {
  const { contentHeight, viewportHeight, scrollY } = input;
  if (!Number.isFinite(contentHeight) || !Number.isFinite(viewportHeight))
    return 0;
  if (viewportHeight <= 0) return 0;
  const offset = Number.isFinite(scrollY) && scrollY > 0 ? scrollY : 0;
  // One point of slack: Yoga rounds each box to the pixel grid.
  return contentHeight - viewportHeight - offset > 1 ? SCROLL_FADE_BOTTOM : 0;
}

export const HOW_IT_WORKS_REPLAY_PARAM = 'replay' as const;

export function howItWorksReplayHref() {
  return {
    pathname: HOW_IT_WORKS_HREF,
    params: { [HOW_IT_WORKS_REPLAY_PARAM]: '1' },
  } as const;
}

export function parseHowItWorksReplay(
  value: string | readonly string[] | undefined,
): boolean {
  const first = Array.isArray(value) ? value[0] : value;
  return first === '1';
}

export type HowItWorksExit =
  | Readonly<{ kind: 'back' }>
  | Readonly<{
      kind: 'replace';
      href: typeof HOME_HREF | typeof CONNECT_AI_HREF;
    }>;

export function resolveHowItWorksExit(input: {
  choice: HowItWorksLeave;
  replay: boolean;
}): HowItWorksExit {
  if (input.replay) return { kind: 'back' };
  return { kind: 'replace', href: resolveHowItWorksLeave(input.choice) };
}

/** A replay leaves the first-run flag as it found it. */
export function shouldMarkHowItWorksSeen(replay: boolean): boolean {
  return !replay;
}

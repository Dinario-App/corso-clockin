export const BOT_DOT_TONES = ['live', 'revoking', 'paused', 'off'] as const;
export type BotDotTone = (typeof BOT_DOT_TONES)[number];

export const BOT_DOT_DIM_OPACITY = 0.35;

export const BOT_DOT_HALF_CYCLE_MS: Readonly<
  Record<'live' | 'revoking', number>
> = { live: 1100, revoking: 450 };

export type BotLiveDotPresentation = {
  enabled: boolean;
  /** Where the dot sits when it is not animating. */
  restOpacity: number;
  dimOpacity: number;
  halfCycleMs: number;
};

export function resolveLiveDot(input: {
  tone: BotDotTone;
  reduceMotion: boolean;
}): BotLiveDotPresentation {
  const animated = input.tone === 'live' || input.tone === 'revoking';
  const restOpacity = animated ? 1 : BOT_DOT_DIM_OPACITY;
  if (input.tone === 'paused' || input.tone === 'off' || input.reduceMotion) {
    return {
      enabled: false,
      restOpacity,
      dimOpacity: BOT_DOT_DIM_OPACITY,
      halfCycleMs: 0,
    };
  }
  return {
    enabled: true,
    restOpacity,
    dimOpacity: BOT_DOT_DIM_OPACITY,
    halfCycleMs: BOT_DOT_HALF_CYCLE_MS[input.tone],
  };
}

/** The card's status → the dot's tone. One place, so no surface invents a fifth. */
export function dotToneFor(status: string): BotDotTone {
  if (status === 'live' || status === 'firing' || status === 'setting_up')
    return 'live';
  if (status === 'revoking') return 'revoking';
  if (status === 'paused') return 'paused';
  return 'off';
}

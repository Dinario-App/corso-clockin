/** Phase 4: the seed enters no earlier than this long after the CTA arms. */
export const SEED_AFTER_CTA_ARM_MS = 150;

/** Phase 4: the seed card rises 12 dp and fades in over 320 ms. */
export const SEED_RISE_PX = 12;
export const SEED_RISE_MS = 320;

export const SEED_GROW_AFTER_ENTRY_MS = 850;

export const SEED_GROW_MS = 620;
/** Phase 4b: the foot line (*Low · High* · *Source · as-of*) fades in. */
export const SEED_FOOT_FADE_MS = 400;

/** Phase 9: the previous answer's chart folds back to the 110 dp seed. */
export const SEED_FOLD_BACK_MS = 240;

export const SETTLE_SCROLL_MS = 280;

export const SEED_MIN_PEEK_DP = 24;

export const GEN_UI_EASING = Object.freeze([0.3, 0.8, 0.3, 1] as const);

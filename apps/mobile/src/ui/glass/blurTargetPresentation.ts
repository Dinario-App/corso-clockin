export type BlurTargetLayers = {
  /** Mount a `BlurTargetView` at all. False when there is nothing to sample. */
  readonly mountsTarget: boolean;
  /** Hand the ref to the panes layer, which is drawn over the target. */
  readonly panesGetTarget: boolean;
  /**
   * The snapshot layer's own subtree. Always `false`: a `Material` in here
   * would be the descendant BlurView that closes the cycle, so it takes the
   * opaque tonal composite instead.
   */
  readonly backdropGetsTarget: false;
};

/**
 * A backdrop is anything React will actually render. `undefined`, `null` and
 * `false` are the three ways a caller says "no snapshot layer" — including the
 * `{cond && <X/>}` idiom — and they all mean the same thing: nothing to sample.
 */
export function hasMaterialBackdrop(backdrop: unknown): boolean {
  return backdrop !== undefined && backdrop !== null && backdrop !== false;
}

export function resolveBlurTargetLayers(input: {
  hasBackdrop: boolean;
}): BlurTargetLayers {
  return {
    mountsTarget: input.hasBackdrop,
    panesGetTarget: input.hasBackdrop,
    backdropGetsTarget: false,
  };
}

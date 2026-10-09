import { createContext, type RefObject } from 'react';

/** What a fade needs from the ground's host view, and nothing else. */
export type LitGroundHost = {
  measure: (
    callback: (
      x: number,
      y: number,
      width: number,
      height: number,
      pageX: number,
      pageY: number,
    ) => void,
  ) => void;
};

export type LitGround = {
  /**
   * The colour a fade passes to say "I dissolve into this ground". A fade in
   * any other colour is on some other surface and is left exactly as it was.
   */
  dissolveColor: string;
  /**
   * The ground's colour at (x, y) of its `width` x `height` box, as a colour
   * string at `alpha`; `null` if the ground cannot say. The ground computes it
   * from its own tokens: nothing outside a token file writes a colour.
   */
  colorAt: (
    x: number,
    y: number,
    width: number,
    height: number,
    alpha: number,
  ) => string | null;
  /** The view those gradients fill. */
  hostRef: RefObject<LitGroundHost | null>;
  /**
   * False on the ground's first render, when `hostRef` is still empty: a ref
   * is attached after the layout effects of everything inside it. The ground
   * flips this once attached, which renders every fade inside it again.
   */
  attached: boolean;
};

export const LitGroundContext = createContext<LitGround | null>(null);

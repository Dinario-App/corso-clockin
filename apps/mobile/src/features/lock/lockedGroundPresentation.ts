import { PARI_MARK_INK } from '@/src/ui/brand/pariMarkSource';

/** The native splash's `imageWidth`: a 288dp/pt square on both platforms. */
export const LOCKED_GROUND_MARK_SIZE = 288;

/** Mobile-root-relative path of the native splash image. */
export const NATIVE_SPLASH_ASSET = 'assets/brand/pari-chrome/pari-splash.png';

export const PARI_SPLASH_INK_DP = 135;

export const LOCKED_GROUND_PARI_BOX =
  PARI_SPLASH_INK_DP / ((PARI_MARK_INK.right - PARI_MARK_INK.left) / 100);

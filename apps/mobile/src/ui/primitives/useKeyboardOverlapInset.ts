import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, type KeyboardEvent, Platform } from 'react-native';
import {
  keyboardInsetEventNames,
  resolveKeyboardOverlapInset,
} from '@/src/ui/primitives/keyboardAvoidancePresentation';

/**
 * The IME overlap, in dp, for a bottom-anchored sheet whose window does not
 * shrink. `0` while the keyboard is closed, so a resting sheet does not move.
 * Subscribes only when `Keyboard.addListener` exists, so a render seam without
 * a keyboard leaves the inset at 0.
 */
export function useKeyboardOverlapInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    if (typeof Keyboard?.addListener !== 'function') return;
    const names = keyboardInsetEventNames(Platform?.OS);
    const onShow = (event: KeyboardEvent) => {
      const height = readWindowHeight();
      setInset(
        resolveKeyboardOverlapInset({
          windowHeight: height,
          keyboardHeight: event?.endCoordinates?.height ?? 0,
          keyboardScreenY: event?.endCoordinates?.screenY ?? Number.NaN,
        }),
      );
    };
    const onHide = () => setInset(0);
    const showSub = Keyboard.addListener(names.show, onShow);
    const hideSub = Keyboard.addListener(names.hide, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  return inset;
}

function readWindowHeight(): number {
  if (typeof Dimensions?.get !== 'function') return 0;
  try {
    const height = Dimensions.get('window')?.height;
    return typeof height === 'number' && Number.isFinite(height) ? height : 0;
  } catch {
    return 0;
  }
}

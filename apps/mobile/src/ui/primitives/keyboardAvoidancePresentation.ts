/**
 * Keyboard avoidance is not an iOS-only concern.
 *
 * Under Android edge-to-edge (SDK 57) the app window keeps its full height and
 * the IME is drawn on top of it, so `adjustResize` cannot be relied on to lift a
 * focused field. Handing `KeyboardAvoidingView` an `undefined` behavior on
 * Android is the same assumption as "Android will resize", and it puts the Ask
 * field, the OTP field and the recovery grid under the keyboard.
 *
 * `padding` is correct on both platforms and is self-correcting: the avoiding
 * view's own layout is measured against the reported keyboard frame, so if a
 * window ever does resize the resolved inset collapses to zero on its own.
 */
export type KeyboardAvoidanceBehavior = 'padding' | 'height' | 'position';

export function resolveKeyboardAvoidanceBehavior(
  platformOS: unknown,
): KeyboardAvoidanceBehavior {
  return platformOS === 'web' ? 'height' : 'padding';
}

/**
 * Show/hide events for the inset hook. iOS reports the frame before the
 * animation; Android reports it once the IME is up. `keyboardWillShow` does
 * not fire on Android.
 */
export function keyboardInsetEventNames(platformOS: unknown): {
  show: 'keyboardWillShow' | 'keyboardDidShow';
  hide: 'keyboardWillHide' | 'keyboardDidHide';
} {
  if (platformOS === 'ios') {
    return { show: 'keyboardWillShow', hide: 'keyboardWillHide' };
  }
  return { show: 'keyboardDidShow', hide: 'keyboardDidHide' };
}

/**
 * How far a bottom-anchored sheet must pad so its border sits above the IME
 * on a window that keeps its full height.
 *
 * `screenY` is the top of the keyboard. When it is a positive finite number
 * and `windowHeight` is a positive finite number, the inset is
 * `windowHeight - screenY`, and a result that is <= 0 is 0. A non-positive
 * `screenY` is a bad frame (some Android events report 0) and falls back to
 * the reported height, capped at the window, instead of treating 0 as the
 * top of the screen. A closed keyboard (`height <= 0`) reserves nothing.
 *
 * This function does not measure the avoiding view, so it does not do what
 * `KeyboardAvoidingView` `padding` does. If a window actually shrank and
 * `screenY` were still the keyboard top inside that shorter window, the
 * returned overlap would stack on the shrink. Today's edge-to-edge Android
 * window does not shrink for the IME. Whether a Modal delivers the keyboard
 * event, whether window height and `screenY` share an origin, and where the
 * sheet's top edge lands are device facts.
 */
export function resolveKeyboardOverlapInset(input: {
  windowHeight: number;
  keyboardHeight: number;
  keyboardScreenY: number;
}): number {
  const { windowHeight, keyboardHeight, keyboardScreenY: screenY } = input;
  if (!Number.isFinite(keyboardHeight) || keyboardHeight <= 0) return 0;
  if (
    Number.isFinite(screenY) &&
    screenY > 0 &&
    Number.isFinite(windowHeight) &&
    windowHeight > 0
  ) {
    const overlap = windowHeight - screenY;
    if (overlap <= 0) return 0;
    return Math.min(overlap, windowHeight);
  }
  if (Number.isFinite(windowHeight) && windowHeight > 0) {
    return Math.min(keyboardHeight, windowHeight);
  }
  return keyboardHeight;
}

import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

export function useIncreaseContrast(
  info: {
    isDarkerSystemColorsEnabled?: () => Promise<boolean>;
    isHighTextContrastEnabled?: () => Promise<boolean>;
    addEventListener: (
      event: 'darkerSystemColorsChanged' | 'highTextContrastChanged',
      handler: (enabled: boolean) => void,
    ) => { remove: () => void };
  } = AccessibilityInfo,
  platformOS: string = Platform.OS,
): boolean {
  const [increaseContrast, setIncreaseContrast] = useState(false);

  useEffect(() => {
    let live = true;
    const android = platformOS === 'android';
    const event = android
      ? 'highTextContrastChanged'
      : 'darkerSystemColorsChanged';
    const read = android
      ? info.isHighTextContrastEnabled
      : info.isDarkerSystemColorsEnabled;

    void (async () => {
      try {
        const enabled = await read?.call(info);
        if (live) setIncreaseContrast(enabled === true);
      } catch {
        /* An unreadable setting is not a reason to repaint every rim. */
      }
    })();

    const subscription = info.addEventListener(event, (enabled) => {
      setIncreaseContrast(enabled === true);
    });

    return () => {
      live = false;
      subscription.remove();
    };
  }, [info, platformOS]);

  return increaseContrast;
}

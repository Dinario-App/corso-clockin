import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { copy } from '@/constants/copy';
import {
  formatPasscodeWait,
  getAppLockPasscodeWait,
  getImportedRestingPasscodeWait,
  PasscodeBackoffError,
  type PasscodeWait,
} from './appLock';

/** Shared paint/announcement adapter for the app-lock limiter's general counter. */
export function usePasscodeWait(
  enabled: boolean,
  scope: 'general' | 'bound' = 'general',
) {
  const [wait, setWait] = useState<PasscodeWait | null>(null);
  const announced = useRef(false);

  const refresh = useCallback(async () => {
    const next = await (scope === 'bound'
      ? getImportedRestingPasscodeWait()
      : getAppLockPasscodeWait());
    setWait(next);
    if (next === null) announced.current = false;
    return next;
  }, [scope]);

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    void refresh().catch(() => {
      if (mounted) setWait(null);
    });
    const timer = setInterval(() => {
      if (mounted) void refresh().catch(() => undefined);
    }, 60_000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [enabled, refresh]);

  const acceptError = useCallback((error: unknown): boolean => {
    if (!(error instanceof PasscodeBackoffError)) return false;
    setWait({
      lockedUntilMs: error.lockedUntilMs,
      remainingMs: error.remainingMs,
    });
    return true;
  }, []);

  const duration = wait ? formatPasscodeWait(wait.remainingMs) : null;
  const line = duration ? copy.lock.tooManyTries(duration) : null;
  const accessibilityLabel = duration
    ? copy.lock.tooManyTriesA11y(duration)
    : undefined;

  useEffect(() => {
    if (!line || announced.current) return;
    announced.current = true;
    AccessibilityInfo.announceForAccessibility(line);
  }, [line]);

  return { wait, line, accessibilityLabel, acceptError, refresh };
}

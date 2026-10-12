import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { copy } from '@/constants/copy';
import type { collectSupportDiagnostics } from './supportDiagnostics';
import { buildSupportMailtoUrl, SUPPORT_EMAIL } from './supportEmail';

export function useContactSupport(
  sessionType: Parameters<typeof collectSupportDiagnostics>[0],
) {
  const [fallback, setFallback] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const showToast = useCallback((message: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(message);
    timer.current = setTimeout(() => setToast(null), 1600);
  }, []);

  const contact = useCallback(async () => {
    setFallback(false);
    try {
      // Loaded on tap: the diagnostics read native app info (expo-application),
      // which the Profile root has no reason to load on mount.
      const diagnostics = await import('./supportDiagnostics');
      await Linking.openURL(
        buildSupportMailtoUrl(
          diagnostics.collectSupportDiagnostics(sessionType),
        ),
      );
      void Haptics.selectionAsync();
    } catch {
      setFallback(true);
    }
  }, [sessionType]);

  const copyAddress = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(SUPPORT_EMAIL);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(copy.support.toastAddressCopied);
    } catch {
      showToast(copy.support.toastCopyFailed);
    }
  }, [showToast]);

  return { fallback, toast, contact, copyAddress };
}

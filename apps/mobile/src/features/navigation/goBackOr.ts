import { router } from 'expo-router';
import {
  resolveGuardedBack,
  type BackFallback,
} from '@/src/features/navigation/guardedBack';

export function goBackOr(fallback: BackFallback): void {
  const effect = resolveGuardedBack({
    canGoBack: router.canGoBack(),
    fallback,
  });
  if (effect.kind === 'back') {
    router.back();
    return;
  }
  router.replace(effect.href as never);
}

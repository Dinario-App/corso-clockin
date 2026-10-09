import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { resolveConnectEnabled } from '@/src/lib/apiConfig';
import { resolveMwaAvailability } from './mwaAvailability';
import { MWA_IDENTITY, validMwaIdentity } from './connectFlow';
export function useMwaAvailability(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    void resolveConnectEnabled().then(flag => { if (active) setEnabled(flag); }).catch(() => { if (active) setEnabled(false); });
    return () => { active = false; };
  }, []);
  if (enabled === null) return null;
  return resolveMwaAvailability({ connectEnabled: enabled, platformOS: Platform.OS, flavor: Constants.expoConfig?.extra?.flavor, identityConfigured: validMwaIdentity(MWA_IDENTITY) });
}

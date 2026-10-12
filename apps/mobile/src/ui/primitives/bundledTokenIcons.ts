import type { ImageSourcePropType } from 'react-native';
import {
  type BundledTokenIconKey,
  bundledTokenIconKey,
} from '@/src/features/tokens/tokenIconResolve';

function bundledSource(key: BundledTokenIconKey): ImageSourcePropType {
  switch (key) {
    case 'cbbtc':
      return require('@/assets/brand/vendor/coinbase/cbbtc.png');
    case 'zec':
      return require('@/assets/brand/vendor/zcash/zec.png');
  }
}

/** The bundled image for a `bundled:<key>` uri, or null when it names none. */
export function bundledTokenIconSource(
  uri: string,
): ImageSourcePropType | null {
  const key = bundledTokenIconKey(uri);
  return key === null ? null : bundledSource(key);
}

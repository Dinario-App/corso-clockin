import { useInkContrastEnabled } from '@/src/ui/glass/useInkContrast';
import {
  resolveEthenaMaterial,
  type EthenaMaterial,
  type EthenaPlane,
} from '@/src/ui/ethena/materialLaw';

export function useEthenaMaterial(plane: EthenaPlane): EthenaMaterial {
  const increaseContrast = useInkContrastEnabled();
  return resolveEthenaMaterial(plane, { increaseContrast });
}

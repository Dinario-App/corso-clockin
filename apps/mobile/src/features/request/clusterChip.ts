import type { PublicAppConfig } from '@/src/lib/apiConfig';

export function clusterChipLabel(
  cluster: PublicAppConfig['cluster'],
): string | null {
  if (cluster === 'mainnet-beta') return null;
  if (cluster === 'devnet') return 'Devnet';
  return null;
}

import { copy } from '@/constants/copy';

export function resolveAccountDisplayName(stored: string | null): string {
  const name = stored?.trim();
  return name ? name : copy.request.accountName;
}

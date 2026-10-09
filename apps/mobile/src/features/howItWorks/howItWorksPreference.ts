import type { PreferenceStorage } from '@/src/lib/analyticsPreference';
import { HOME_HREF, type HOW_IT_WORKS_HREF } from './howItWorksPresentation';

export const HOW_IT_WORKS_SEEN_KEY = '@corso/howItWorks/seen';

export function parseHowItWorksSeen(raw: string | null | undefined): boolean {
  return raw === '1';
}

export async function readHowItWorksSeen(
  storage: PreferenceStorage,
): Promise<boolean> {
  try {
    const raw = await storage.getItem(HOW_IT_WORKS_SEEN_KEY);
    return parseHowItWorksSeen(raw);
  } catch {
    return false;
  }
}

export async function writeHowItWorksSeen(
  storage: PreferenceStorage,
  seen: boolean,
): Promise<void> {
  await storage.setItem(HOW_IT_WORKS_SEEN_KEY, seen ? '1' : '0');
}

export async function markHowItWorksSeen(
  storage: PreferenceStorage,
): Promise<void> {
  await writeHowItWorksSeen(storage, true);
}

export async function resolveFirstRunHref(
  _storage: PreferenceStorage,
): Promise<typeof HOW_IT_WORKS_HREF | typeof HOME_HREF> {
  return HOME_HREF;
}

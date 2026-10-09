import type { SleeveCapView } from '@/src/features/sleeve/sleeveCap';

export function sleeveEditCapLabel(
  cap: SleeveCapView | null | undefined,
): string | null {
  if (!cap?.showCapUi || !cap.editCap) return null;
  if (cap.sheet?.dollars == null) return null;
  return cap.editCap;
}

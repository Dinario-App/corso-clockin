import type { ActivityFeedRowView } from '@/src/features/activity/activityFeedPresentation';
import { ethena } from '@/constants/theme.ethena';

export function activityAmountInk(
  _view: Pick<ActivityFeedRowView, 'amountIsPlaceholder' | 'amountTone'>,
): string {
  return ethena.ink.primary;
}

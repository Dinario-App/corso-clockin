import type { ActivityItem } from './types';

export function itemsAfterFailedRead(input: {
  held: ActivityItem[];
  heldFor: string | null;
  address: string;
}): ActivityItem[] {
  return input.heldFor === input.address ? input.held : [];
}

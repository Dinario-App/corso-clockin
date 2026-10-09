import {
  evaluateBackpackSecuritiesShelf,
  type BackpackShelfSignals,
} from '@/src/features/security/backpackSecuritiesShelf';

export type { BackpackShelfSignals as ShelfSignals };

export function showBackpackShelf(signals?: BackpackShelfSignals): boolean {
  const decision = evaluateBackpackSecuritiesShelf(signals ?? {});
  return (
    decision.showBackpackShelf === true && decision.reason === 'signals-agree'
  );
}

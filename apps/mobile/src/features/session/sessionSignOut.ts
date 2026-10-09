import { clearPriceAlertPushOnTeardown } from '../priceAlerts/pushRuntime';
import { clearPerUserLocalStores } from './localClearRegistry';
import { beginStatusSignOut } from '../ramp/statusCredentialStore';
import {
  armPendingSignOutClear,
  finishPendingSignOutClear,
} from './pendingSignOutClear';
import { resolveProfileSignOutPlan, type SessionType } from './types';

export type SessionSignOutActions = Readonly<{
  clearConnectedSession: () => Promise<unknown>;
  resetSessionLocalState: (options?: {
    restImportedSession?: boolean;
  }) => Promise<unknown>;
  logoutPrivy: () => Promise<unknown>;
}>;

export async function executeSessionTypeAwareSignOut(
  sessionType: SessionType | undefined,
  actions: SessionSignOutActions,
): Promise<void> {
  beginStatusSignOut();
  const pushClear = clearPriceAlertPushOnTeardown().catch(() => {});
  await armPendingSignOutClear();
  await pushClear;
  const plan = resolveProfileSignOutPlan(sessionType);
  if (plan.kind === 'clear_connected') {
    await actions.clearConnectedSession();
    const outcome = await clearPerUserLocalStores('sign-out');
    await finishPendingSignOutClear(outcome);
    return;
  }

  await actions.resetSessionLocalState({
    restImportedSession: sessionType === 'imported_seed',
  });
  await actions.logoutPrivy();
  const outcome = await clearPerUserLocalStores('sign-out');
  await finishPendingSignOutClear(outcome);
}

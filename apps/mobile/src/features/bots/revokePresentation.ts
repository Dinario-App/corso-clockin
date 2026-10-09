import { copy } from '@/constants/copy';
import type { BotView } from './types';

/** Only ended-rule server proof requires this prompt; suspension does not. */
export function resolveRevokePrompt(bot: Pick<BotView, 'revokeRequired'>) {
  return bot.revokeRequired === true ? {
    message: copy.automation.revokeNeeded,
    fee: copy.automation.revokeFee,
    action: copy.automation.revokeAction,
  } : null;
}

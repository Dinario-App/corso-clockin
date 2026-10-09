export const TEMPLATE_IDS = {
  WHAT_CHANGED_EMPTY: 'what_changed.empty.v1',
  WHAT_CHANGED_LOADING: 'what_changed.loading.v1',
  WHAT_CHANGED_EVENT_RECEIVED: 'what_changed.event.received.v1',
  WHAT_CHANGED_EVENT_SENT: 'what_changed.event.sent.v1',
  WHAT_CHANGED_EVENT_SWAP: 'what_changed.event.swap.v1',
  WHAT_CHANGED_EVENT_UNKNOWN: 'what_changed.event.unknown.v1',
  WHAT_CHANGED_NATIVE_SOL_DELTA: 'what_changed.native_sol_delta.v1',
  WHAT_CHANGED_INCOMPLETE: 'what_changed.incomplete.v1',
  FEE_CORSO_BPS: 'fee.corso_bps.v1',
  FEE_CORSO_ON_TOP: 'fee.corso_on_top.v1',
  FEE_DROPPED: 'fee.dropped.v1',
  FEE_PRICE_IMPACT: 'fee.price_impact.v1',
  FEE_NETWORK: 'fee.network.v1',
  FEE_SOL_RESERVE: 'fee.sol_reserve.v1',
} as const;

export type SkillsTemplateId =
  (typeof TEMPLATE_IDS)[keyof typeof TEMPLATE_IDS];

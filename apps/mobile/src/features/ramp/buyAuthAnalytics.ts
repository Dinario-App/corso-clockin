export type BuyAuthSessionType =
  | 'privy_embedded'
  | 'imported_seed'
  | 'connected_external';
export type BuyAuthFailureReason =
  | 'declined'
  | 'unavailable'
  | 'expired'
  | 'mismatch'
  | 'replayed'
  | 'door_unsupported';

export type BuyAuthAnalyticsEvent =
  | {
      name: 'buy_auth_started' | 'buy_auth_succeeded';
      properties: { session_type: BuyAuthSessionType };
    }
  | {
      name: 'buy_auth_failed' | 'buy_auth_blocked';
      properties: {
        session_type: BuyAuthSessionType;
        reason: BuyAuthFailureReason;
      };
    };

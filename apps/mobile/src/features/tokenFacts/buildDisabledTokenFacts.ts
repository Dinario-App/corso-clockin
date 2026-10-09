/**
 * Local disabled assembly — used when the public kill switch is off so the
 * client never hits the network (mirrors API `buildDisabledTokenFacts`).
 */
import type { PriceCluster } from '@/src/features/balances/priceSnapshot';
import {
  TOKEN_FACTS_SCHEMA_VERSION,
  type TokenFactsChainFields,
  type TokenFactsJupiterFields,
  type TokenFactsResponse,
  type TokenFactsRugcheckFields,
} from '@/src/features/tokenFacts/types';

const DEFAULT_CACHE_TTL_SEC = 60;

function emptyChainFields(): TokenFactsChainFields {
  return {
    decimals: null,
    supply: null,
    top20ConcentrationPct: null,
    mintAuthority: null,
    freezeAuthority: null,
    tokenProgram: null,
    transferFee: null,
    transferHook: null,
    transferHookAuthority: null,
    transferHookProgramId: null,
    permanentDelegate: null,
    permanentDelegateAddress: null,
    defaultAccountFrozen: null,
    transferFeeBasisPoints: null,
    transferFeeMaximum: null,
    transferFeeEpoch: null,
    transferFeeOlderBasisPoints: null,
    transferFeeOlderMaximum: null,
    transferFeeOlderEpoch: null,
    transferFeeNewerBasisPoints: null,
    transferFeeNewerMaximum: null,
    transferFeeNewerEpoch: null,
  };
}

function emptyJupiterFields(): TokenFactsJupiterFields {
  return {
    name: null,
    symbol: null,
    icon: null,
    holderCount: null,
    topHoldersPct: null,
    liquidityUsd: null,
    isVerified: null,
    organicScore: null,
    isSus: null,
  };
}

function emptyRugcheckFields(): TokenFactsRugcheckFields {
  return {
    riskLevel: null,
    riskDescriptions: [],
    lpLockedPct: null,
    lpLockedUsd: null,
    totalMarketLiquidity: null,
  };
}

export function buildDisabledTokenFacts(args: {
  mint: string;
  cluster: PriceCluster;
  nowMs: number;
  cacheTtlSec?: number;
}): TokenFactsResponse {
  return {
    schemaVersion: TOKEN_FACTS_SCHEMA_VERSION,
    mint: args.mint,
    cluster: args.cluster,
    status: 'disabled',
    asOfMs: args.nowMs,
    cacheTtlSec: args.cacheTtlSec ?? DEFAULT_CACHE_TTL_SEC,
    sources: {
      chain: { status: 'missing', asOfMs: null, fields: emptyChainFields() },
      jupiter: { status: 'missing', asOfMs: null, fields: emptyJupiterFields() },
      rugcheck: {
        status: 'missing',
        asOfMs: null,
        fields: emptyRugcheckFields(),
      },
    },
    flags: [],
  };
}

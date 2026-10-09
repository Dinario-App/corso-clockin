/**
 * Asset detail TokenFacts glue: the token facts panel on the asset detail screen.
 * Route validation and display composition only; no navigation authority.
 */
import { PublicKey } from '@solana/web3.js';
import { copy } from '@/constants/copy';
import { isModeratedTokenLabel } from '@/src/features/discovery/moderation';
import { truncateAddress } from '@/src/lib/truncateAddress';
import {
  buildSwapReviewFactsPanel,
  formatOptionalPercent,
  isTokenFactsStale,
  type TokenFactsPanelModel,
} from '@/src/features/tokenFacts/formatTokenFactsDisplay';
import type {
  RiskFlag,
  TokenFactsHookStatus,
  TokenFactsResponse,
} from '@/src/features/tokenFacts/types';
import { formatObservationClock } from '@/src/features/home/asOfPresentation';
import {
  buildAssetSwapActions,
  type AssetSwapAction,
} from '@/src/features/swap/assetPrefill';
import type { HeldSellDoor } from '@/src/features/swap/heldSellDoor';
import { resolveAcquireAccess } from '@/src/features/security/acquireAccessPresentation';
import type { JurisdictionGateInputs } from '@/src/features/security/jurisdictionGateInputs';

export const ASSET_DETAIL_STALENESS_MAX_DELAY_MS = 2_147_483_647;

export type AssetDetailFactsState = {
  status: TokenFactsHookStatus;
  facts: TokenFactsResponse | null;
  error: string | null;
};

export type AssetDetailHeaderModel = {
  title: string;
  subtitle: string;
  stateLine: string | null;
  identityLine: string;
  /**
   * True when the store gate condemned this pair's Jupiter label and the
   * title is the withheld copy. The screen reads it to withhold the ticker
   * line and the star's spoken name too — everything on this screen that
   * would otherwise print a stranger's word.
   */
  labelWithheld: boolean;
};

export type AssetDetailModel = {
  header: AssetDetailHeaderModel;
  panel: TokenFactsPanelModel;
  swapActions: AssetSwapAction[];
  provenanceRows: AssetProvenanceRow[];
  allowsUserDirectedActions: true;
  noSwapDoorNote: string | null;
  sellWithheldNote: string | null;
  acquireRefusedNote: string | null;
};

export type AssetProvenanceRow = {
  label: string;
  value: string;
  attribution: string;
};

export type AssetDetailRouteModel = {
  mint: string | null;
  tokenFactsMint: string | null;
  model: AssetDetailModel | null;
};

export function normalizeAssetMintParam(
  raw: string | string[] | null | undefined,
): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    return new PublicKey(trimmed).toBase58();
  } catch {
    return null;
  }
}

export function nextAssetDetailStalenessDelayMs(
  facts: TokenFactsResponse | null,
  nowMs: number,
): number | null {
  if (facts == null || isTokenFactsStale(facts, nowMs)) {
    return null;
  }
  return Math.min(
    ASSET_DETAIL_STALENESS_MAX_DELAY_MS,
    Math.max(1, facts.asOfMs + facts.cacheTtlSec * 1000 + 1 - nowMs),
  );
}

export function assetDisclosureAllowsUserDirectedActions(
  _flags: readonly RiskFlag[],
): true {
  return true;
}

function assetLabelWithheld(
  mint: string,
  facts: TokenFactsResponse | null,
): boolean {
  if (facts?.mint !== mint || facts.sources.jupiter.status !== 'ok') {
    return false;
  }
  const { symbol, name } = facts.sources.jupiter.fields;
  return isModeratedTokenLabel({ name, symbol });
}

function assetTitle(mint: string, facts: TokenFactsResponse | null): string {
  if (facts?.sources.jupiter.status === 'ok') {
    const { symbol, name } = facts.sources.jupiter.fields;
    if (symbol) return symbol;
    if (name) return name;
  }
  return truncateAddress(mint);
}

function assetStateLine(
  status: TokenFactsHookStatus,
  facts: TokenFactsResponse | null,
  nowMs: number,
): string | null {
  if (status === 'idle' || status === 'loading') return copy.tokenFacts.loading;
  if (status === 'error') return copy.tokenFacts.unavailable;
  if (status === 'disabled' || facts?.status === 'disabled') {
    return copy.tokenFacts.disabled;
  }
  if (status === 'unavailable' || facts?.status === 'unavailable') {
    return copy.tokenFacts.unavailable;
  }
  if (!facts) return copy.tokenFacts.unavailable;

  const parts: string[] = [];
  if (facts.status === 'partial') parts.push(copy.tokenFacts.partialShort);
  if (isTokenFactsStale(facts, nowMs)) parts.push(copy.tokenFacts.staleShort);
  return parts.length > 0 ? parts.join(' · ') : null;
}

function assetIdentityLine(mint: string): string {
  return copy.assetDetail.identity(copy.tokenFacts.mintTail(mint.slice(-5)));
}

function sourceAttribution(asOfMs: number | null): string | null {
  if (asOfMs == null) return null;
  const clock = formatObservationClock(asOfMs);
  return clock == null ? null : copy.assetDetail.attribution(clock);
}

function buildAssetProvenanceRows(
  mint: string,
  facts: TokenFactsResponse | null,
): AssetProvenanceRow[] {
  if (facts?.mint !== mint) return [];
  const rows: AssetProvenanceRow[] = [];
  const jupiter = facts.sources.jupiter;
  const jupiterAttribution = jupiter.status === 'ok'
    ? sourceAttribution(jupiter.asOfMs)
    : null;
  if (jupiterAttribution != null) {
    const holderCount = jupiter.fields.holderCount;
    if (
      holderCount != null &&
      Number.isSafeInteger(holderCount) &&
      holderCount >= 0
    ) {
      rows.push({
        label: copy.assetDetail.holderCount,
        value: new Intl.NumberFormat('en-US').format(holderCount),
        attribution: jupiterAttribution,
      });
    }
    const topHoldersPct = jupiter.fields.topHoldersPct;
    if (
      topHoldersPct != null &&
      Number.isFinite(topHoldersPct) &&
      topHoldersPct >= 0 &&
      topHoldersPct <= 100
    ) {
      rows.push({
        label: copy.assetDetail.jupiterTopHolders,
        value: formatOptionalPercent(topHoldersPct),
        attribution: jupiterAttribution,
      });
    }
  }
  const chain = facts.sources.chain;
  const chainAttribution = chain.status === 'ok'
    ? sourceAttribution(chain.asOfMs)
    : null;
  if (
    chainAttribution != null &&
    chain.fields.top20ConcentrationPct != null
  ) {
    rows.push({
      label: copy.assetDetail.top20Accounts,
      value: formatOptionalPercent(chain.fields.top20ConcentrationPct),
      attribution: chainAttribution,
    });
  }
  return rows;
}

export function buildAssetDetailTokenFactsModel(args: {
  mint: string;
  state: AssetDetailFactsState;
  nowMs: number;
  heldSell?: HeldSellDoor;
  acquireGateInputs?: JurisdictionGateInputs | null;
}): AssetDetailModel {
  const { mint, state, nowMs } = args;
  const facts = state.facts;
  const symbol =
    facts?.mint === mint && facts.sources.jupiter.status === 'ok'
      ? facts.sources.jupiter.fields.symbol
      : null;
  const decimals =
    facts?.mint === mint && facts.sources.chain.status === 'ok'
      ? facts.sources.chain.fields.decimals
      : null;
  const isVerified =
    facts?.mint === mint && facts.sources.jupiter.status === 'ok'
      ? facts.sources.jupiter.fields.isVerified
      : null;
  const name =
    facts?.mint === mint && facts.sources.jupiter.status === 'ok'
      ? facts.sources.jupiter.fields.name
      : null;
  const doorsEligible =
    facts != null && symbol != null && decimals != null && isVerified === true;
  const acquireAccess = resolveAcquireAccess({
    gateInputs: args.acquireGateInputs,
    mint,
    symbol,
    name,
  });
  const swapActions =
    doorsEligible
      ? buildAssetSwapActions({
          mint,
          symbol,
          decimals,
          cluster: facts.cluster,
          ...(args.heldSell ? { heldSell: args.heldSell } : {}),
          acquireAccess,
        })
      : [];
  const acquireRefusedNote =
    doorsEligible && acquireAccess.kind === 'refused'
      ? acquireAccess.note
      : null;
  const panel = buildSwapReviewFactsPanel({
    status: state.status,
    facts: state.facts,
    error: state.error,
    nowMs,
  });
  const labelWithheld = assetLabelWithheld(mint, state.facts);
  const noSwapDoorNote =
    acquireRefusedNote == null &&
    facts?.mint === mint && swapActions.length === 0
      ? copy.tokenDetail.noSwapDoor
      : null;
  const sellWithheldNote =
    noSwapDoorNote == null && args.heldSell?.kind === 'withheld'
      ? args.heldSell.note
      : null;
  return {
    header: {
      title: labelWithheld
        ? copy.tokenDetail.withheldTitle
        : assetTitle(mint, state.facts),
      subtitle: mint,
      stateLine: assetStateLine(state.status, state.facts, nowMs),
      identityLine: assetIdentityLine(mint),
      labelWithheld,
    },
    panel: {
      ...panel,
      rows: panel.rows.filter(
        (row) =>
          row.label !== copy.tokenFacts.topHolders &&
          row.label !== copy.tokenFacts.liquidity,
      ),
    },
    swapActions,
    noSwapDoorNote,
    sellWithheldNote,
    acquireRefusedNote,
    provenanceRows: buildAssetProvenanceRows(mint, facts),
    allowsUserDirectedActions: assetDisclosureAllowsUserDirectedActions(
      state.facts?.flags ?? [],
    ),
  };
}

export function buildAssetDetailRouteModel(args: {
  rawMint: string | string[] | null | undefined;
  state: AssetDetailFactsState;
  nowMs: number;
  heldSell?: HeldSellDoor;
  acquireGateInputs?: JurisdictionGateInputs | null;
}): AssetDetailRouteModel {
  const mint = normalizeAssetMintParam(args.rawMint);
  return {
    mint,
    tokenFactsMint: mint,
    model:
      mint == null
        ? null
        : buildAssetDetailTokenFactsModel({
            mint,
            state: args.state,
            nowMs: args.nowMs,
            ...(args.heldSell ? { heldSell: args.heldSell } : {}),
            acquireGateInputs: args.acquireGateInputs ?? null,
          }),
  };
}

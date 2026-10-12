import { copy } from '@/constants/copy';
import { clusterChipLabel } from '@/src/features/request/clusterChip';
import { resolveAccountDisplayName } from '@/src/features/profile/accountDisplayName';
import type { PublicAppConfig } from '@/src/lib/apiConfig';
import { truncateAddress } from '@/src/lib/truncateAddress';
import { colors, radii } from '@/src/ui/tokens';

/** QR module edge: fits the 390 frame's card with the tile's own padding. */
export const RECEIVE_QR_SIZE = 196;
export const RECEIVE_QR_TILE_PADDING = 14;
export const RECEIVE_QR_TILE_RADIUS = radii.hold;
/**
 * The one legibility-mandated light surface in the app: QR readers want
 * dark modules on a light tile. Ink tile, near-canvas modules — no new
 * colour, no white literal.
 */
export const RECEIVE_QR_TILE_COLOR = colors.ink;
export const RECEIVE_QR_MODULE_COLOR = colors.canvas;

export type ReceivePresentation = {
  title: string;
  accountName: string | null;
  accountSub: string;
  networkUnknown: boolean;
  networkUnknownLabel: string;
  networkRetryLabel: string;
  hasAddress: boolean;
  address: string | null;
  addressShort: string | null;
  addressLabel: string;
  qrAccessibilityLabel: string;
  copyLabel: string;
  shareLabel: string;
  caution: string;
  missingAddress: string;
};

function normalizeAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveReceivePresentation(input: {
  address: unknown;
  cluster: PublicAppConfig['cluster'] | null | undefined;
  /** The saved portfolio name: `null` none saved, `undefined` not read yet. */
  portfolioName?: string | null;
  networkUnknown?: boolean;
}): ReceivePresentation {
  const address = normalizeAddress(input.address);
  const clusterLabel =
    input.cluster == null ? null : clusterChipLabel(input.cluster);
  return {
    title: copy.v1.receive,
    accountName:
      input.portfolioName === undefined
        ? null
        : resolveAccountDisplayName(input.portfolioName),
    accountSub: clusterLabel
      ? `${copy.request.network} · ${clusterLabel}`
      : copy.request.network,
    networkUnknown: input.cluster == null && input.networkUnknown === true,
    networkUnknownLabel: copy.profile.networkUnknown,
    networkRetryLabel: copy.profile.networkRetry,
    hasAddress: address !== null,
    address,
    addressShort: address ? truncateAddress(address) : null,
    addressLabel: copy.request.yourAddress,
    qrAccessibilityLabel: copy.request.receiveAddressQr,
    copyLabel: copy.request.copy,
    shareLabel: copy.request.share,
    caution: copy.request.caution,
    missingAddress: copy.request.missingAddress,
  };
}

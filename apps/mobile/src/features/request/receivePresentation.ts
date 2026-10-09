import { copy } from '@/constants/copy';
import { clusterChipLabel } from '@/src/features/request/clusterChip';
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
  accountName: string;
  accountSub: string;
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
}): ReceivePresentation {
  const address = normalizeAddress(input.address);
  const clusterLabel =
    input.cluster == null ? null : clusterChipLabel(input.cluster);
  return {
    title: copy.v1.receive,
    accountName: copy.request.accountName,
    accountSub: clusterLabel
      ? `${copy.request.network} · ${clusterLabel}`
      : copy.request.network,
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

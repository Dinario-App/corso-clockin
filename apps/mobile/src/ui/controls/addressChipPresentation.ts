import type { TextStyle, ViewStyle } from 'react-native';
import { truncateAddress } from '@/src/lib/truncateAddress.js';
import type { CorsoIconName } from '@/src/ui/icons/corsoIconNames.js';
import {
  resolveTapTargetInsets,
  type TapTargetInsets,
} from '@/src/ui/primitives/tapTargetPresentation.js';
import { colors, typography } from '@/src/ui/tokens';

export const ADDRESS_CHIP_HEIGHT = 28;
export const ADDRESS_CHIP_RADIUS = 14;
export const ADDRESS_CHIP_HORIZONTAL_PADDING = 12;
/** Gap between truncated address and copy affordance. */
export const ADDRESS_CHIP_LABEL_GLYPH_GAP = 4;
/** Copy glyph size inside the 28pt pill. */
export const ADDRESS_CHIP_GLYPH_SIZE = 12;
/** Locked CorsoIcon registry key for the copy affordance. */
export const ADDRESS_CHIP_COPY_GLYPH: CorsoIconName = 'copy';
/** Caption/13 tabular figures for mono-ish address display (RN-supported only). */
export const ADDRESS_CHIP_LABEL_FONT_VARIANT: TextStyle['fontVariant'] = [
  'tabular-nums',
];
export const ADDRESS_CHIP_LABEL_LINE_HEIGHT = 18;

/** Minimum conservative Solana base58 length (32-byte key). */
export const SOLANA_ADDRESS_MIN_LENGTH = 32;
/** Maximum conservative Solana base58 length. */
export const SOLANA_ADDRESS_MAX_LENGTH = 44;

const SOLANA_BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const SOLANA_BASE58_CHAR_SET = new Set(SOLANA_BASE58_ALPHABET);

export const ADDRESS_CHIP_ACCESSIBILITY_COPY_PREFIX =
  'Wallet address ' as const;
export const ADDRESS_CHIP_ACCESSIBILITY_COPY_SUFFIX =
  ', double tap to copy' as const;

export type AddressChipVisualState = 'default' | 'copied';

export type AddressChipPresentation = {
  containerStyle: ViewStyle;
  labelStyle: TextStyle;
  hitSlop: TapTargetInsets;
  displayAddress: string;
  canonicalAddress: string;
  visualState: AddressChipVisualState;
  glyph: CorsoIconName;
  glyphSize: number;
  glyphColor: string;
  accessibilityRole: 'button';
  accessibilityLabel: string;
};

/** Fail closed on values outside conservative Solana base58 rules. */
export function assertSolanaAddressInput(
  address: unknown,
): asserts address is string {
  if (normalizeSolanaAddressInput(address) === null) {
    throw new Error(`Invalid AddressChip address: ${String(address)}`);
  }
}

/**
 * Conservative Solana base58 validation — rejects padded/hostile input,
 * enforces length bounds, and does not decode wallet semantics.
 */
export function normalizeSolanaAddressInput(address: unknown): string | null {
  if (typeof address !== 'string') {
    return null;
  }

  const trimmed = address.trim();
  if (trimmed !== address) {
    return null;
  }

  if (
    trimmed.length < SOLANA_ADDRESS_MIN_LENGTH ||
    trimmed.length > SOLANA_ADDRESS_MAX_LENGTH
  ) {
    return null;
  }

  for (const char of trimmed) {
    if (!SOLANA_BASE58_CHAR_SET.has(char)) {
      return null;
    }
  }

  return trimmed;
}

function resolveAddressChipCopiedState(copied: unknown): AddressChipVisualState | null {
  if (copied === undefined || copied === false) {
    return 'default';
  }
  if (copied === true) {
    return 'copied';
  }
  return null;
}

function resolveAddressChipAccessibilityLabel(canonicalAddress: string): string {
  return `${ADDRESS_CHIP_ACCESSIBILITY_COPY_PREFIX}${canonicalAddress}${ADDRESS_CHIP_ACCESSIBILITY_COPY_SUFFIX}`;
}

export function resolveAddressChipPresentation(input: {
  address: unknown;
  copied?: unknown;
}): AddressChipPresentation | null {
  const canonicalAddress = normalizeSolanaAddressInput(input.address);
  if (canonicalAddress === null) {
    return null;
  }

  const visualState = resolveAddressChipCopiedState(input.copied);
  if (visualState === null) {
    return null;
  }

  const displayAddress = truncateAddress(canonicalAddress);

  return {
    containerStyle: {
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      height: ADDRESS_CHIP_HEIGHT,
      paddingHorizontal: ADDRESS_CHIP_HORIZONTAL_PADDING,
      gap: ADDRESS_CHIP_LABEL_GLYPH_GAP,
      borderRadius: ADDRESS_CHIP_RADIUS,
      backgroundColor: colors.surface,
    },
    labelStyle: {
      color: colors.ink,
      fontSize: typography.caption,
      lineHeight: ADDRESS_CHIP_LABEL_LINE_HEIGHT,
      fontFamily: typography.face('500'),
      fontWeight: '500',
      fontVariant: ADDRESS_CHIP_LABEL_FONT_VARIANT,
    },
    hitSlop: resolveTapTargetInsets({
      // Truncated address + padding + glyph exceed 44pt. Width is content-hugging,
      // so only the fixed 28pt axis needs expansion beyond the 44pt lower bound.
      visualWidth: 44,
      visualHeight: ADDRESS_CHIP_HEIGHT,
    }),
    displayAddress,
    canonicalAddress,
    visualState,
    glyph: ADDRESS_CHIP_COPY_GLYPH,
    glyphSize: ADDRESS_CHIP_GLYPH_SIZE,
    glyphColor: colors.ink,
    accessibilityRole: 'button',
    accessibilityLabel: resolveAddressChipAccessibilityLabel(canonicalAddress),
  };
}

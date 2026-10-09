import type { TextStyle, ViewStyle } from 'react-native';
import type { PublicAppConfig } from '@/src/lib/apiConfig';
import type { CorsoIconName } from '@/src/ui/icons/corsoIconNames.js';
import {
  TOKEN_MARK_DEFAULT_SIZE,
  type TokenMarkSize,
  type TokenMarkTicker,
} from '@/src/ui/primitives/tokenMarkPresentation.js';
import {
  resolveTapTargetInsets,
  type TapTargetInsets,
} from '@/src/ui/primitives/tapTargetPresentation.js';
import { colors, spacing, typography } from '@/src/ui/tokens';

export const NETWORK_ROW_WIDTH = 353;
export const NETWORK_ROW_HEIGHT = 56;
/** Body/16 line height centred inside the 56pt row. */
export const NETWORK_ROW_LINE_HEIGHT = 22;
/** Solana mono mark size — reuses TokenMark authority. */
export const NETWORK_ROW_MARK_SIZE: TokenMarkSize = TOKEN_MARK_DEFAULT_SIZE;
/** Locked TokenMark ticker for the Solana mono mark. */
export const NETWORK_ROW_MARK_TICKER: TokenMarkTicker = 'SOL';
/** Selected-state check glyph size. */
export const NETWORK_ROW_CHECK_SIZE = 20;
/** Locked CorsoIcon registry key for the selected check. */
export const NETWORK_ROW_CHECK_GLYPH: CorsoIconName = 'check';

export const NETWORK_ROW_LABEL_MAINNET = 'Solana Mainnet' as const;
export const NETWORK_ROW_LABEL_DEVNET = 'Solana Devnet' as const;

export type NetworkRowCluster = PublicAppConfig['cluster'];

export type NetworkRowPresentation = {
  containerStyle: ViewStyle;
  labelStyle: TextStyle;
  markSlotStyle: ViewStyle;
  checkSlotStyle: ViewStyle;
  displayLabel:
    | typeof NETWORK_ROW_LABEL_MAINNET
    | typeof NETWORK_ROW_LABEL_DEVNET;
  cluster: NetworkRowCluster;
  selected: boolean;
  showCheck: boolean;
  markTicker: TokenMarkTicker;
  markSize: TokenMarkSize;
  checkGlyph: CorsoIconName;
  checkSize: number;
  checkColor: string;
  hitSlop: TapTargetInsets;
  accessibilityRole: 'button';
  accessibilityLabel: string;
  accessibilityState: { selected: boolean };
  hiddenDescendantProps: { accessible: false; importantForAccessibility: 'no-hide-descendants' };
};

function normalizeNetworkRowBoolean(value: unknown): boolean | null {
  if (value === undefined || value === false) {
    return false;
  }
  if (value === true) {
    return true;
  }
  return null;
}

/** Map API cluster truth to locked picker labels — no caller copy. */
export function resolveNetworkRowLabel(
  cluster: NetworkRowCluster,
): NetworkRowPresentation['displayLabel'] {
  if (cluster === 'mainnet-beta') {
    return NETWORK_ROW_LABEL_MAINNET;
  }
  return NETWORK_ROW_LABEL_DEVNET;
}

export function resolveNetworkRowPresentation(input: {
  cluster: unknown;
  selected?: unknown;
}): NetworkRowPresentation | null {
  if (input.cluster !== 'mainnet-beta' && input.cluster !== 'devnet') {
    return null;
  }

  const selected = normalizeNetworkRowBoolean(input.selected);
  if (selected === null) {
    return null;
  }

  const cluster = input.cluster;
  const displayLabel = resolveNetworkRowLabel(cluster);

  return {
    containerStyle: {
      width: NETWORK_ROW_WIDTH,
      height: NETWORK_ROW_HEIGHT,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    labelStyle: {
      flex: 1,
      flexShrink: 1,
      color: colors.ink,
      fontSize: typography.body,
      lineHeight: NETWORK_ROW_LINE_HEIGHT,
      fontFamily: typography.face('500'),
      fontWeight: '500',
    },
    markSlotStyle: {
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    checkSlotStyle: {
      width: NETWORK_ROW_CHECK_SIZE,
      height: NETWORK_ROW_CHECK_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    displayLabel,
    cluster,
    selected,
    showCheck: selected,
    markTicker: NETWORK_ROW_MARK_TICKER,
    markSize: NETWORK_ROW_MARK_SIZE,
    checkGlyph: NETWORK_ROW_CHECK_GLYPH,
    checkSize: NETWORK_ROW_CHECK_SIZE,
    checkColor: colors.ink,
    hitSlop: resolveTapTargetInsets({
      visualWidth: NETWORK_ROW_WIDTH,
      visualHeight: NETWORK_ROW_HEIGHT,
    }),
    accessibilityRole: 'button',
    accessibilityLabel: selected
      ? `${displayLabel}, selected`
      : displayLabel,
    accessibilityState: { selected },
    hiddenDescendantProps: {
      accessible: false,
      importantForAccessibility: 'no-hide-descendants',
    },
  };
}

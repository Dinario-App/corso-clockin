import type { TextStyle, ViewStyle } from 'react-native';
import type { PublicAppConfig } from '@/src/lib/apiConfig';
import type { CorsoIconName } from '@/src/ui/icons/corsoIconNames.js';
import {
  resolveTapTargetInsets,
  type TapTargetInsets,
} from '@/src/ui/primitives/tapTargetPresentation.js';
import { colors, typography } from '@/src/ui/tokens';

export const CLUSTER_CHIP_HEIGHT = 28;
export const CLUSTER_CHIP_RADIUS = 14;
export const CLUSTER_CHIP_HORIZONTAL_PADDING = 12;
/** Gap between label and chevron affordance. */
export const CLUSTER_CHIP_LABEL_CHEVRON_GAP = 4;
/** Chevron glyph size inside the 28pt pill. */
export const CLUSTER_CHIP_CHEVRON_SIZE = 12;
/** Locked CorsoIcon registry key for the chevron affordance. */
export const CLUSTER_CHIP_CHEVRON_GLYPH: CorsoIconName = 'chevron-down';
export const CLUSTER_CHIP_LABEL_LINE_HEIGHT = 18;

export const CLUSTER_CHIP_LABEL_MAINNET = 'Solana' as const;
export const CLUSTER_CHIP_LABEL_DEVNET = 'Solana · Devnet' as const;

export type ClusterChipCluster = PublicAppConfig['cluster'];

export type ClusterChipPresentation = {
  containerStyle: ViewStyle;
  labelStyle: TextStyle;
  hitSlop: TapTargetInsets;
  displayLabel: typeof CLUSTER_CHIP_LABEL_MAINNET | typeof CLUSTER_CHIP_LABEL_DEVNET;
  cluster: ClusterChipCluster;
  chevronGlyph: CorsoIconName;
  chevronSize: number;
  chevronColor: string;
  accessibilityRole: 'button';
  accessibilityLabel: string;
};

/** Fail closed on clusters outside the PublicAppConfig union. */
export function assertClusterChipCluster(
  cluster: unknown,
): asserts cluster is ClusterChipCluster {
  if (cluster !== 'mainnet-beta' && cluster !== 'devnet') {
    throw new Error(`Invalid ClusterChip cluster: ${String(cluster)}`);
  }
}

/** Map API cluster truth to locked display labels — no caller copy. */
export function resolveClusterChipLabel(
  cluster: ClusterChipCluster,
): ClusterChipPresentation['displayLabel'] {
  if (cluster === 'mainnet-beta') {
    return CLUSTER_CHIP_LABEL_MAINNET;
  }
  return CLUSTER_CHIP_LABEL_DEVNET;
}

export function resolveClusterChipPresentation(input: {
  cluster: unknown;
}): ClusterChipPresentation | null {
  if (
    input.cluster !== 'mainnet-beta' &&
    input.cluster !== 'devnet'
  ) {
    return null;
  }

  const cluster = input.cluster;
  const displayLabel = resolveClusterChipLabel(cluster);

  return {
    containerStyle: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      height: CLUSTER_CHIP_HEIGHT,
      paddingHorizontal: CLUSTER_CHIP_HORIZONTAL_PADDING,
      gap: CLUSTER_CHIP_LABEL_CHEVRON_GAP,
      borderRadius: CLUSTER_CHIP_RADIUS,
      backgroundColor: colors.surface,
    },
    labelStyle: {
      color: colors.ink,
      fontSize: typography.caption,
      lineHeight: CLUSTER_CHIP_LABEL_LINE_HEIGHT,
      fontFamily: typography.face('500'),
      fontWeight: '500',
    },
    hitSlop: resolveTapTargetInsets({
      // Both locked labels plus padding and chevron exceed 44pt. The width is
      // content-hugging, so only the fixed 28pt axis needs expansion.
      visualWidth: 44,
      visualHeight: CLUSTER_CHIP_HEIGHT,
    }),
    displayLabel,
    cluster,
    chevronGlyph: CLUSTER_CHIP_CHEVRON_GLYPH,
    chevronSize: CLUSTER_CHIP_CHEVRON_SIZE,
    chevronColor: colors.ink,
    accessibilityRole: 'button',
    accessibilityLabel: `${displayLabel}, select cluster`,
  };
}

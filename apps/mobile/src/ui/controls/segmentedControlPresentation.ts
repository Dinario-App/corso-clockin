import type { TextStyle, ViewStyle } from 'react-native';
import {
  resolveTapTargetInsets,
  type TapTargetInsets,
} from '@/src/ui/primitives/tapTargetPresentation.js';
import { colors, kitType, typography } from '@/src/ui/tokens';
import { resolveDisabledPaint } from './disabledPresentation.js';

export const SEGMENTED_CONTROL_WIDTH = 353;
export const SEGMENTED_HEIGHT = 36;
export const SEGMENTED_CONTROL_HEIGHT = SEGMENTED_HEIGHT;
/** Runtime hit-carrier height — 44pt parent so hitSlop is not clipped. */
export const SEGMENTED_CONTROL_HIT_HEIGHT = 44;
/** Vertical inset that centers the 36pt visual track inside the 44pt carrier. */
export const SEGMENTED_CONTROL_TRACK_OFFSET =
  (SEGMENTED_CONTROL_HIT_HEIGHT - SEGMENTED_HEIGHT) / 2;
export const SEGMENTED_RADIUS = 18;
export const SEGMENTED_CONTROL_RADIUS = SEGMENTED_RADIUS;
export const SEGMENTED_PAD = 3;
export const SEGMENTED_CONTROL_ACTIVE_INSET = SEGMENTED_PAD;
export const SEGMENTED_THUMB_HEIGHT = 30;
export const SEGMENTED_THUMB_RADIUS = 15;
export const SEGMENTED_CONTROL_ACTIVE_RADIUS = SEGMENTED_THUMB_RADIUS;
export const SEGMENTED_CONTROL_MIN_SEGMENTS = 2;
export const SEGMENTED_CONTROL_MAX_SEGMENTS = 4;
export const SEGMENTED_LABEL = { fontSize: 16, fontWeight: '500' as const };
export const SEGMENTED_CONTROL_LABEL_LINE_HEIGHT = 20;
export const SEGMENTED_SM_HEIGHT = 32;
/** `.seg.sm` — track radius h/2. */
export const SEGMENTED_SM_RADIUS = 16;
/** `.seg.sm` — white thumb 26pt; the 3pt pad is unchanged. */
export const SEGMENTED_SM_THUMB_HEIGHT = 26;
/** `.seg.sm` — thumb radius h/2. */
export const SEGMENTED_SM_THUMB_RADIUS = 13;
/** `.seg.sm` — label 14/500. */
export const SEGMENTED_SM_LABEL = { fontSize: 14, fontWeight: '500' as const };
export const SEGMENTED_SM_LABEL_LINE_HEIGHT = 18;
export const SEGMENTED_SWITCHER_LABEL = {
  fontSize: kitType.headline,
  fontWeight: '500' as const,
};
export const SEGMENTED_SWITCHER_LABEL_LINE_HEIGHT = 22;
export const SEGMENTED_SWITCHER_PAD_H = 14;
export const SEGMENTED_SWITCHER_GAP = 2;
/** Thumb slide; Reduce Motion jumps (duration 0). */
export const SEGMENTED_THUMB_SLIDE_MS = 150;
export const SEGMENTED_FROST_TRACK = 'rgba(255, 255, 255, 0.12)';

export type SegmentedTrack = 'row' | 'card' | 'frost';
export type SegmentedVariant = 'segmented' | 'switcher';
export type SegmentedSize = 'md' | 'sm';

export type SegmentedGeometry = {
  size: SegmentedSize;
  height: number;
  radius: number;
  pad: number;
  thumbHeight: number;
  thumbRadius: number;
  labelFontSize: number;
  labelLineHeight: number;
};

const SEGMENTED_GEOMETRY: Readonly<Record<SegmentedSize, SegmentedGeometry>> = {
  md: {
    size: 'md',
    height: SEGMENTED_HEIGHT,
    radius: SEGMENTED_RADIUS,
    pad: SEGMENTED_PAD,
    thumbHeight: SEGMENTED_THUMB_HEIGHT,
    thumbRadius: SEGMENTED_THUMB_RADIUS,
    labelFontSize: SEGMENTED_LABEL.fontSize,
    labelLineHeight: SEGMENTED_CONTROL_LABEL_LINE_HEIGHT,
  },
  sm: {
    size: 'sm',
    height: SEGMENTED_SM_HEIGHT,
    radius: SEGMENTED_SM_RADIUS,
    pad: SEGMENTED_PAD,
    thumbHeight: SEGMENTED_SM_THUMB_HEIGHT,
    thumbRadius: SEGMENTED_SM_THUMB_RADIUS,
    labelFontSize: SEGMENTED_SM_LABEL.fontSize,
    labelLineHeight: SEGMENTED_SM_LABEL_LINE_HEIGHT,
  },
};

export function resolveSegmentedGeometry(size: unknown): SegmentedGeometry {
  return { ...SEGMENTED_GEOMETRY[size === 'sm' ? 'sm' : 'md'] };
}

export type SegmentedControlSegmentPresentation = {
  index: number;
  label: string;
  segmentStyle: ViewStyle;
  activePillStyle: ViewStyle | null;
  /** Inner Material layout — padding lives here, never on the outer `style`. */
  activePillContentStyle: ViewStyle | null;
  labelStyle: TextStyle;
  isSelected: boolean;
  isDisabled: boolean;
  hitSlop: TapTargetInsets;
  accessibilityRole: 'tab';
  accessibilityLabel: string;
  accessibilityState: {
    selected: boolean;
    disabled: boolean;
  };
};

export type SegmentedControlThumbPresentation = {
  height: number;
  width: number;
  borderRadius: number;
  backgroundColor: string;
  translateX: number;
  material: 'pill' | null;
  style: ViewStyle;
};

export type SegmentedControlPresentation = {
  variant: SegmentedVariant;
  track: SegmentedTrack;
  size: SegmentedSize;
  height: number;
  trackColor: string;
  selectedLabelColor: string;
  labelColor: string;
  labelStyle: TextStyle;
  thumb: SegmentedControlThumbPresentation;
  carrierStyle: ViewStyle;
  visualTrackStyle: ViewStyle;
  visualTrackPointerEvents: 'none';
  tabListAccessibilityRole: 'tablist';
  segments: SegmentedControlSegmentPresentation[];
};

/** Trim valid strings; reject empty or non-string entries. */
export function normalizeSegmentedControlLabel(label: unknown): string | null {
  if (typeof label !== 'string') {
    return null;
  }
  const trimmed = label.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed;
}

/** Fail closed unless labels are 2–4 non-empty strings. */
export function assertSegmentedControlLabels(
  labels: unknown,
): asserts labels is readonly string[] {
  if (!Array.isArray(labels)) {
    throw new Error('SegmentedControl labels must be an array');
  }
  if (
    labels.length < SEGMENTED_CONTROL_MIN_SEGMENTS ||
    labels.length > SEGMENTED_CONTROL_MAX_SEGMENTS
  ) {
    throw new Error(
      `SegmentedControl labels must contain ${SEGMENTED_CONTROL_MIN_SEGMENTS}–${SEGMENTED_CONTROL_MAX_SEGMENTS} entries`,
    );
  }
  for (const [index, label] of labels.entries()) {
    if (normalizeSegmentedControlLabel(label) === null) {
      throw new Error(`SegmentedControl label at index ${index} must be a non-empty string`);
    }
  }
}

/**
 * Exact active-index guard — integer in `[0, segmentCount)`.
 * Returns null when hostile so the component can fail safe to render nothing.
 */
export function normalizeSegmentedControlActiveIndex(
  activeIndex: unknown,
  segmentCount: number,
): number | null {
  if (
    typeof activeIndex !== 'number' ||
    !Number.isInteger(activeIndex) ||
    activeIndex < 0 ||
    activeIndex >= segmentCount
  ) {
    return null;
  }
  return activeIndex;
}

function resolveVariant(value: unknown): SegmentedVariant {
  return value === 'switcher' ? 'switcher' : 'segmented';
}

function resolveTrack(value: unknown): SegmentedTrack {
  if (value === 'row' || value === 'frost' || value === 'card') {
    return value;
  }
  return 'card';
}

function resolveTrackColor(
  variant: SegmentedVariant,
  track: SegmentedTrack,
): string {
  if (variant === 'switcher') {
    return 'transparent';
  }
  if (track === 'row') {
    return colors.surfaceTrack;
  }
  if (track === 'frost') {
    return SEGMENTED_FROST_TRACK;
  }
  return colors.surfaceGroup;
}

function resolveBaseLabelStyle(
  variant: SegmentedVariant,
  geometry: SegmentedGeometry,
): TextStyle {
  if (variant === 'switcher') {
    return {
      fontSize: SEGMENTED_SWITCHER_LABEL.fontSize,
      lineHeight: SEGMENTED_SWITCHER_LABEL_LINE_HEIGHT,
      fontFamily: typography.face(SEGMENTED_SWITCHER_LABEL.fontWeight),
      fontWeight: SEGMENTED_SWITCHER_LABEL.fontWeight,
      textAlign: 'center',
    };
  }
  return {
    fontSize: geometry.labelFontSize,
    lineHeight: geometry.labelLineHeight,
    fontFamily: typography.face(SEGMENTED_LABEL.fontWeight),
    fontWeight: SEGMENTED_LABEL.fontWeight,
    textAlign: 'center',
  };
}

function resolveMeasuredTrackWidth(trackWidth: unknown): number {
  if (
    typeof trackWidth === 'number' &&
    Number.isFinite(trackWidth) &&
    trackWidth > 0
  ) {
    return trackWidth;
  }
  return SEGMENTED_CONTROL_WIDTH;
}

export function resolveSegmentedControlPresentation(input: {
  labels: unknown;
  activeIndex: unknown;
  accessibilityLabels?: unknown;
  disabledIndices?: unknown;
  disabled?: unknown;
  variant?: unknown;
  track?: unknown;
  size?: unknown;
  fullWidth?: unknown;
  /** Measured track width for `fullWidth`. Ignored when absent or hostile. */
  trackWidth?: unknown;
}): SegmentedControlPresentation | null {
  try {
    assertSegmentedControlLabels(input.labels);
  } catch {
    return null;
  }

  const normalizedLabels = input.labels.map((label) =>
    normalizeSegmentedControlLabel(label),
  ) as string[];

  const activeIndex = normalizeSegmentedControlActiveIndex(
    input.activeIndex,
    normalizedLabels.length,
  );
  if (activeIndex === null) {
    return null;
  }

  if (
    input.disabledIndices !== undefined &&
    (!Array.isArray(input.disabledIndices) ||
      input.disabledIndices.some(
        (index) =>
          typeof index !== 'number' ||
          !Number.isInteger(index) ||
          index < 0 ||
          index >= normalizedLabels.length,
      ))
  ) {
    return null;
  }
  const disabledIndices = new Set<number>(
    Array.isArray(input.disabledIndices) ? input.disabledIndices : [],
  );
  if (disabledIndices.has(activeIndex)) {
    return null;
  }
  const interactionDisabled = input.disabled === true;
  const variant = resolveVariant(input.variant);
  const track = resolveTrack(input.track);
  const fullWidth = input.fullWidth === true;
  const isSwitcher = variant === 'switcher';
  const geometry = resolveSegmentedGeometry(isSwitcher ? 'md' : input.size);
  const count = normalizedLabels.length;
  const disabledPaint = resolveDisabledPaint('segment');
  const trackColor = resolveTrackColor(variant, track);
  const selectedLabelColor = isSwitcher ? colors.ink : colors.onSelected;
  const labelColor = isSwitcher ? colors.ink : colors.inkSecondary;
  const labelStyle = resolveBaseLabelStyle(variant, geometry);
  const frameWidth = fullWidth
    ? '100%'
    : isSwitcher
      ? undefined
      : SEGMENTED_CONTROL_WIDTH;
  const numericTrackWidth = resolveMeasuredTrackWidth(input.trackWidth);
  const innerTrackWidth = numericTrackWidth - geometry.pad * 2;
  const thumbWidth = innerTrackWidth / count;
  const thumbTranslateX = geometry.pad + activeIndex * thumbWidth;
  const thumbBackgroundColor = interactionDisabled
    ? disabledPaint.fill
    : isSwitcher
      ? colors.surface
      : colors.selected;

  const accessibilityOverrides = Array.isArray(input.accessibilityLabels)
    ? input.accessibilityLabels
    : [];

  const segmentVisualWidth = isSwitcher
    ? 50 + SEGMENTED_SWITCHER_PAD_H * 2
    : thumbWidth;
  const segmentHitSlop = resolveTapTargetInsets({
    visualWidth: segmentVisualWidth,
    visualHeight: geometry.height,
  });

  const thumb: SegmentedControlThumbPresentation = isSwitcher
    ? {
        height: SEGMENTED_HEIGHT,
        width: 0,
        borderRadius: SEGMENTED_RADIUS,
        backgroundColor: thumbBackgroundColor,
        translateX: 0,
        material: 'pill',
        style: {
          height: SEGMENTED_HEIGHT,
          borderRadius: SEGMENTED_RADIUS,
          paddingHorizontal: SEGMENTED_SWITCHER_PAD_H,
          alignItems: 'center',
          justifyContent: 'center',
        },
      }
    : {
        height: geometry.thumbHeight,
        width: thumbWidth,
        borderRadius: geometry.thumbRadius,
        backgroundColor: thumbBackgroundColor,
        translateX: thumbTranslateX,
        material: null,
        style: {
          position: 'absolute',
          top: geometry.pad,
          left: 0,
          height: geometry.thumbHeight,
          width: thumbWidth,
          borderRadius: geometry.thumbRadius,
          backgroundColor: thumbBackgroundColor,
        },
      };

  const segments = normalizedLabels.map((label, index) => {
    const isSelected = index === activeIndex;
    const isDisabled = interactionDisabled || disabledIndices.has(index);
    const override = normalizeSegmentedControlLabel(accessibilityOverrides[index]);
    const accessibilityLabel = override ?? label;
    const color = isDisabled
      ? disabledPaint.label
      : isSelected
        ? selectedLabelColor
        : labelColor;

    return {
      index,
      label,
      segmentStyle: isSwitcher
        ? {
            height: SEGMENTED_HEIGHT,
            paddingHorizontal: isSelected ? 0 : SEGMENTED_SWITCHER_PAD_H,
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
          }
        : {
            width: thumbWidth,
            marginLeft: index === 0 ? geometry.pad : 0,
            height: geometry.height,
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
          },
      activePillStyle:
        isSwitcher && isSelected
          ? {
              height: SEGMENTED_HEIGHT,
            }
          : null,
      activePillContentStyle:
        isSwitcher && isSelected
          ? {
              flexGrow: 1,
              height: SEGMENTED_HEIGHT,
              paddingHorizontal: SEGMENTED_SWITCHER_PAD_H,
              alignItems: 'center' as const,
              justifyContent: 'center' as const,
            }
          : null,
      labelStyle: {
        ...labelStyle,
        color,
      },
      isSelected,
      isDisabled,
      hitSlop: { ...segmentHitSlop },
      accessibilityRole: 'tab' as const,
      accessibilityLabel,
      accessibilityState: {
        selected: isSelected,
        disabled: isDisabled,
      },
    };
  });

  return {
    variant,
    track,
    size: geometry.size,
    height: geometry.height,
    trackColor,
    selectedLabelColor,
    labelColor,
    labelStyle,
    thumb,
    carrierStyle: {
      width: frameWidth,
      height: SEGMENTED_CONTROL_HIT_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'transparent',
      ...(isSwitcher ? { gap: SEGMENTED_SWITCHER_GAP } : {}),
    },
    visualTrackStyle: {
      position: 'absolute',
      top: (SEGMENTED_CONTROL_HIT_HEIGHT - geometry.height) / 2,
      left: 0,
      width: fullWidth ? '100%' : SEGMENTED_CONTROL_WIDTH,
      height: geometry.height,
      borderRadius: geometry.radius,
      backgroundColor: trackColor,
    },
    visualTrackPointerEvents: 'none',
    tabListAccessibilityRole: 'tablist',
    segments,
  };
}

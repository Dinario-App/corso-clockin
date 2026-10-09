import type { TextStyle, ViewStyle } from 'react-native';
import { ETHENA_ACCESSIBLE_RIM, ethenaMaterial } from '@/constants/theme.ethena';
import { resolveFloatGlassSurface } from '@/src/ui/glass/corsoGlassRecipe';
import { MATERIAL_WEIGHTS } from '@/src/ui/glass/materialTokens';
import {
  SCRIM_HEIGHT,
  SCRIM_WIDTH,
} from '@/src/ui/primitives/scrimPresentation.js';
import { copy } from '@/constants/copy';
import { SCROLL_FADE_TOP } from '@/src/ui/primitives/scrollEdgeFadePresentation.js';
import {
  colors,
  elevationSoftViewStyle,
  kitType,
  radii,
  spacing,
  typography,
} from '@/src/ui/tokens';

export const BOTTOM_SHEET_WIDTH = SCRIM_WIDTH;
export const BOTTOM_SHEET_SCREEN_HEIGHT = SCRIM_HEIGHT;
export const BOTTOM_SHEET_CONTENT_INSET = 20;
export const BOTTOM_SHEET_TOP_RADIUS = radii.sheet;
export const BOTTOM_SHEET_MAX_HEIGHT = '92%';
export function resolveBottomSheetBodyFadeTop(scrollY: number): number {
  if (!Number.isFinite(scrollY) || scrollY <= 0) return 0;
  return Math.min(scrollY, SCROLL_FADE_TOP);
}

export const BOTTOM_SHEET_TOP_EDGE_WIDTH = 0.5;

export function resolveBottomSheetTopEdge(increaseContrast: boolean): {
  borderTopWidth: number;
  borderTopColor: string;
} {
  return increaseContrast
    ? {
        borderTopWidth: Math.max(1, BOTTOM_SHEET_TOP_EDGE_WIDTH),
        borderTopColor: ETHENA_ACCESSIBLE_RIM,
      }
    : {
        borderTopWidth: BOTTOM_SHEET_TOP_EDGE_WIDTH,
        borderTopColor: ethenaMaterial.rim,
      };
}
/** Design floor for the bottom pad when there is no system bar to clear. */
export const BOTTOM_SHEET_BOTTOM_FLOOR = spacing.xl;
/** Breathing room the primary row keeps above whatever system bar is showing. */
export const BOTTOM_SHEET_BAR_CLEARANCE = spacing.sm;

export const BOTTOM_SHEET_SURFACES = ['solid', 'deep', 'frost'] as const;

export type BottomSheetSurface = (typeof BOTTOM_SHEET_SURFACES)[number];

/** The opaque desk sheet ground: `BottomSheet` solid and the step-up sheet. */
export const BOTTOM_SHEET_SOLID_GROUND = resolveFloatGlassSurface();

/** The opaque ground each surface paints; `frost` leaves it to the weight. */
const SURFACE_GROUND: Readonly<Record<BottomSheetSurface, string | null>> = {
  solid: BOTTOM_SHEET_SOLID_GROUND,
  deep: colors.groundSheetDeep,
  frost: null,
};

export const BOTTOM_SHEET_CLOSE_SIZE = 44;
export const BOTTOM_SHEET_CLOSE_GLYPH_SIZE = 20;
export const BOTTOM_SHEET_CLOSE_EDGE_INSET = 14;
export const BOTTOM_SHEET_KIT_HEADER_GAP = 5;
export const BOTTOM_SHEET_KIT_HEADER_BOTTOM = 9;

export type BottomSheetCloseButton = {
  accessibilityLabel: string;
  glyphSize: number;
  glyphColor: string;
  pressedFill: string;
  /** The title row: the circle's height, padded so a centred title clears it. */
  rowStyle: ViewStyle;
  circleStyle: ViewStyle;
};

function resolveCloseButton(title: string): BottomSheetCloseButton {
  return {
    accessibilityLabel: copy.v1.dismissSheet(title),
    glyphSize: BOTTOM_SHEET_CLOSE_GLYPH_SIZE,
    glyphColor: colors.ink,
    pressedFill: ethenaMaterial.v3,
    rowStyle: {
      alignSelf: 'stretch',
      minHeight: BOTTOM_SHEET_CLOSE_SIZE,
      justifyContent: 'center',
      paddingHorizontal: BOTTOM_SHEET_CLOSE_SIZE + spacing.sm,
    },
    circleStyle: {
      position: 'absolute',
      top: 0,
      right: -(BOTTOM_SHEET_CONTENT_INSET - BOTTOM_SHEET_CLOSE_EDGE_INSET),
      width: BOTTOM_SHEET_CLOSE_SIZE,
      height: BOTTOM_SHEET_CLOSE_SIZE,
      borderRadius: BOTTOM_SHEET_CLOSE_SIZE / 2,
      backgroundColor: ethenaMaterial.v2,
      alignItems: 'center',
      justifyContent: 'center',
    },
  };
}

/**
 * Sheets draw behind both system bars, so the bottom pad has to track the live
 * inset. Gesture nav is ~24dp and lands back on the 32 floor; three-button nav
 * is ~48dp, which the old hardcoded 32 left the Sign row sitting under.
 */
export function resolveBottomSheetBottomInset(safeAreaBottom: number): number {
  const inset =
    Number.isFinite(safeAreaBottom) && safeAreaBottom > 0 ? safeAreaBottom : 0;
  return Math.max(BOTTOM_SHEET_BOTTOM_FLOOR, inset + BOTTOM_SHEET_BAR_CLEARANCE);
}

export const TRUE_MODAL_KINDS = [
  /** A transaction review the user is about to sign. */
  'signing',
  /** Face ID / biometric step-up. */
  'stepUp',
  /** App-lock passcode entry. */
  'passcode',
  /** An irreversible confirmation — delete, revoke, reset. */
  'destructive',
  'consent',
] as const;

export type TrueModalKind = (typeof TRUE_MODAL_KINDS)[number];

export type BottomSheetKind = TrueModalKind | 'legacy';

export function isTrueModalKind(value: unknown): value is TrueModalKind {
  return (
    typeof value === 'string' &&
    (TRUE_MODAL_KINDS as readonly string[]).includes(value)
  );
}

export type BottomSheetPresentationInput = {
  title: string;
  visible: boolean;
  dismissible: boolean;
  signing: boolean;
  onRequestClose: () => void;
  /**
   * What kind of true modal this is. Omitted → `legacy`, the pending-migration
   * marker; see `BottomSheetKind`.
   */
  kind?: BottomSheetKind;
  surface?: BottomSheetSurface;
  /** Live `useSafeAreaInsets().bottom`. Omitted means "no bar", not "iOS". */
  safeAreaBottomInset?: number;
  closeButton?: boolean;
};

export type BottomSheetPresentation = {
  title: string;
  accessibleName: string;
  visible: boolean;
  kind: BottomSheetKind;
  isTrueModal: boolean;
  surface: BottomSheetSurface;
  /** The Material weight the sheet body renders, or `null` for an opaque ground. */
  material: 'frost' | null;
  backgroundColor: string | null;
  /**
   * Whether text on this sheet draws Ethena tertiary one rung up: `true` on
   * the float ground (`solid`) only, where that ink is under 4.5:1.
   */
  liftsQuietInk: boolean;
  /**
   * Whether the `Scrim` paint mounts. `false` on `frost` only: a frosted sheet
   * frosts its own footprint and leaves the content above it undimmed. The
   * scrim-dismiss tap-catcher mounts on every surface either way.
   */
  showsScrim: boolean;
  /**
   * The frost backdrop's box: the sheet's footprint, run one top radius past
   * the bottom edge so the sheet's own top-only clip squares the bottom corners
   * the weight rounds. `null` on an opaque ground.
   */
  frostBackdropStyle: ViewStyle | null;
  effectiveDismissible: boolean;
  modalAnimationType: 'none';
  modalTransparent: true;
  modalPresentationStyle: 'overFullScreen';
  backdropStyle: ViewStyle;
  scrimDismissStyle: ViewStyle;
  sheetStyle: ViewStyle;
  headerStyle: ViewStyle;
  titleStyle: TextStyle;
  bodyStyle: ViewStyle;
  bodyWrapStyle: ViewStyle;
  bodyFadeColor: string;
  closeButton: BottomSheetCloseButton | null;
};

function assertBoolean(name: string, value: unknown): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw new TypeError(`BottomSheet ${name} must be a boolean`);
  }
}

function assertCloseHandler(value: unknown): asserts value is () => void {
  if (typeof value !== 'function') {
    throw new TypeError('BottomSheet onRequestClose must be a function');
  }
}

/**
 * An unknown kind is a typo or an invented category, and either one would sail
 * past the register guard as "legacy". Reject it here, where it is cheap.
 */
function normalizeKind(value: unknown): BottomSheetKind {
  if (value === undefined || value === 'legacy') return 'legacy';
  if (isTrueModalKind(value)) return value;
  throw new TypeError(
    `BottomSheet kind must be one of ${TRUE_MODAL_KINDS.join(', ')} or omitted, got ${String(value)}`,
  );
}

/** An unknown surface is a typo; painting it as `solid` would hide the typo. */
function normalizeSurface(value: unknown): BottomSheetSurface {
  if (value === undefined) return 'solid';
  if (
    typeof value === 'string' &&
    (BOTTOM_SHEET_SURFACES as readonly string[]).includes(value)
  ) {
    return value as BottomSheetSurface;
  }
  throw new TypeError(
    `BottomSheet surface must be one of ${BOTTOM_SHEET_SURFACES.join(', ')} or omitted, got ${String(value)}`,
  );
}

function normalizeTitle(value: unknown): string {
  if (typeof value !== 'string') {
    throw new TypeError('BottomSheet title must be a string');
  }
  const title = value.trim();
  if (title.length === 0) {
    throw new TypeError('BottomSheet title must be non-empty');
  }
  return title;
}

export function resolveBottomSheetPresentation(
  input: BottomSheetPresentationInput,
): BottomSheetPresentation {
  const title = normalizeTitle(input.title);
  assertBoolean('visible', input.visible);
  assertBoolean('dismissible', input.dismissible);
  assertBoolean('signing', input.signing);
  assertCloseHandler(input.onRequestClose);

  const effectiveDismissible = input.signing ? false : input.dismissible;
  const kind = normalizeKind(input.kind);
  const surface = normalizeSurface(input.surface);
  const ground = SURFACE_GROUND[surface];
  const frost = surface === 'frost';
  if (input.closeButton !== undefined) {
    assertBoolean('closeButton', input.closeButton);
  }
  const closeButton = input.closeButton ? resolveCloseButton(title) : null;

  return {
    title,
    accessibleName: `${title}, sheet`,
    visible: input.visible,
    kind,
    isTrueModal: isTrueModalKind(kind),
    surface,
    material: frost ? 'frost' : null,
    backgroundColor: ground,
    liftsQuietInk: surface === 'solid',
    showsScrim: !frost,
    frostBackdropStyle: frost
      ? {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: -BOTTOM_SHEET_TOP_RADIUS,
        }
      : null,
    effectiveDismissible,
    modalAnimationType: 'none',
    modalTransparent: true,
    modalPresentationStyle: 'overFullScreen',
    backdropStyle: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    scrimDismissStyle: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    /**
     * The fill is declared once, here, on a View. Review and Activity used to
     * mount through `PlatformGlass`, and iOS `systemUltraThinMaterialDark`
     * sampled the compose screen through the signing surface even after the
     * fill token was raised — Route / Price / Corso fee from behind sat on
     * top of the sheet's own rows. Controls stay glass; a sheet occludes.
     *
     * `frost` is the one exception, and it is opt-in: no fill, no hairline and
     * no lift of its own here — the weight paints all three (its shadow is
     * none, so nothing darkens the content above). `overflow: 'hidden'` with
     * top-only radii is what clips its backdrop square at the bottom.
     */
    sheetStyle: {
      zIndex: 1,
      alignSelf: 'stretch',
      maxHeight: BOTTOM_SHEET_MAX_HEIGHT,
      ...(ground === null
        ? {}
        : {
            backgroundColor: ground,
            ...resolveBottomSheetTopEdge(false),
          }),
      borderTopLeftRadius: BOTTOM_SHEET_TOP_RADIUS,
      borderTopRightRadius: BOTTOM_SHEET_TOP_RADIUS,
      overflow: 'hidden',
      paddingHorizontal: BOTTOM_SHEET_CONTENT_INSET,
      paddingTop: spacing.smd,
      paddingBottom: resolveBottomSheetBottomInset(input.safeAreaBottomInset ?? 0),
      ...(frost ? {} : elevationSoftViewStyle),
    },
    headerStyle: {
      alignItems: 'center',
      gap: spacing.smd,
      marginBottom: 20,
      ...(closeButton
        ? {
            gap: BOTTOM_SHEET_KIT_HEADER_GAP,
            marginBottom: BOTTOM_SHEET_KIT_HEADER_BOTTOM,
          }
        : null),
    },
    titleStyle: {
      alignSelf: 'stretch',
      color: colors.ink,
      fontFamily: typography.face('600'),
      fontSize: typography.title,
      fontWeight: '600',
      ...(closeButton
        ? { fontSize: kitType.headline, textAlign: 'center' as const }
        : null),
    },
    bodyWrapStyle: {
      alignSelf: 'stretch',
      flexShrink: 1,
      position: 'relative',
    },
    bodyFadeColor: ground ?? MATERIAL_WEIGHTS.frost.fill,
    closeButton,
    bodyStyle: {
      alignSelf: 'stretch',
      flexShrink: 1,
      /**
       * The body is not its own surface. `colors.surface` is the raised token
       * for content sitting on the *canvas*; inside a sheet it painted an
       * second opaque slab darker than the sheet fill around it, so the row list
       * read as a hole punched through the sheet. The sheet fill is the surface,
       * and the rows are type on it.
       */
      backgroundColor: 'transparent',
    },
  };
}

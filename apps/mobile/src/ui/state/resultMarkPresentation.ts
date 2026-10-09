import type { CorsoIconName } from '@/src/ui/icons/corsoIconNames';
import { colors, radii } from '@/src/ui/tokens';

export const RESULT_MARK_DISC_SIZE = 44;
export const RESULT_MARK_DISC_RADIUS = radii.hold;
export const RESULT_MARK_GLYPH_OPTICAL_SIZE = RESULT_MARK_DISC_SIZE * 0.56;

export const RESULT_MARK_A1_FILLED_AREA = Math.PI * RESULT_MARK_DISC_RADIUS ** 2;
export const RESULT_MARK_A1_BOUNDING_BOX_AREA =
  RESULT_MARK_DISC_SIZE * RESULT_MARK_DISC_SIZE;

export type ResultMarkKind = 'success' | 'error';

export type ResultMarkPresentation = {
  width: number;
  height: number;
  borderRadius: number;
  backgroundColor: string;
  glyphSize: number;
  glyphColor: string;
  iconName: CorsoIconName;
  accessibilityElementsHidden: true;
  importantForAccessibility: 'no-hide-descendants';
};

export function resolveResultMarkPresentation(
  kind: ResultMarkKind,
): ResultMarkPresentation {
  const iconName: CorsoIconName =
    kind === 'success' ? 'result.success' : 'result.error';

  return {
    width: RESULT_MARK_DISC_SIZE,
    height: RESULT_MARK_DISC_SIZE,
    borderRadius: RESULT_MARK_DISC_RADIUS,
    backgroundColor: colors.ink,
    glyphSize: RESULT_MARK_GLYPH_OPTICAL_SIZE,
    glyphColor: colors.canvas,
    iconName,
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants',
  };
}

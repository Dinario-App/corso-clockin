import { ethena, ethenaMaterial } from '@/constants/theme.ethena';
import { resolveSheetInkColor } from '@/src/ui/glass/inkContrast';
import {
  BOTTOM_SHEET_SOLID_GROUND,
  resolveBottomSheetTopEdge,
} from '@/src/ui/primitives/bottomSheetPresentation';

export type StepUpSheetPaint = {
  sheetFill: string;
  topEdgeColor: string;
  topEdgeWidth: number;
  wellFill: string;
  bodyInk: string;
  cancelInk: string;
  /** The code field's hint, on `wellFill` over `sheetFill`. */
  placeholderInk: string;
};

export function resolveStepUpSheetPaint(input: {
  increaseContrast: boolean;
}): StepUpSheetPaint {
  const { increaseContrast } = input;
  const edge = resolveBottomSheetTopEdge(increaseContrast);
  return {
    sheetFill: BOTTOM_SHEET_SOLID_GROUND,
    topEdgeColor: edge.borderTopColor,
    topEdgeWidth: edge.borderTopWidth,
    wellFill: ethenaMaterial.v2,
    bodyInk: ethena.ink.secondary,
    // The quiet rung on a float sheet: drawn one rung up, at rest and lifted.
    cancelInk:
      resolveSheetInkColor(ethena.ink.tertiary, increaseContrast) ??
      ethena.ink.secondary,
    // A colour prop: with none, Android draws the native theme's hint colour.
    placeholderInk: ethena.ink.secondary,
  };
}

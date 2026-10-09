import {
  ETHENA_ACCESSIBLE_RIM,
  ethena,
  ethenaMaterial,
} from '@/constants/theme.ethena';
import { resolveEthenaMaterial } from '@/src/ui/ethena/materialLaw';

export type PasscodeCellPaint = {
  fill: string;
  rimWidth: number;
  rimColor: string | null;
  nextRingColor: string;
};

export function resolvePasscodeCellPaint(input: {
  onFloatSheet: boolean;
  increaseContrast: boolean;
}): PasscodeCellPaint {
  const { onFloatSheet, increaseContrast } = input;
  const nextRingColor = increaseContrast
    ? ethena.ink.primary
    : ETHENA_ACCESSIBLE_RIM;
  if (onFloatSheet) {
    return {
      fill: ethenaMaterial.v2,
      rimWidth: increaseContrast ? 1 : 0,
      rimColor: increaseContrast ? ETHENA_ACCESSIBLE_RIM : null,
      nextRingColor,
    };
  }
  const tray = resolveEthenaMaterial('ground', { increaseContrast });
  return {
    fill: String(tray.fill),
    rimWidth: tray.borderWidth,
    rimColor: tray.borderColor,
    nextRingColor,
  };
}

export type PasscodeKeyPressPaint = {
  fill: string;
  rimWidth: number;
  rimColor: string | null;
};

export function resolvePasscodeKeyPressPaint(input: {
  onFloatSheet: boolean;
  increaseContrast: boolean;
}): PasscodeKeyPressPaint | null {
  if (!input.onFloatSheet) return null;
  return {
    fill: ethenaMaterial.v3,
    rimWidth: input.increaseContrast ? 1 : 0,
    rimColor: input.increaseContrast ? ETHENA_ACCESSIBLE_RIM : null,
  };
}

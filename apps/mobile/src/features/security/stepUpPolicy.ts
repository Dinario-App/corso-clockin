import type { StepUpPolicy } from '@/src/lib/apiConfig';

/** Format threshold for user-facing copy (`0.05 SOL`). */
export function formatStepUpThreshold(sol: number): string {
  const trimmed = Number.isInteger(sol)
    ? String(sol)
    : sol.toFixed(4).replace(/\.?0+$/, '');
  return `${trimmed} SOL`;
}

/** At-or-above threshold, or unknown notional → step-up required when enabled. */
export function isAboveStepUpThreshold(
  notionalSol: number | null,
  policy: StepUpPolicy,
): boolean {
  if (!policy.stepUpRequired) return false;
  if (notionalSol == null || !Number.isFinite(notionalSol)) return true;
  return notionalSol >= policy.stepUpThresholdSol;
}

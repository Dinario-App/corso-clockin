export type RoutineFireHandoff = {
  routineId: string;
  walletAddress: string;
  positionMint: string;
};

let routineFireForSwap: RoutineFireHandoff | null = null;

export function writeRoutineFireForSwap(value: RoutineFireHandoff): void {
  routineFireForSwap = { ...value };
}
export function readRoutineFireForSwap(): RoutineFireHandoff | null {
  return routineFireForSwap ? { ...routineFireForSwap } : null;
}

export function clearRoutineFireForSwap(): void {
  routineFireForSwap = null;
}

export function confirmedSwapMatchesRoutineFire(
  fire: RoutineFireHandoff,
  swap: { walletAddress: string; inputMint: string },
): boolean {
  return (
    fire.walletAddress === swap.walletAddress &&
    fire.positionMint === swap.inputMint
  );
}

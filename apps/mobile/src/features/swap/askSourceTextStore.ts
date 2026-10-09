let sourceTextForSwap: string | null = null;

export function writeAskSourceTextForSwap(value: string | null): void {
  sourceTextForSwap = typeof value === 'string' && value.length > 0
    ? value
    : null;
}

export function readAskSourceTextForSwap(): string | null {
  return sourceTextForSwap;
}

export function clearAskSourceTextForSwap(): void {
  sourceTextForSwap = null;
}

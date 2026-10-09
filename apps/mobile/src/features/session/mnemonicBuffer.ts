const MAX_WORDS = 24;

type Slot = string | null;

const slots: Slot[] = Array.from({ length: MAX_WORDS }, () => null);
let activeLength: 12 | 24 = 12;

function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
}

export const mnemonicBuffer = {
  setLength(length: 12 | 24): void {
    activeLength = length;
    if (length === 12) {
      for (let i = 12; i < MAX_WORDS; i += 1) {
        slots[i] = null;
      }
    }
  },

  getLength(): 12 | 24 {
    return activeLength;
  },

  setWord(index: number, word: string): void {
    if (index < 0 || index >= activeLength) return;
    const normalized = normalizeWord(word);
    slots[index] = normalized.length > 0 ? normalized : null;
  },

  wordLength(index: number): number {
    const word = slots[index];
    return word ? word.length : 0;
  },

  isFilled(index: number): boolean {
    return Boolean(slots[index] && slots[index]!.length > 0);
  },

  /** Prefix for BIP-39 suggestions only — do not log or persist. */
  wordPrefix(index: number): string {
    return slots[index] ?? '';
  },

  count(): number {
    let n = 0;
    for (let i = 0; i < activeLength; i += 1) {
      if (slots[i]) n += 1;
    }
    return n;
  },

  /** Single caller: import submit. Do not retain the return value past save(). */
  readAll(): string {
    const words: string[] = [];
    for (let i = 0; i < activeLength; i += 1) {
      const w = slots[i];
      if (!w) {
        throw new Error('Recovery phrase is incomplete');
      }
      words.push(w);
    }
    return words.join(' ');
  },

  clear(): void {
    for (let i = 0; i < MAX_WORDS; i += 1) {
      const current = slots[i];
      if (current) {
        // Overwrite then drop (best-effort; JS strings are immutable).
        slots[i] = '\0'.repeat(current.length);
      }
      slots[i] = null;
    }
    activeLength = 12;
  },
};

export type PersistedSaveOutcome<T> = {
  result: T;
  /**
   * Whether the system clipboard was actually emptied. `false` is a real,
   * reportable state — never a reason to call the import a failure.
   */
  clipboardCleared: boolean;
};

export async function clearAfterPersistedSave<T>(
  save: () => Promise<T>,
  clearClipboard: () => Promise<unknown>,
  afterBufferClear?: () => void,
): Promise<PersistedSaveOutcome<T>> {
  const result = await save();
  mnemonicBuffer.clear();
  afterBufferClear?.();
  let clipboardCleared = true;
  try {
    await clearClipboard();
  } catch {
    clipboardCleared = false;
  }
  return { result, clipboardCleared };
}

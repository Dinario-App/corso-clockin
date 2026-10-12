import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PORTFOLIO_NAME_STORAGE_KEY,
  normalizePortfolioName,
} from './firstRunOnboarding';

export type PortfolioNameStorage = {
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type PortfolioNameReader = {
  getItem(key: string): Promise<string | null>;
};

type PortfolioNameListener = (name: string | null) => void;

const portfolioNameListeners = new Set<PortfolioNameListener>();
let cachedPortfolioName: string | null | undefined;
/**
 * Bumped by every write and clear. A read that started under an older
 * generation lost a race with a write (a rename, or a sign-out clear) and must
 * not land: before this, a read in flight across sign-out put the previous
 * person's name back into the cache and onto the identity card.
 */
let portfolioNameGeneration = 0;

export function cachedPortfolioNameRead(): string | null | undefined {
  return cachedPortfolioName;
}

export function publishPortfolioName(name: string | null): void {
  portfolioNameGeneration += 1;
  cachedPortfolioName = name;
  for (const listener of portfolioNameListeners) listener(name);
}

export function subscribePortfolioName(
  listener: PortfolioNameListener,
): () => void {
  portfolioNameListeners.add(listener);
  return () => {
    portfolioNameListeners.delete(listener);
  };
}

/** @internal test-only */
export function __resetPortfolioNameChannelForTests(): void {
  cachedPortfolioName = undefined;
  portfolioNameGeneration = 0;
  portfolioNameListeners.clear();
}

export type PortfolioNameRead =
  | { status: 'read'; name: string | null }
  | { status: 'superseded' }
  | { status: 'failed' };

export async function readPortfolioNameGuarded(
  storage: PortfolioNameReader = AsyncStorage,
): Promise<PortfolioNameRead> {
  const generation = portfolioNameGeneration;
  let name: string | null;
  try {
    const raw = await storage.getItem(PORTFOLIO_NAME_STORAGE_KEY);
    name = raw == null ? null : normalizePortfolioName(raw);
  } catch {
    return { status: 'failed' };
  }
  if (generation !== portfolioNameGeneration) return { status: 'superseded' };
  cachedPortfolioName = name;
  return { status: 'read', name };
}

export async function readPortfolioName(
  storage: PortfolioNameReader = AsyncStorage,
): Promise<string | null> {
  const result = await readPortfolioNameGuarded(storage);
  return result.status === 'read' ? result.name : null;
}

/**
 * Saves a real answer, normalised. An empty answer is not a name and writes
 * nothing. Best effort: a failed write resolves false and never blocks 02.
 */
export async function savePortfolioName(
  raw: string,
  storage: PortfolioNameStorage = AsyncStorage,
): Promise<boolean> {
  const normalized = normalizePortfolioName(raw);
  if (!normalized) return false;
  try {
    await storage.setItem(PORTFOLIO_NAME_STORAGE_KEY, normalized);
    publishPortfolioName(normalized);
    return true;
  } catch {
    return false;
  }
}

/** Sign-out clear. A disk failure throws so the registry can retry and report it. */
export async function clearPortfolioNameOnSignOut(
  storage: PortfolioNameStorage = AsyncStorage,
): Promise<void> {
  await storage.removeItem(PORTFOLIO_NAME_STORAGE_KEY);
  publishPortfolioName(null);
}

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

export async function readPortfolioName(
  storage: PortfolioNameReader = AsyncStorage,
): Promise<string | null> {
  try {
    const raw = await storage.getItem(PORTFOLIO_NAME_STORAGE_KEY);
    return raw == null ? null : normalizePortfolioName(raw);
  } catch {
    return null;
  }
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
}

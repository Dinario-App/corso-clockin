import type { BotView } from './types';

type Listener = () => void;

let walletAddress: string | null = null;
const EMPTY_VIEWS: BotView[] = [];
let views: BotView[] = [];
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function readBots(forWallet: string): BotView[] {
  return walletAddress === forWallet ? views : EMPTY_VIEWS;
}

export function readBot(forWallet: string, id: string): BotView | null {
  return readBots(forWallet).find((bot) => bot.id === id) ?? null;
}

export function writeBots(forWallet: string, next: BotView[]): void {
  walletAddress = forWallet;
  views = next;
  emit();
}

/** Upserts one view; a different wallet's row is refused. */
export function writeBot(forWallet: string, bot: BotView): void {
  if (bot.walletAddress !== forWallet) return;
  if (walletAddress !== forWallet) {
    walletAddress = forWallet;
    views = [];
  }
  const index = views.findIndex((entry) => entry.id === bot.id);
  views =
    index === -1
      ? [bot, ...views]
      : views.map((entry) => (entry.id === bot.id ? bot : entry));
  emit();
}

export function clearBots(): void {
  walletAddress = null;
  views = [];
  emit();
}

export function subscribeBots(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

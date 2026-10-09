import { PublicKey } from '@solana/web3.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseRecipientAddress } from '@/src/features/send/validateSend';

export const PRIOR_RECIPIENTS_KEY_PREFIX = 'corso.send.priorRecipients.v1';
export const PRIOR_RECIPIENTS_CAP = 200;

export const NEW_RECIPIENT_WARNING_IS_DISCLOSURE_ONLY = true as const;

export type SendCluster = 'devnet' | 'mainnet-beta';

type PriorRecipientsPayload = {
  v: 1;
  dests: string[];
};

export function priorRecipientsStorageKey(
  cluster: SendCluster,
  owner: string,
): string {
  return `${PRIOR_RECIPIENTS_KEY_PREFIX}:${cluster}:${owner}`;
}

export function canonicalizeAddress(raw: string): string | null {
  const key = parseRecipientAddress(raw);
  return key?.toBase58() ?? null;
}

/** Owner wallet / smart-account address — any valid base58 PublicKey (incl. off-curve PDA). */
export function canonicalizeOwnerAddress(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return new PublicKey(trimmed).toBase58();
  } catch {
    return null;
  }
}

export function isFirstTimeRecipient(known: boolean | 'unknown'): boolean {
  return known !== true;
}

function canonicalizeOwner(owner: string | null | undefined): string | null {
  if (!owner) return null;
  return canonicalizeOwnerAddress(owner);
}

function parsePayload(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((d): d is string => typeof d === 'string');
    }
    if (
      parsed &&
      typeof parsed === 'object' &&
      (parsed as PriorRecipientsPayload).v === 1 &&
      Array.isArray((parsed as PriorRecipientsPayload).dests)
    ) {
      return (parsed as PriorRecipientsPayload).dests.filter(
        (d): d is string => typeof d === 'string',
      );
    }
    return [];
  } catch {
    return [];
  }
}

async function readDests(key: string): Promise<string[] | 'error'> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return parsePayload(raw);
  } catch {
    return 'error';
  }
}

export async function hasPriorRecipient(args: {
  cluster: SendCluster | null;
  owner: string | null | undefined;
  recipient: string;
}): Promise<boolean | 'unknown'> {
  const owner = canonicalizeOwner(args.owner);
  const dest = canonicalizeAddress(args.recipient);
  if (!args.cluster || !owner || !dest) return 'unknown';

  const key = priorRecipientsStorageKey(args.cluster, owner);
  const dests = await readDests(key);
  if (dests === 'error') return 'unknown';
  return dests.includes(dest);
}

/**
 * How many recent addresses the Send sheet shows. Deliberately small.
 *
 * This is not an address book: no nicknames, no editing, no adding. A label
 * over base58 is a new trust surface, where a mislabeled row sends money to
 * the wrong place under a friendly name. The list is what you already sent to,
 * newest first, and nothing else.
 */
export const RECENT_RECIPIENTS_SHOWN = 3;

export async function listRecentRecipients(args: {
  cluster: SendCluster | null;
  owner: string | null | undefined;
  limit?: number;
}): Promise<string[]> {
  const owner = canonicalizeOwner(args.owner);
  if (!args.cluster || !owner) return [];

  const limit = Number.isSafeInteger(args.limit)
    ? Math.max(0, args.limit as number)
    : RECENT_RECIPIENTS_SHOWN;
  if (limit === 0) return [];

  const dests = await readDests(priorRecipientsStorageKey(args.cluster, owner));
  if (dests === 'error') return [];

  const recent: string[] = [];
  const seen = new Set<string>();
  // Stored oldest first; the tail is the most recent send.
  for (let i = dests.length - 1; i >= 0 && recent.length < limit; i -= 1) {
    const dest = canonicalizeAddress(dests[i] ?? '');
    if (!dest || seen.has(dest)) continue;
    seen.add(dest);
    recent.push(dest);
  }
  return recent;
}

async function writeDests(key: string, dests: string[]): Promise<void> {
  const payload: PriorRecipientsPayload = { v: 1, dests };
  await AsyncStorage.setItem(key, JSON.stringify(payload));
}

export async function recordConfirmedRecipient(args: {
  cluster: SendCluster | null;
  owner: string | null | undefined;
  recipient: string;
  confirmation: 'confirmed' | 'uncertain';
}): Promise<void> {
  if (args.confirmation !== 'confirmed') return;

  const owner = canonicalizeOwner(args.owner);
  const dest = canonicalizeAddress(args.recipient);
  if (!args.cluster || !owner || !dest) return;

  const key = priorRecipientsStorageKey(args.cluster, owner);

  try {
    const existing = await readDests(key);
    if (existing === 'error') return;

    const dests = [...existing];

    const index = dests.indexOf(dest);
    if (index >= 0) {
      dests.splice(index, 1);
    }
    dests.push(dest);

    while (dests.length > PRIOR_RECIPIENTS_CAP) {
      dests.shift();
    }

    await writeDests(key, dests);
  } catch {
    // Fire-and-forget: send success must not depend on local history.
  }
}

export function sendNewRecipientAccessibility(input: {
  title: string;
  body: string;
}) {
  return {
    accessibilityRole: 'text' as const,
    accessibilityLabel: `${input.title}. ${input.body}`,
    accessibilityLiveRegion: 'polite' as const,
  };
}

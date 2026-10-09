import { isValidPriceMint } from "@/src/features/balances/priceSnapshot";
import {
  HEADS_UP_TIMEFRAMES,
  type HeadsUpTimeframe,
} from "./headsUpWatchTypes";
export type HeadsUpAction = "list" | "remove" | "inbox" | "create";
export type OwnedHeadsUpWatch = {
  id: string;
  walletAddress: string;
  mint: string;
  timeframe: HeadsUpTimeframe;
};
export type HeadsUpInboxEvent = OwnedHeadsUpWatch & {
  watchId: string;
  skillId: "heads_up";
  fromSide: "bear" | "neutral" | "bull";
  toSide: "bear" | "neutral" | "bull";
  observedAt: string;
  asOfMs: number;
  score: number;
  active: boolean;
  messageKey: "skills.heads_up.notify.flip";
};
export type HeadsUpScope = {
  walletAddress: string;
  action: HeadsUpAction;
  watchId?: string;
  mint?: string;
  timeframe?: HeadsUpTimeframe;
};
export function ownershipMessage(
  scope: HeadsUpScope,
  nonce: string,
  expiresAt: string,
): string {
  const path =
    scope.action === "inbox"
      ? "/v1/skills/heads-up/inbox"
      : "/v1/skills/heads-up/watches" +
        (scope.action === "remove" ? "/" + scope.watchId : "");
  return [
    "Corso Heads-Up ownership v1",
    "Network: mainnet-beta",
    `Action: ${scope.action}`,
    `Request: ${scope.action === "remove" ? "DELETE" : scope.action === "create" ? "POST" : "GET"} ${path}`,
    `Wallet: ${scope.walletAddress}`,
    ...(scope.action === "create"
      ? [`Mint: ${scope.mint}`, `Timeframe: ${scope.timeframe}`]
      : []),
    `Nonce: ${nonce}`,
    `Expires: ${expiresAt}`,
  ].join("\n");
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const id = (v: unknown): v is string =>
  typeof v === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(v);
export function isOwnedHeadsUpWatch(
  v: unknown,
  walletAddress?: string,
): v is OwnedHeadsUpWatch & Record<string, unknown> {
  return (
    record(v) &&
    id(v.id) &&
    typeof v.walletAddress === "string" &&
    (!walletAddress || v.walletAddress === walletAddress) &&
    isValidPriceMint(v.walletAddress, "mainnet-beta") &&
    typeof v.mint === "string" &&
    isValidPriceMint(v.mint, "mainnet-beta") &&
    HEADS_UP_TIMEFRAMES.some((tf) => tf === v.timeframe)
  );
}
export function isHeadsUpInboxEvent(
  v: unknown,
  walletAddress?: string,
): v is HeadsUpInboxEvent {
  const sides = ["bear", "neutral", "bull"];
  return (
    isOwnedHeadsUpWatch(v, walletAddress) &&
    record(v) &&
    id(v.watchId) &&
    v.skillId === "heads_up" &&
    v.messageKey === "skills.heads_up.notify.flip" &&
    typeof v.fromSide === "string" &&
    sides.includes(v.fromSide) &&
    typeof v.toSide === "string" &&
    sides.includes(v.toSide) &&
    v.fromSide !== v.toSide &&
    typeof v.observedAt === "string" &&
    Number.isFinite(Date.parse(v.observedAt)) &&
    typeof v.asOfMs === "number" &&
    Number.isSafeInteger(v.asOfMs) &&
    v.asOfMs >= 0 &&
    typeof v.score === "number" &&
    Number.isFinite(v.score) &&
    Math.abs(v.score) <= 100 &&
    typeof v.active === "boolean"
  );
}
export type HeadsUpAccessArgs = {
  walletAddress: string;
  signMessage(message: Uint8Array): Promise<Uint8Array>;
  assertCurrent(): void;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  apiBaseUrl?: string | null;
};
export async function headsUpProofHeaders(
  args: HeadsUpAccessArgs,
  scope: HeadsUpScope,
): Promise<Record<string, string>> {
  const { action, watchId } = scope;
  const base = (
    args.apiBaseUrl === undefined
      ? process.env.EXPO_PUBLIC_API_URL
      : args.apiBaseUrl
  )
    ?.trim()
    .replace(/\/$/, "");
  if (
    !base ||
    !isValidPriceMint(args.walletAddress, "mainnet-beta") ||
    scope.walletAddress !== args.walletAddress ||
    (action === "create" &&
      (!scope.mint ||
        !isValidPriceMint(scope.mint, "mainnet-beta") ||
        !HEADS_UP_TIMEFRAMES.some((tf) => tf === scope.timeframe))) ||
    (action === "remove" && !id(watchId))
  )
    throw new Error("Heads-Up unavailable.");
  const assertCurrent = () => {
    if (args.signal?.aborted) throw new Error("Heads-Up request canceled.");
    args.assertCurrent();
  };
  const fetchImpl = args.fetchImpl ?? globalThis.fetch;
  assertCurrent();
  const challengeResponse = await fetchImpl(
    base + "/v1/skills/heads-up/ownership",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(scope),
      signal: args.signal,
    },
  );
  assertCurrent();
  if (!challengeResponse.ok) throw new Error("Heads-Up unavailable.");
  const c: unknown = await challengeResponse.json();
  assertCurrent();
  if (
    !record(c) ||
    typeof c.nonce !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(c.nonce) ||
    typeof c.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(c.expiresAt)) ||
    new Date(c.expiresAt).toISOString() !== c.expiresAt ||
    Date.parse(c.expiresAt) <= Date.now() ||
    Date.parse(c.expiresAt) > Date.now() + 130_000 ||
    c.message !== ownershipMessage(scope, c.nonce, c.expiresAt)
  )
    throw new Error("Invalid Heads-Up challenge.");
  const signature = await args.signMessage(Buffer.from(c.message as string));
  assertCurrent();
  if (signature.length !== 64 || Date.parse(c.expiresAt) <= Date.now())
    throw new Error("Invalid Heads-Up proof.");
  return {
    "x-corso-wallet": args.walletAddress,
    "x-corso-nonce": c.nonce,
    "x-corso-signature": Buffer.from(signature).toString("base64"),
  };
}
async function request(
  args: HeadsUpAccessArgs,
  action: "list" | "remove" | "inbox",
  watchId?: string,
): Promise<unknown> {
  const base = (
    args.apiBaseUrl === undefined
      ? process.env.EXPO_PUBLIC_API_URL
      : args.apiBaseUrl
  )
    ?.trim()
    .replace(/\/$/, "");
  const assertCurrent = () => {
    if (args.signal?.aborted) throw new Error("Heads-Up request canceled.");
    args.assertCurrent();
  };
  const headers = await headsUpProofHeaders(args, {
    walletAddress: args.walletAddress,
    action,
    ...(watchId ? { watchId } : {}),
  });
  assertCurrent();
  const path =
    action === "inbox"
      ? "/v1/skills/heads-up/inbox"
      : "/v1/skills/heads-up/watches" + (watchId ? "/" + watchId : "");
  const response = await (args.fetchImpl ?? globalThis.fetch)(base + path, {
    method: action === "remove" ? "DELETE" : "GET",
    signal: args.signal,
    headers: { accept: "application/json", ...headers },
  });
  assertCurrent();
  if (!response.ok) throw new Error("Heads-Up unavailable.");
  const value: unknown = await response.json();
  assertCurrent();
  return value;
}
export async function listHeadsUpWatches(
  args: HeadsUpAccessArgs,
): Promise<OwnedHeadsUpWatch[]> {
  const value = await request(args, "list");
  if (
    !record(value) ||
    !Array.isArray(value.watches) ||
    value.watches.length > 1000 ||
    !value.watches.every((w) => isOwnedHeadsUpWatch(w, args.walletAddress))
  )
    throw new Error("Invalid Heads-Up watches.");
  return value.watches;
}
export async function readHeadsUpInbox(
  args: HeadsUpAccessArgs,
): Promise<HeadsUpInboxEvent[]> {
  const value = await request(args, "inbox");
  if (
    !record(value) ||
    !Array.isArray(value.events) ||
    value.events.length > 100 ||
    !value.events.every((e) => isHeadsUpInboxEvent(e, args.walletAddress))
  )
    throw new Error("Invalid Heads-Up inbox.");
  return value.events;
}
export async function removeHeadsUpWatch(
  args: HeadsUpAccessArgs,
  watchId: string,
): Promise<void> {
  const value = await request(args, "remove", watchId);
  if (!record(value) || value.ok !== true || typeof value.removed !== "boolean")
    throw new Error("Invalid Heads-Up removal.");
}

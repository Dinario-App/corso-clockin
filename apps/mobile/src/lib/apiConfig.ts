import { scrubProviderErrorMessage } from '@/src/lib/analyticsScrub';
import type { StatusScope } from '@/src/features/ramp/statusAuthorization';
import { resolveAssetAccess } from '@/src/features/security/assetAccessGate';
import {
  parseByoAiFlags,
  type ByoAiFlags,
} from '@/src/features/aiConnect/flags';

export type PublicAppConfig = {
  rampEnvironment?: 'sandbox' | 'production';
  feeBps: number;
  cluster: 'devnet' | 'mainnet-beta';
  rpcUrls: string[];
  /**
   * Jurisdiction the API observed from the connecting address, e.g. `US-CA`.
   * Absent when it could not determine one. Server-observed rather than
   * device-reported, because a device region is user-editable.
   */
  jurisdiction?: string | null;
  /** Currentness of the API-owned jurisdiction observation. */
  jurisdictionStatus?: 'resolved' | 'unknown' | 'stale';
  flags: {
    swapEnabled: boolean;
    sendEnabled: boolean;
    rampEnabled: boolean;
    /** USDC Buy — fail-closed unless API serves true (FLAG_RAMP && FLAG_RAMP_USDC). */
    rampUsdcEnabled: boolean;
    connectWalletEnabled: boolean;
    /**
     * Price BFF kill switch (API FLAG_PRICES → flags.pricesEnabled).
     * Fail-closed until the API explicitly serves true.
     */
    pricesEnabled: boolean;
    skillsEnabled: boolean;
    /**
     * Asset-class and jurisdiction gate. Default **off**, and unusually so:
     * the gate itself is fail-closed, so enforcing it before a jurisdiction
     * source exists refuses every swap rather than protecting anyone. Flip on
     * once `jurisdiction` below is actually served.
     */
    jurisdictionGateEnabled: boolean;
    /**
     * TokenFacts kill switch (API FLAG_TOKEN_FACTS → flags.tokenFactsEnabled).
     * Fail-closed: off until the API explicitly serves true.
     */
    tokenFactsEnabled: boolean;
    /** Watch-only routines are absent unless the API explicitly serves true. */
    routinesEnabled: boolean;
    routineArmingEnabled?: boolean;
    askEnabled?: boolean;
    signalsEnabled?: boolean;
    byoAiEnabled?: boolean;
    byoAiChatgptEnabled?: boolean;
    byoAiClaudeEnabled?: boolean;
    byoAiGrokEnabled?: boolean;
    autopilotEnabled?: boolean;
    autopilotGlobalPause?: boolean;
    botsEnabled?: boolean;
    /**
     * Fresh bonded-pair Discovery (API FLAG_DISCOVERY && FLAG_PRICES →
     * flags.discoveryEnabled). Fail-closed: absent or false mounts no
     * Discover route and issues no discovery fetch.
     */
    discoveryEnabled?: boolean;
    lunarcrushEnabled?: boolean;
  };
  security?: {
    stepUpThresholdSol: number;
    stepUpRequired: boolean;
  };
};
/** No fallback network: status authority needs both fields from this config read. */
export async function resolveRampStatusScope(owner: string): Promise<StatusScope | null> {
  const raw = process.env.EXPO_PUBLIC_API_URL;
  if (!raw) return null;
  let audience: string;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    audience = url.origin;
  } catch { return null; }
  const config = await fetchPublicConfig();
  const cluster = parseCluster(config?.cluster);
  const environment = config?.rampEnvironment;
  if (!cluster || (environment !== 'sandbox' && environment !== 'production')) return null;
  return { audience, owner, environment, cluster };
}

export type StepUpPolicy = {
  stepUpThresholdSol: number;
  stepUpRequired: boolean;
};

export const STEP_UP_FAIL_CLOSED_FLOOR: StepUpPolicy = {
  stepUpThresholdSol: 0.05,
  stepUpRequired: true,
};

/** In-memory last-known-good security policy from a successful /v1/config parse. */
let lastKnownGoodStepUpPolicy: StepUpPolicy | null = null;

export function __resetStepUpPolicyCacheForTests(): void {
  lastKnownGoodStepUpPolicy = null;
}

export function __getLastKnownGoodStepUpPolicyForTests(): StepUpPolicy | null {
  return lastKnownGoodStepUpPolicy ? { ...lastKnownGoodStepUpPolicy } : null;
}

/**
 * Pure policy resolution: validated fetch → LKG → fail-closed floor.
 * A weaker online value never overwrites LKG when the fetch fails.
 */
export function resolveSecurityPolicyFromSources(args: {
  fetched: StepUpPolicy | null;
  lastKnownGood: StepUpPolicy | null;
  floor?: StepUpPolicy;
}): { policy: StepUpPolicy; nextLastKnownGood: StepUpPolicy | null } {
  const floor = args.floor ?? STEP_UP_FAIL_CLOSED_FLOOR;
  if (args.fetched) {
    return {
      policy: { ...args.fetched },
      nextLastKnownGood: { ...args.fetched },
    };
  }
  if (args.lastKnownGood) {
    return {
      policy: { ...args.lastKnownGood },
      nextLastKnownGood: { ...args.lastKnownGood },
    };
  }
  return {
    policy: { ...floor },
    nextLastKnownGood: null,
  };
}

export function parseStepUpPolicy(security: unknown): StepUpPolicy | null {
  if (!security || typeof security !== 'object') return null;
  const threshold = (security as { stepUpThresholdSol?: unknown })
    .stepUpThresholdSol;
  const required = (security as { stepUpRequired?: unknown }).stepUpRequired;
  if (
    typeof threshold === 'number' &&
    Number.isFinite(threshold) &&
    threshold > 0 &&
    typeof required === 'boolean'
  ) {
    return { stepUpThresholdSol: threshold, stepUpRequired: required };
  }
  return null;
}

export const FALLBACK_DEVNET_RPC_URLS = [
  'https://api.devnet.solana.com',
  'https://rpc.ankr.com/solana_devnet',
] as const;
export const FALLBACK_CLUSTER: PublicAppConfig['cluster'] = 'devnet';

function apiBaseUrl(): string | null {
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, '');
}

function parseRpcUrls(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const urls = value.filter(
    (item): item is string => typeof item === 'string' && item.length > 0,
  );
  return urls.length > 0 ? urls : null;
}

function parseCluster(value: unknown): PublicAppConfig['cluster'] | null {
  if (value === 'devnet' || value === 'mainnet-beta') return value;
  return null;
}

let inFlightPublicConfig: Promise<Partial<PublicAppConfig> | null> | null =
  null;

export const PUBLIC_CONFIG_TIMEOUT_MS = 8_000;

async function fetchPublicConfigUncached(): Promise<Partial<PublicAppConfig> | null> {
  const base = apiBaseUrl();
  if (!base) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn(
        '[apiConfig] EXPO_PUBLIC_API_URL missing. Ramp fail-closed.',
      );
    }
    return null;
  }

  const controller = new AbortController();
  const deadline = setTimeout(
    () => controller.abort(),
    PUBLIC_CONFIG_TIMEOUT_MS,
  );
  try {
    const response = await fetch(`${base}/v1/config`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`config HTTP ${response.status}`);
    }
    return (await response.json()) as Partial<PublicAppConfig>;
  } catch (error) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // #8: never log raw provider/wallet error bodies (may embed txs/tokens).
      console.warn(
        '[apiConfig] GET /v1/config failed',
        base,
        scrubProviderErrorMessage(error),
      );
    }
    return null;
  } finally {
    clearTimeout(deadline);
  }
}

/**
 * Coalesce concurrent config consumers onto one response object.
 *
 * `/buy` resolves five inputs together. Sharing the in-flight promise makes
 * those inputs one decision snapshot while still allowing the next screen or
 * refresh to fetch a new response after this request settles.
 */
async function fetchPublicConfig(): Promise<Partial<PublicAppConfig> | null> {
  if (inFlightPublicConfig) return inFlightPublicConfig;
  const request = fetchPublicConfigUncached();
  inFlightPublicConfig = request;
  try {
    return await request;
  } finally {
    if (inFlightPublicConfig === request) inFlightPublicConfig = null;
  }
}

function buyInputsAreResolved(body: Partial<PublicAppConfig> | null): boolean {
  if (!body || body.jurisdictionStatus !== 'resolved') return false;
  if (body.flags?.jurisdictionGateEnabled !== true) return false;
  if (
    parseCluster(body.cluster) === null ||
    parseRpcUrls(body.rpcUrls) === null
  ) {
    return false;
  }
  const jurisdiction = body.jurisdiction;
  if (typeof jurisdiction !== 'string' || jurisdiction.trim() === '') {
    return false;
  }
  return resolveAssetAccess({
    assetClass: 'digital-commodity',
    jurisdiction,
    action: 'acquire',
  }).allowed;
}

export type NetworkStatus =
  | {
      state: 'known';
      cluster: PublicAppConfig['cluster'];
      rpcUrls: string[];
      source: 'server' | 'last_known_good';
    }
  | {
      state: 'unknown';
      reason: 'config_unreachable' | 'cluster_absent' | 'rpc_urls_absent';
    };

/** A cluster and the RPC URLs that serve it. Only ever stored as a pair. */
export type NetworkIdentity = {
  cluster: PublicAppConfig['cluster'];
  rpcUrls: string[];
};

export function resolveNetworkStatusFromSources(args: {
  /** Validated cluster from a reachable config, else `null`. */
  fetchedCluster: PublicAppConfig['cluster'] | null;
  /** Validated non-empty RPC URL list from a reachable config, else `null`. */
  fetchedRpcUrls: string[] | null;
  /** Whether `/v1/config` answered at all. Separates the unknown reasons. */
  configReachable: boolean;
  lastKnownGood: NetworkIdentity | null;
}): NetworkStatus {
  // A real answer is a real decision — but only when the pair is complete.
  if (args.fetchedCluster !== null && args.fetchedRpcUrls !== null) {
    return {
      state: 'known',
      cluster: args.fetchedCluster,
      rpcUrls: [...args.fetchedRpcUrls],
      source: 'server',
    };
  }

  if (args.lastKnownGood) {
    return {
      state: 'known',
      cluster: args.lastKnownGood.cluster,
      rpcUrls: [...args.lastKnownGood.rpcUrls],
      source: 'last_known_good',
    };
  }

  if (!args.configReachable) {
    return { state: 'unknown', reason: 'config_unreachable' };
  }
  return {
    state: 'unknown',
    reason: args.fetchedCluster === null ? 'cluster_absent' : 'rpc_urls_absent',
  };
}

export function clusterOrFallbackFromStatus(
  status: NetworkStatus,
): PublicAppConfig['cluster'] {
  return status.state === 'known' ? status.cluster : FALLBACK_CLUSTER;
}

/**
 * Collapse a status to the RPC URL list the existing callers still take.
 *
 * Same reasoning and the same caveat as `clusterOrFallbackFromStatus`: this
 * preserves today's answer for callers that only need *an* endpoint, and is
 * wrong for a caller whose read is only meaningful on a specific network.
 */
export function rpcUrlsOrFallbackFromStatus(status: NetworkStatus): string[] {
  return status.state === 'known'
    ? [...status.rpcUrls]
    : [...FALLBACK_DEVNET_RPC_URLS];
}

/** Last seen cluster/RPC pair, so an outage cannot silently switch networks. */
let lastKnownGoodNetwork: NetworkIdentity | null = null;

type NetworkReportMark = {
  reason: Extract<NetworkStatus, { state: 'unknown' }>['reason'];
  at: number;
};

let lastNetworkReport: NetworkReportMark | null = null;

export function __resetNetworkCacheForTests(): void {
  lastKnownGoodNetwork = null;
  lastNetworkReport = null;
}

export function __getLastKnownGoodNetworkForTests(): NetworkIdentity | null {
  return lastKnownGoodNetwork;
}

/** Sink for `unknown` reports. Installed at the composition root. */
export type NetworkStatusReporter = (
  status: Extract<NetworkStatus, { state: 'unknown' }>,
) => void;

let networkStatusReporter: NetworkStatusReporter | null = null;

export function setNetworkStatusReporter(
  reporter: NetworkStatusReporter | null,
): void {
  networkStatusReporter = reporter;
}

/** Heartbeat interval for a *continuing* unknown network. Matches the others. */
export const NETWORK_UNKNOWN_REPORT_INTERVAL_MS = 15 * 60 * 1000;

export function shouldReportNetworkUnknown(args: {
  reason: NetworkReportMark['reason'];
  now: number;
  last: NetworkReportMark | null;
  intervalMs?: number;
}): boolean {
  const interval = args.intervalMs ?? NETWORK_UNKNOWN_REPORT_INTERVAL_MS;
  if (!args.last) return true; // first sight
  if (args.last.reason !== args.reason) return true; // the situation changed
  return args.now - args.last.at >= interval; // same unknown reason: report again after the heartbeat interval
}

/**
 * Report an unknown network status. Never throws — a failing report must not
 * become a failing balance read.
 *
 * There is **no silent branch**. If no sink is installed this still warns on
 * the console, because a reporting path that can be switched off by forgetting
 * to wire it is the same evaporation bug one level up.
 */
export function reportNetworkStatus(
  status: NetworkStatus,
  now: number = Date.now(),
): void {
  if (status.state !== 'unknown') {
    // A real signal returned. Re-arm, so the next gap reports immediately
    // rather than being swallowed by a stale heartbeat window.
    lastNetworkReport = null;
    return;
  }
  if (
    !shouldReportNetworkUnknown({
      reason: status.reason,
      now,
      last: lastNetworkReport,
    })
  ) {
    return;
  }
  lastNetworkReport = { reason: status.reason, at: now };
  try {
    if (networkStatusReporter) {
      networkStatusReporter(status);
      return;
    }
    // eslint-disable-next-line no-console
    console.warn(
      '[apiConfig] network identity unknown — cluster and RPC cannot be trusted',
      status.reason,
    );
  } catch {
    // Reporting is best-effort. The status is still returned to the caller.
  }
}

/**
 * Resolve the cluster/RPC pair and report it when it is `unknown`.
 *
 * ⚠️ The report POSTs to the same API that is unreachable in the
 * `config_unreachable` case, so that leg will not arrive during a full outage.
 * It does land for `cluster_absent` / `rpc_urls_absent`. See
 * `networkTelemetry.ts`.
 */
export async function resolveNetworkStatus(): Promise<NetworkStatus> {
  return networkStatusFromConfigBody(await fetchPublicConfig());
}

function networkStatusFromConfigBody(
  body: Partial<PublicAppConfig> | null,
): NetworkStatus {
  const fetchedCluster = body ? parseCluster(body.cluster) : null;
  const fetchedRpcUrls = body ? parseRpcUrls(body.rpcUrls) : null;

  if (fetchedCluster !== null && fetchedRpcUrls !== null) {
    lastKnownGoodNetwork = {
      cluster: fetchedCluster,
      rpcUrls: [...fetchedRpcUrls],
    };
  }

  const status = resolveNetworkStatusFromSources({
    fetchedCluster,
    fetchedRpcUrls,
    configReachable: body !== null,
    lastKnownGood: lastKnownGoodNetwork,
  });

  reportNetworkStatus(status);
  return status;
}

/**
 * Resolve RPC URLs for client reads.
 * Prefers pulse-api `/v1/config`, then last-known-good, then public devnet RPC.
 */
export async function resolveRpcUrls(): Promise<string[]> {
  return rpcUrlsOrFallbackFromStatus(await resolveNetworkStatus());
}

export async function resolveCluster(): Promise<PublicAppConfig['cluster']> {
  return clusterOrFallbackFromStatus(await resolveNetworkStatus());
}

/** The two flags that gate a money movement. Same shape, same failure mode. */
export type MoneyDoor = 'swap' | 'send';

/** Wire field on `flags` for each door. */
const MONEY_DOOR_FLAG: Record<MoneyDoor, 'swapEnabled' | 'sendEnabled'> = {
  swap: 'swapEnabled',
  send: 'sendEnabled',
};

export type MoneyDoorStatus =
  | { state: 'enabled'; source: 'server' | 'last_known_good' }
  | { state: 'disabled'; source: 'server' | 'last_known_good' }
  | { state: 'unknown'; reason: 'config_unreachable' | 'flag_absent' };

/**
 * Pure status resolution: validated fetch → last-known-good → `unknown`.
 *
 * Deliberately identical in shape to `resolveJurisdictionGateStatusFromSources`
 * and, underneath both, to `resolveSecurityPolicyFromSources`: a weaker value
 * never overwrites a validated one just because the network failed.
 *
 * The terminal branch differs from the gate's only in what the *caller* does
 * with it — see `moneyDoorOpenFromStatus`.
 */
export function resolveMoneyDoorStatusFromSources(args: {
  /** Validated boolean from a reachable config, else `null`. */
  fetched: boolean | null;
  /** Whether `/v1/config` answered at all. Separates the two unknown reasons. */
  configReachable: boolean;
  lastKnownGood: boolean | null;
}): MoneyDoorStatus {
  // A real answer is a real decision — including an explicit `false`.
  if (args.fetched === true) return { state: 'enabled', source: 'server' };
  if (args.fetched === false) return { state: 'disabled', source: 'server' };

  if (args.lastKnownGood === true) {
    return { state: 'enabled', source: 'last_known_good' };
  }
  if (args.lastKnownGood === false) {
    return { state: 'disabled', source: 'last_known_good' };
  }

  return {
    state: 'unknown',
    reason: args.configReachable ? 'flag_absent' : 'config_unreachable',
  };
}

/**
 * Collapse a status to the boolean the Swap/Send callers still take.
 *
 * ⚠️ **`unknown` collapses to `true` — open.** That is deliberate and it is
 * unchanged from today, for the documented reason: *a dead API does not brick
 * an otherwise healthy wallet.* A user who has never once reached config must
 * still be able to move their own money.
 *
 * What changed is only that `disabled` can now be reached from
 * `last_known_good`. Never-configured still opens; deliberately-shut now stays
 * shut. The point of routing through a named function is that a caller can no
 * longer treat `unknown` as `enabled` by accident — doing it requires naming
 * this function, and deleting the report above it is now a visible deletion
 * rather than an invisible default.
 */
export function moneyDoorOpenFromStatus(status: MoneyDoorStatus): boolean {
  return status.state !== 'disabled';
}

/** Last seen flag per door, so an outage cannot silently undo a kill switch. */
const lastKnownGoodMoneyDoor: Record<MoneyDoor, boolean | null> = {
  swap: null,
  send: null,
};

type MoneyDoorReportMark = {
  reason: Extract<MoneyDoorStatus, { state: 'unknown' }>['reason'];
  at: number;
};

const lastMoneyDoorReport: Record<MoneyDoor, MoneyDoorReportMark | null> = {
  swap: null,
  send: null,
};

export function __resetMoneyDoorCacheForTests(): void {
  lastKnownGoodMoneyDoor.swap = null;
  lastKnownGoodMoneyDoor.send = null;
  lastMoneyDoorReport.swap = null;
  lastMoneyDoorReport.send = null;
}

export function __getLastKnownGoodMoneyDoorForTests(
  door: MoneyDoor,
): boolean | null {
  return lastKnownGoodMoneyDoor[door];
}

/** Sink for `unknown` reports. Installed at the composition root. */
export type MoneyDoorStatusReporter = (
  door: MoneyDoor,
  status: Extract<MoneyDoorStatus, { state: 'unknown' }>,
) => void;

let moneyDoorStatusReporter: MoneyDoorStatusReporter | null = null;

export function setMoneyDoorStatusReporter(
  reporter: MoneyDoorStatusReporter | null,
): void {
  moneyDoorStatusReporter = reporter;
}

/** Heartbeat interval for a *continuing* unknown door. Matches the gate's. */
export const MONEY_DOOR_UNKNOWN_REPORT_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Edge-triggered, with a heartbeat. Reports immediately when the situation
 * changes (first sight, or the reason flips), then at most once per interval
 * while it persists — so the duration of the gap stays measurable without one
 * event per Home mount.
 *
 * Pure, so the throttle is testable without a clock or a network.
 */
export function shouldReportMoneyDoorUnknown(args: {
  reason: MoneyDoorReportMark['reason'];
  now: number;
  last: MoneyDoorReportMark | null;
  intervalMs?: number;
}): boolean {
  const interval = args.intervalMs ?? MONEY_DOOR_UNKNOWN_REPORT_INTERVAL_MS;
  if (!args.last) return true; // first sight
  if (args.last.reason !== args.reason) return true; // the situation changed
  return args.now - args.last.at >= interval; // same unknown reason: report again after the heartbeat interval
}

/**
 * Report an unknown door status. Never throws — a failing report must not
 * become a failing send.
 *
 * There is **no silent branch**. If no sink is installed this still warns on
 * the console, because a reporting path that can be switched off by forgetting
 * to wire it is the same evaporation bug one level up.
 */
export function reportMoneyDoorStatus(
  door: MoneyDoor,
  status: MoneyDoorStatus,
  now: number = Date.now(),
): void {
  if (status.state !== 'unknown') {
    // A real signal returned. Re-arm, so the next gap reports immediately
    // rather than being swallowed by a stale heartbeat window.
    lastMoneyDoorReport[door] = null;
    return;
  }
  if (
    !shouldReportMoneyDoorUnknown({
      reason: status.reason,
      now,
      last: lastMoneyDoorReport[door],
    })
  ) {
    return;
  }
  lastMoneyDoorReport[door] = { reason: status.reason, at: now };
  try {
    if (moneyDoorStatusReporter) {
      moneyDoorStatusReporter(door, status);
      return;
    }
    // eslint-disable-next-line no-console
    console.warn(
      '[apiConfig] money door kill switch unknown — defaulting open',
      door,
      status.reason,
    );
  } catch {
    // Reporting is best-effort. The status is still returned to the caller.
  }
}

/**
 * Resolve a money door's status and report it when it is `unknown`.
 *
 * ⚠️ The report POSTs to the same API that is unreachable in the
 * `config_unreachable` case, so that leg will not arrive during a full outage.
 * It does land for `flag_absent`. See `moneyDoorTelemetry.ts`.
 */
export async function resolveMoneyDoorStatus(
  door: MoneyDoor,
): Promise<MoneyDoorStatus> {
  const body = await fetchPublicConfig();
  const flag = body?.flags?.[MONEY_DOOR_FLAG[door]];
  const fetched = typeof flag === 'boolean' ? flag : null;

  if (fetched !== null) {
    lastKnownGoodMoneyDoor[door] = fetched;
  }

  const status = resolveMoneyDoorStatusFromSources({
    fetched,
    configReachable: body !== null,
    lastKnownGood: lastKnownGoodMoneyDoor[door],
  });

  reportMoneyDoorStatus(door, status);
  return status;
}

/**
 * Kill switch for Send. Never-configured still defaults to enabled when config
 * is unreachable, so a dead API does not brick an otherwise healthy wallet — a
 * deliberately-served `false` is now held across an outage.
 */
export async function resolveSendEnabled(): Promise<boolean> {
  return moneyDoorOpenFromStatus(await resolveMoneyDoorStatus('send'));
}

/**
 * Kill switch for Swap. Never-configured still defaults to enabled when config
 * is unreachable (quote/execute still fail honestly if Jupiter is
 * unconfigured) — a deliberately-served `false` is now held across an outage.
 */
export async function resolveSwapEnabled(): Promise<boolean> {
  return moneyDoorOpenFromStatus(await resolveMoneyDoorStatus('swap'));
}

/** Last seen `jurisdictionGateEnabled`, so an outage cannot silently disarm it. */
let lastKnownGoodJurisdictionGate: boolean | null = null;

export function __resetJurisdictionGateCacheForTests(): void {
  lastKnownGoodJurisdictionGate = null;
  lastJurisdictionGateReport = null;
}

export async function resolveJurisdictionGateEnabled(): Promise<boolean> {
  const status = await resolveJurisdictionGateStatus();
  return jurisdictionGateEnforcedFromStatus(status);
}

export type JurisdictionGateStatus =
  | { state: 'enforced'; source: 'server' | 'last_known_good' }
  | { state: 'disarmed'; source: 'server' | 'last_known_good' }
  | { state: 'unknown'; reason: 'config_unreachable' | 'flag_absent' };

/**
 * Pure status resolution: validated fetch → last-known-good → `unknown`.
 *
 * Deliberately mirrors `resolveSecurityPolicyFromSources`. The difference is
 * the terminal branch: the step-up path has a safe floor to fall to
 * (`STEP_UP_FAIL_CLOSED_FLOOR`), and the jurisdiction gate has none, because a
 * gate enforced before any jurisdiction source exists refuses every user rather
 * than protecting anyone. So where step-up falls to a floor, this falls to
 * `unknown` — the honest answer, and the one that can be reported.
 */
export function resolveJurisdictionGateStatusFromSources(args: {
  /** Validated boolean from a reachable config, else `null`. */
  fetched: boolean | null;
  /** Whether `/v1/config` answered at all. Separates the two unknown reasons. */
  configReachable: boolean;
  lastKnownGood: boolean | null;
}): JurisdictionGateStatus {
  // A real answer is a real decision — including an explicit `false`.
  if (args.fetched === true) return { state: 'enforced', source: 'server' };
  if (args.fetched === false) return { state: 'disarmed', source: 'server' };

  if (args.lastKnownGood === true) {
    return { state: 'enforced', source: 'last_known_good' };
  }
  if (args.lastKnownGood === false) {
    return { state: 'disarmed', source: 'last_known_good' };
  }

  return {
    state: 'unknown',
    reason: args.configReachable ? 'flag_absent' : 'config_unreachable',
  };
}

/**
 * Collapse a status to the boolean the gate callers still take.
 *
 * `unknown` collapses to `false`, which is **exactly** today's behaviour and is
 * why this change is behaviour-preserving. The point is not that the value
 * changed; it is that the collapse now happens once, in a function with a name,
 * instead of silently at the bottom of a resolver. Deleting the report above it
 * is now a visible deletion rather than an invisible default.
 */
export function jurisdictionGateEnforcedFromStatus(
  status: JurisdictionGateStatus,
): boolean {
  return status.state === 'enforced';
}

/** Sink for `unknown` reports. Installed at the composition root. */
export type JurisdictionGateStatusReporter = (
  status: Extract<JurisdictionGateStatus, { state: 'unknown' }>,
) => void;

let jurisdictionGateStatusReporter: JurisdictionGateStatusReporter | null =
  null;

export function setJurisdictionGateStatusReporter(
  reporter: JurisdictionGateStatusReporter | null,
): void {
  jurisdictionGateStatusReporter = reporter;
}

export const JURISDICTION_GATE_UNKNOWN_REPORT_INTERVAL_MS = 15 * 60 * 1000;

type JurisdictionGateReportMark = {
  reason: Extract<JurisdictionGateStatus, { state: 'unknown' }>['reason'];
  at: number;
};

let lastJurisdictionGateReport: JurisdictionGateReportMark | null = null;

/**
 * Edge-triggered, with a heartbeat.
 *
 * Reports immediately when the situation *changes* (first sight, or the reason
 * flips between `flag_absent` and `config_unreachable`), then at most once per
 * interval while it persists. That keeps the duration of the gap measurable —
 * which is the thing worth knowing — without one event per swap confirm.
 *
 * Pure, so the throttle itself is testable without a clock or a network.
 */
export function shouldReportJurisdictionGateUnknown(args: {
  reason: JurisdictionGateReportMark['reason'];
  now: number;
  last: JurisdictionGateReportMark | null;
  intervalMs?: number;
}): boolean {
  const interval =
    args.intervalMs ?? JURISDICTION_GATE_UNKNOWN_REPORT_INTERVAL_MS;
  if (!args.last) return true; // first sight
  if (args.last.reason !== args.reason) return true; // the situation changed
  return args.now - args.last.at >= interval; // same unknown reason: report again after the heartbeat interval
}

/**
 * Report an unknown gate status. Never throws — a failing report must not
 * become a failing swap.
 *
 * There is **no silent branch**. If no sink is installed this still warns on
 * the console, because a reporting path that can be switched off by forgetting
 * to wire it is the same evaporation bug one level up.
 */
export function reportJurisdictionGateStatus(
  status: JurisdictionGateStatus,
  now: number = Date.now(),
): void {
  if (status.state !== 'unknown') {
    // A real signal returned. Re-arm, so the next gap reports immediately
    // rather than being swallowed by a stale heartbeat window.
    lastJurisdictionGateReport = null;
    return;
  }
  if (
    !shouldReportJurisdictionGateUnknown({
      reason: status.reason,
      now,
      last: lastJurisdictionGateReport,
    })
  ) {
    return;
  }
  lastJurisdictionGateReport = { reason: status.reason, at: now };
  try {
    if (jurisdictionGateStatusReporter) {
      jurisdictionGateStatusReporter(status);
      return;
    }
    // eslint-disable-next-line no-console
    console.warn(
      '[apiConfig] jurisdiction gate status unknown — the control is not operating',
      status.reason,
    );
  } catch {
    // Reporting is best-effort. The status is still returned to the caller.
  }
}

/**
 * Resolve the gate's status and report it when it is `unknown`.
 *
 * The report fires on every unknown resolution rather than once per process.
 * That is deliberate: deduping would mean an hour-long outage produced one
 * event, and the thing being measured is precisely *how long the control was
 * not operating*. `trackEvent` is already fire-and-forget and non-blocking.
 */
export async function resolveJurisdictionGateStatus(): Promise<JurisdictionGateStatus> {
  const body = await fetchPublicConfig();
  const flag = body?.flags?.jurisdictionGateEnabled;
  const fetched = typeof flag === 'boolean' ? flag : null;

  if (fetched !== null) {
    lastKnownGoodJurisdictionGate = fetched;
  }

  const status = resolveJurisdictionGateStatusFromSources({
    fetched,
    configReachable: body !== null,
    lastKnownGood: lastKnownGoodJurisdictionGate,
  });

  reportJurisdictionGateStatus(status);
  return status;
}

/**
 * The jurisdiction the API observed for this caller, from the connecting
 * address. `null` when it could not determine one.
 *
 * Server-observed rather than device-reported, because a device region is two
 * taps from being whatever the user wants it to be. It is still only one signal
 * — `jurisdictionResolver` combines it with others and takes the most
 * restrictive.
 */
export async function resolveObservedJurisdiction(): Promise<string | null> {
  const body = await fetchPublicConfig();
  const value = body?.jurisdiction;
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/**
 * Kill switch for Buy / ramp. Fail-closed when config is unreachable
 * so a dead API does not open an unconfigured partner checkout.
 */
export async function resolveRampEnabled(): Promise<boolean> {
  const body = await fetchPublicConfig();
  const flag = body?.flags?.rampEnabled;
  return flag === true && buyInputsAreResolved(body);
}

/**
 * Kill switch for USDC Buy. Fail-closed when missing/unreachable.
 * Does not enable USDC when only rampEnabled is true.
 */
export async function resolveRampUsdcEnabled(): Promise<boolean> {
  const body = await fetchPublicConfig();
  const flag = body?.flags?.rampUsdcEnabled;
  return flag === true && buyInputsAreResolved(body);
}

/**
 * Connect/MWA is deliberately fail-closed until Seeker support is shipped
 * and device-proven. Missing or unreachable config must hide the door.
 */
export async function resolveConnectEnabled(): Promise<boolean> {
  const body = await fetchPublicConfig();
  return body?.flags?.connectWalletEnabled === true;
}

export function parseRampFlags(flags: unknown): {
  rampEnabled: boolean;
  rampUsdcEnabled: boolean;
} {
  if (!flags || typeof flags !== 'object') {
    return { rampEnabled: false, rampUsdcEnabled: false };
  }
  const f = flags as {
    rampEnabled?: unknown;
    rampUsdcEnabled?: unknown;
  };
  return {
    rampEnabled: f.rampEnabled === true,
    rampUsdcEnabled: f.rampUsdcEnabled === true,
  };
}

export function parseConnectEnabled(flags: unknown): boolean {
  if (!flags || typeof flags !== 'object') return false;
  return (
    (flags as { connectWalletEnabled?: unknown }).connectWalletEnabled === true
  );
}

/** Pure prices kill-switch parse: only explicit `true`; missing → false. */
export function parsePricesEnabled(flags: unknown): boolean {
  if (!flags || typeof flags !== 'object') return false;
  return (flags as { pricesEnabled?: unknown }).pricesEnabled === true;
}

/** Pure Skills kill-switch parse: only explicit `true`; missing → false. */
export function parseSkillsEnabled(flags: unknown): boolean {
  if (!flags || typeof flags !== 'object') return false;
  return (flags as { skillsEnabled?: unknown }).skillsEnabled === true;
}

/** Pure Discovery kill-switch parse: only explicit `true`; missing → false. */
export function parseDiscoveryEnabled(flags: unknown): boolean {
  if (!flags || typeof flags !== 'object') return false;
  return (flags as { discoveryEnabled?: unknown }).discoveryEnabled === true;
}

export type DiscoveryConfig = {
  network: NetworkStatus;
  /** Explicit boolean from public config; never inferred true on outage. */
  discoveryEnabled: boolean;
  configReachable?: boolean;
};

/** One-fetch Discovery gate: network identity + `discoveryEnabled` from one `GET /v1/config`. */
export async function resolveDiscoveryConfig(): Promise<DiscoveryConfig> {
  const body = await fetchPublicConfig();
  return {
    network: networkStatusFromConfigBody(body),
    discoveryEnabled: parseDiscoveryEnabled(body?.flags),
    configReachable: body !== null,
  };
}

export function parseLunarcrushEnabled(flags: unknown): boolean {
  if (!flags || typeof flags !== 'object') return false;
  return (flags as { lunarcrushEnabled?: unknown }).lunarcrushEnabled === true;
}

export async function resolveLunarcrushEnabled(): Promise<boolean> {
  const body = await fetchPublicConfig();
  return parseLunarcrushEnabled(body?.flags);
}

/** Pure TokenFacts kill-switch parse: only explicit `true`; missing → false. */
export function parseTokenFactsEnabled(flags: unknown): boolean {
  if (!flags || typeof flags !== 'object') return false;
  return (flags as { tokenFactsEnabled?: unknown }).tokenFactsEnabled === true;
}

export function parseTokenVitalsEnabled(flags: unknown): boolean {
  if (!flags || typeof flags !== 'object') return false;
  return (flags as { signalsEnabled?: unknown }).signalsEnabled === true;
}

/**
 * Kill switch for Skills / DraftIntent surfaces. Fail-closed when missing
 * or unreachable so a dead API never invents Skills enablement.
 */
export async function resolveSkillsEnabled(): Promise<boolean> {
  const body = await fetchPublicConfig();
  return parseSkillsEnabled(body?.flags);
}

export async function resolveByoAiFlags(): Promise<ByoAiFlags> {
  const body = await fetchPublicConfig();
  return parseByoAiFlags(body?.flags);
}

export function parseAutopilotEnabled(_flags: unknown): boolean {
  return false;
}

/** Default-off autopilot flag. Missing or unreachable config stays off. */
export async function resolveAutopilotEnabled(): Promise<boolean> {
  const body = await fetchPublicConfig();
  return parseAutopilotEnabled(body?.flags);
}

export function parseBotsEnabled(flags: unknown): boolean {
  if (!flags || typeof flags !== 'object') return false;
  return (
    (flags as { botsEnabled?: unknown }).botsEnabled === true &&
    parseAutopilotEnabled(flags)
  );
}

/** Default-off automation flag. Missing or unreachable config stays off. */
export async function resolveBotsEnabled(): Promise<boolean> {
  const body = await fetchPublicConfig();
  return parseBotsEnabled(body?.flags);
}

export function parseAskEnabled(flags: unknown): boolean {
  if (!flags || typeof flags !== 'object') return false;
  return (flags as { askEnabled?: unknown }).askEnabled === true;
}

/** Default-off Ask flag. Missing or unreachable config stays off. */
export async function resolveAskEnabled(): Promise<boolean> {
  const body = await fetchPublicConfig();
  return parseAskEnabled(body?.flags);
}

/** Default-off routines flag. Missing or unreachable config stays off. */
export async function resolveRoutinesEnabled(): Promise<boolean> {
  const body = await fetchPublicConfig();
  return body?.flags?.routinesEnabled === true;
}

export async function resolveRoutineArmingEnabled(): Promise<boolean> {
  const body = await fetchPublicConfig();
  return body?.flags?.routineArmingEnabled === true;
}

export type PricesConfig = {
  /** The one network identity. Identical to `resolveNetworkStatus()`'s value. */
  network: NetworkStatus;
  /** Explicit boolean from public config; never inferred true on outage. */
  pricesEnabled: boolean;
};

/** Same shape and same reasoning as `PricesConfig`. See its note. */
export type TokenFactsConfig = {
  /** The one network identity. Identical to `resolveNetworkStatus()`'s value. */
  network: NetworkStatus;
  /** Explicit boolean from public config; never inferred true on outage. */
  tokenFactsEnabled: boolean;
};

/**
 * One-fetch prices gate: network identity + `pricesEnabled`, from one `GET`.
 *
 * ⚠️ **Still exactly one request, which is why this does not simply `await
 * resolveNetworkStatus()`.** Both halves come out of the same body through
 * `networkStatusFromConfigBody`, so the last-known-good pair and the unknown
 * report behave identically to a direct `resolveNetworkStatus()` call without
 * a second `GET /v1/config` on every prices refresh.
 *
 * ✅ **`pricesEnabled` is fail-closed and unchanged.** `parsePricesEnabled`
 * returns `false` for a `null` body, a missing `flags`, and any non-`true`
 * value, so an unreachable config still yields `false` exactly as before. That
 * behaviour is load-bearing — `useMoving` reserves nothing until it answers —
 * and nothing here weakens it.
 */
export async function resolvePricesConfig(): Promise<PricesConfig> {
  const body = await fetchPublicConfig();
  return {
    network: networkStatusFromConfigBody(body),
    pricesEnabled: parsePricesEnabled(body?.flags),
  };
}

/**
 * One-fetch TokenFacts gate: network identity + `tokenFactsEnabled`, one `GET`.
 * Same construction and same fail-closed guarantee as `resolvePricesConfig`.
 */
export async function resolveTokenFactsConfig(): Promise<TokenFactsConfig> {
  const body = await fetchPublicConfig();
  return {
    network: networkStatusFromConfigBody(body),
    tokenFactsEnabled: parseTokenFactsEnabled(body?.flags),
  };
}

/** Same shape and same reasoning as `TokenFactsConfig`. See its note. */
export type TokenVitalsConfig = {
  /** The one network identity. Identical to `resolveNetworkStatus()`'s value. */
  network: NetworkStatus;
  /** Explicit boolean from public config; never inferred true on outage. */
  tokenVitalsEnabled: boolean;
};

export async function resolveTokenVitalsConfig(): Promise<TokenVitalsConfig> {
  const body = await fetchPublicConfig();
  return {
    network: networkStatusFromConfigBody(body),
    tokenVitalsEnabled: parseTokenVitalsEnabled(body?.flags),
  };
}

export async function resolveTokenVitalsEnabled(): Promise<boolean> {
  return (await resolveTokenVitalsConfig()).tokenVitalsEnabled;
}

/** Why the platform fee cannot be established. */
export type FeeBpsUnknownReason =
  /** `/v1/config` did not answer, or `EXPO_PUBLIC_API_URL` is unset. */
  | 'config_unreachable'
  /** The API answered, but served no `feeBps` at all. */
  | 'fee_absent'
  /** The API answered with a `feeBps` that is not a bps value. */
  | 'fee_invalid';

export type FeeBpsStatus =
  | { state: 'known'; bps: number }
  | { state: 'unknown'; reason: FeeBpsUnknownReason };

/**
 * A fee is a bps integer in `[0, 10_000]`.
 *
 * ⚠️ **Stricter than the check it replaces, on purpose.** The old
 * `resolveFeeBps` accepted any `Number.isFinite` value, so `85.5` or `-1` from
 * a malformed payload passed straight through — and then
 * `resolveDisplayCorsoFeeBps` rejected them anyway and rendered the placeholder.
 * Matching the display validator's domain here means `known` means renderable,
 * and a payload the display would refuse is reported rather than carried.
 */
function parseFeeBps(value: unknown): number | null {
  if (typeof value !== 'number') return null;
  if (!Number.isInteger(value) || value < 0 || value > 10_000) return null;
  return value;
}

export function feeBpsOrNullFromStatus(status: FeeBpsStatus): number | null {
  return status.state === 'known' ? status.bps : null;
}

type FeeBpsReportMark = { reason: FeeBpsUnknownReason; at: number };

let lastFeeBpsReport: FeeBpsReportMark | null = null;

export function __resetFeeBpsCacheForTests(): void {
  lastFeeBpsReport = null;
}

/** Sink for `unknown` fee reports. Installed at the composition root. */
export type FeeBpsStatusReporter = (
  status: Extract<FeeBpsStatus, { state: 'unknown' }>,
) => void;

let feeBpsStatusReporter: FeeBpsStatusReporter | null = null;

export function setFeeBpsStatusReporter(
  reporter: FeeBpsStatusReporter | null,
): void {
  feeBpsStatusReporter = reporter;
}

/** Heartbeat interval for a *continuing* unknown fee. Matches the others. */
export const FEE_BPS_UNKNOWN_REPORT_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Edge-triggered, with a heartbeat. Same shape as
 * `shouldReportNetworkUnknown`: report immediately when the situation changes
 * (first sight, or the reason flips), then at most once per interval while it
 * persists, so the duration of the gap stays measurable without one event per
 * swap-screen mount.
 *
 * ⚠️ Like the network event and unlike `flag_absent`, this is **not** expected
 * in the steady state. Production `/v1/config` serves `feeBps`, so a healthy
 * app resolves `known` and reports nothing. An event here means devices are
 * being shown a fee they cannot source.
 *
 * Pure, so the throttle is testable without a clock or a network.
 */
export function shouldReportFeeBpsUnknown(args: {
  reason: FeeBpsUnknownReason;
  now: number;
  last: FeeBpsReportMark | null;
  intervalMs?: number;
}): boolean {
  const interval = args.intervalMs ?? FEE_BPS_UNKNOWN_REPORT_INTERVAL_MS;
  if (!args.last) return true; // first sight
  if (args.last.reason !== args.reason) return true; // the situation changed
  return args.now - args.last.at >= interval; // same unknown reason: report again after the heartbeat interval
}

/**
 * Report an unknown fee. Never throws — a failing report must not become a
 * failing swap screen.
 *
 * There is **no silent branch**. If no sink is installed this still warns on
 * the console, because a reporting path that can be switched off by forgetting
 * to wire it is the same evaporation bug one level up.
 */
export function reportFeeBpsStatus(
  status: FeeBpsStatus,
  now: number = Date.now(),
): void {
  if (status.state !== 'unknown') {
    // A real fee returned. Re-arm, so the next gap reports immediately rather
    // than being swallowed by a stale heartbeat window.
    lastFeeBpsReport = null;
    return;
  }
  if (
    !shouldReportFeeBpsUnknown({
      reason: status.reason,
      now,
      last: lastFeeBpsReport,
    })
  ) {
    return;
  }
  lastFeeBpsReport = { reason: status.reason, at: now };
  try {
    if (feeBpsStatusReporter) {
      feeBpsStatusReporter(status);
      return;
    }
    // eslint-disable-next-line no-console
    console.warn(
      '[apiConfig] platform fee unknown — no fee may be shown',
      status.reason,
    );
  } catch {
    // Reporting is best-effort. The status is still returned to the caller.
  }
}

export async function resolveFeeBpsStatus(): Promise<FeeBpsStatus> {
  const body = await fetchPublicConfig();
  if (!body) {
    const status: FeeBpsStatus = {
      state: 'unknown',
      reason: 'config_unreachable',
    };
    reportFeeBpsStatus(status);
    return status;
  }
  if (body.feeBps == null) {
    const status: FeeBpsStatus = { state: 'unknown', reason: 'fee_absent' };
    reportFeeBpsStatus(status);
    return status;
  }
  const bps = parseFeeBps(body.feeBps);
  if (bps === null) {
    const status: FeeBpsStatus = { state: 'unknown', reason: 'fee_invalid' };
    reportFeeBpsStatus(status);
    return status;
  }
  const status: FeeBpsStatus = { state: 'known', bps };
  reportFeeBpsStatus(status);
  return status;
}

/**
 * High-value step-up policy.
 * Prefer live /v1/config → last-known-good → fail-closed floor.
 * Outage after a successful fetch must not weaken the threshold.
 */
export async function resolveStepUpPolicy(): Promise<StepUpPolicy> {
  const body = await fetchPublicConfig();
  const fetched = parseStepUpPolicy(body?.security);
  const resolved = resolveSecurityPolicyFromSources({
    fetched,
    lastKnownGood: lastKnownGoodStepUpPolicy,
  });
  lastKnownGoodStepUpPolicy = resolved.nextLastKnownGood;
  return resolved.policy;
}

/** Public unsigned ops state; no authorization or step-up. */
export async function resolveAutopilotGlobalPause(): Promise<boolean> {
  const body = await fetchPublicConfig();
  return body?.flags?.autopilotGlobalPause === true;
}

/** Unsigned public suspension reason. Missing config cannot claim a suspension. */
export async function resolveAutopilotSuspensionReason(): Promise<'flags' | 'global_pause' | null> {
  const body = await fetchPublicConfig();
  if (body?.flags?.autopilotEnabled === false || body?.flags?.botsEnabled === false) return 'flags';
  return body?.flags?.autopilotGlobalPause === true ? 'global_pause' : null;
}

/** Distinguishes unavailable config from an authoritative ramp-off response. */
export async function resolveRampConfigReachable(): Promise<boolean> {
  return (await fetchPublicConfig()) !== null;
}

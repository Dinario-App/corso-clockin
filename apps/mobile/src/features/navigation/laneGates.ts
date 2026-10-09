import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import {
  resolveBotsConfig,
  resolveBotsGuard,
  type BotsConfig,
} from '@/src/features/bots/botsGuard';
import {
  resolveFullChartRouteGuard,
  type FullChartConfig,
} from '@/src/features/signals/fullChartRouteGuard';
import {
  resolveSkillsDirectoryConfig,
  resolveSkillsDirectoryGuard,
  type SkillsDirectoryConfig,
} from '@/src/features/skills/directory/skillsDirectoryGuard';
import { resolveTokenVitalsConfig } from '@/src/lib/apiConfig';

/** The three lanes `app/_layout.tsx` registers behind `<Stack.Protected>`. */
export type LaneGateName = 'fullChart' | 'skills' | 'bots';

export type LaneGates = Readonly<Record<LaneGateName, boolean>>;

/** Every door shut. The value the snapshot starts at and falls back to. */
export const CLOSED_LANE_GATES: LaneGates = Object.freeze({
  fullChart: false,
  skills: false,
  bots: false,
});

export type LaneGatesSnapshot = {
  /**
   * `'loading'` until the first resolution lands. A chip that wants to say
   * something honest while the answer is outstanding reads this; a chip that
   * just wants a door reads `gates`, which is shut until it is not.
   */
  readonly status: 'loading' | 'ready';
  readonly gates: LaneGates;
  readonly autopilotEnabled: boolean;
  readonly revision: number;
};

/** The three raw configs one refresh collects, before any gate is decided. */
export type LaneGateConfigs = {
  readonly fullChart: FullChartConfig | null;
  readonly skills: SkillsDirectoryConfig | null;
  readonly bots: BotsConfig | null;
};

/**
 * The pure seam. Each lane keeps its OWN predicate — this function decides
 * nothing about flags, it only guarantees the three verdicts are taken from
 * one set of configs at one instant.
 */
export function resolveLaneGates(configs: LaneGateConfigs): LaneGates {
  return {
    fullChart: resolveFullChartRouteGuard(configs.fullChart),
    skills: resolveSkillsDirectoryGuard(configs.skills),
    bots: resolveBotsGuard(configs.bots),
  };
}

export function resolveAutopilotFromConfigs(configs: LaneGateConfigs): boolean {
  return false;
}

export const INITIAL_LANE_GATES_SNAPSHOT: LaneGatesSnapshot = Object.freeze({
  status: 'loading',
  gates: CLOSED_LANE_GATES,
  autopilotEnabled: false,
  revision: 0,
});

/**
 * Build the next snapshot from a resolution. Pure, so the store below is only
 * plumbing and every rule about what a gate may be is testable without React.
 */
export function nextLaneGatesSnapshot(
  current: LaneGatesSnapshot,
  configs: LaneGateConfigs,
): LaneGatesSnapshot {
  return Object.freeze({
    status: 'ready' as const,
    gates: Object.freeze(resolveLaneGates(configs)),
    autopilotEnabled: resolveAutopilotFromConfigs(configs),
    revision: current.revision + 1,
  });
}

// ── the store ───────────────────────────────────────────────────────────────

let snapshot: LaneGatesSnapshot = INITIAL_LANE_GATES_SNAPSHOT;
const listeners = new Set<() => void>();
/** One resolution in flight at a time; concurrent callers share it. */
let inFlight: Promise<LaneGatesSnapshot> | null = null;

export function getLaneGatesSnapshot(): LaneGatesSnapshot {
  return snapshot;
}

export function subscribeLaneGates(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function publish(next: LaneGatesSnapshot): void {
  snapshot = next;
  for (const listener of [...listeners]) listener();
}

export type LaneGateResolvers = {
  fullChart: () => Promise<FullChartConfig>;
  skills: () => Promise<SkillsDirectoryConfig>;
  bots: () => Promise<BotsConfig>;
};

const DEFAULT_RESOLVERS: LaneGateResolvers = {
  fullChart: resolveTokenVitalsConfig,
  skills: resolveSkillsDirectoryConfig,
  bots: resolveBotsConfig,
};

/**
 * Collect all three configs from ONE `/v1/config` read. They are issued
 * together on purpose: `fetchPublicConfig` coalesces concurrent reads, so
 * "together" is one request, and — the point of this module — one instant.
 *
 * A lane that throws contributes `null`, which its own predicate reads as a
 * shut gate. One lane's outage never opens another lane's door.
 */
export async function collectLaneGateConfigs(
  resolvers: LaneGateResolvers = DEFAULT_RESOLVERS,
): Promise<LaneGateConfigs> {
  const [fullChart, skills, bots] = await Promise.all([
    resolvers.fullChart().catch(() => null),
    resolvers.skills().catch(() => null),
    resolvers.bots().catch(() => null),
  ]);
  return { fullChart, skills, bots };
}

/**
 * Re-resolve every lane and publish one snapshot. Coalesced: a second call
 * while one is outstanding gets the same promise, so a foreground event
 * arriving during boot cannot produce two interleaved publishes.
 */
export function refreshLaneGates(
  resolvers: LaneGateResolvers = DEFAULT_RESOLVERS,
): Promise<LaneGatesSnapshot> {
  if (inFlight) return inFlight;
  const run = collectLaneGateConfigs(resolvers)
    /*
      ⚠️ The catch belongs to the COLLECT, not to the publish. Chained after
      `.then(publish)` it would also catch a listener throwing during
      notification, and answer that by publishing a SHUT snapshot over a good
      one — a subscriber's bug closing the app's doors, and a second publish
      nobody asked for. `collectLaneGateConfigs` already swallows per-lane
      rejections; this is the belt for the case where it somehow does not.
    */
    .catch(() => ({ fullChart: null, skills: null, bots: null }))
    .then((configs) => {
      const next = nextLaneGatesSnapshot(snapshot, configs);
      publish(next);
      return next;
    })
    .finally(() => {
      inFlight = null;
    });
  inFlight = run;
  return run;
}

export function resetLaneGatesForTest(): void {
  snapshot = INITIAL_LANE_GATES_SNAPSHOT;
  inFlight = null;
}

// ── the React bindings ──────────────────────────────────────────────────────

/**
 * Read the authoritative snapshot. This is the ONLY way a screen may learn
 * whether a protected lane is open — `app/_layout.tsx` registers the routes
 * from the same object, in the same commit.
 */
export function useLaneGates(): LaneGatesSnapshot {
  return useSyncExternalStore(
    subscribeLaneGates,
    getLaneGatesSnapshot,
    getLaneGatesSnapshot,
  );
}

/** Sugar for the common case: one lane's door. */
export function useLaneGate(lane: LaneGateName): boolean {
  return useLaneGates().gates[lane];
}

export function useLaneGatesHost(
  resolvers: LaneGateResolvers = DEFAULT_RESOLVERS,
): LaneGatesSnapshot {
  const gates = useLaneGates();
  useEffect(() => {
    const kick = () => {
      refreshLaneGates(resolvers).catch(() => {
        /* the snapshot is published; a listener's throw is that listener's */
      });
    };
    kick();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') kick();
    });
    return () => {
      subscription.remove();
    };
  }, [resolvers]);
  return gates;
}

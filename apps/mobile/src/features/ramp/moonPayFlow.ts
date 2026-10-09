import { copy } from '@/constants/copy';
import type { NetworkStatus } from '@/src/lib/apiConfig';
import {
  resolveBuyNetworkGate,
  buyMayContinueOnNetwork,
} from './buyNetworkGate';
import { runGatedBuyContinue as defaultRunGatedBuyContinue } from './buyGateContinue';
import {
  runBuyContinue,
  buyRampErrorMessages,
  type CreateRampSessionFn,
} from './buyContinueLogic';
import { resolveBuyGateDecision } from './buyGateContinue';
import { addCashCopy } from '@/constants/copy/addCash';
import type { RampAsset } from './rampAssets';
import {
  RAMP_RETURN_REFRESH_LIMIT_MS,
  type RampReturnHint,
} from './rampReturnRefresh';

export type MoonPayFlowDeps = {
  /** Null for a locked, missing, or unsupported wallet; checked after every await. */
  currentWallet: () => string | null;
  currentIdentity: () => string | null;
  loadConfig: () => Promise<{
    reachable?: boolean;
    enabled: boolean;
    usdcEnabled: boolean;
    gateEnabled: boolean;
    jurisdiction: string | null;
    network: NetworkStatus;
  }>;
  returnUrl: string | undefined;
  createSession: CreateRampSessionFn;
  openContainer: (url: string, returnUrl: string) => Promise<{ type: string }>;
  onOpened: (asset: RampAsset) => void;
  onReturned: (status: string, asset: RampAsset) => void;
  goHome: () => void;
  /** Clock for the retained return hint's age; defaults to Date.now. */
  now?: () => number;
  runGatedContinue?: typeof defaultRunGatedBuyContinue;
};
export type RampAvailability =
  | { status: 'ready' }
  | {
      status: 'offline' | 'disabled' | 'unsupported' | 'network' | 'region';
      message: string;
    };

export type MoonPayPending = { walletAddress: string; id: number };
export type MoonPaySnapshot = {
  active: {
    id: number;
    walletAddress: string;
    identity: string | null;
    asset: RampAsset;
    phase: 'loading' | 'widget' | 'error';
    error?: string;
    url?: string;
    returnUrl?: string;
  } | null;
  pending: MoonPayPending | null;
};

/** Memory-only, wallet-bound checkout lifecycle. No signed URL in routes or storage. */
export class MoonPayFlow {
  private state: MoonPaySnapshot = { active: null, pending: null };
  private sequence = 0;
  private listeners = new Set<() => void>();
  private returnListeners = new Set<(hint: RampReturnHint) => void>();
  /**
   * A hint no listener heard (the callback route runs before Home mounts).
   * Held for the next subscriber only while the same wallet is current and
   * for at most one refresh window; `reset()` (identity change, sign-out,
   * lock, provider unmount) drops it. It is a re-read request, never proof.
   */
  private retainedHint: { hint: RampReturnHint; atMs: number } | null = null;
  private finishBrowser: ((result: { type: string }) => void) | null = null;
  constructor(private deps: MoonPayFlowDeps) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  onReturnHint = (listener: (hint: RampReturnHint) => void) => {
    this.returnListeners.add(listener);
    const retained = this.retainedHint;
    this.retainedHint = null;
    if (
      retained &&
      retained.hint.walletAddress === this.deps.currentWallet() &&
      this.now() - retained.atMs < RAMP_RETURN_REFRESH_LIMIT_MS
    )
      listener(retained.hint);
    return () => {
      this.returnListeners.delete(listener);
    };
  };
  /** A return with no live checkout (cold callback) hints the current wallet only. */
  hintReturn = (asset: RampAsset | null = null) => {
    const walletAddress = this.deps.currentWallet();
    if (walletAddress) this.emitReturnHint({ walletAddress, asset });
  };
  private emitReturnHint(hint: RampReturnHint) {
    if (this.returnListeners.size === 0) {
      this.retainedHint = { hint, atMs: this.now() };
      return;
    }
    this.retainedHint = null;
    this.returnListeners.forEach((fn) => {
      fn(hint);
    });
  }
  private now() {
    return (this.deps.now ?? Date.now)();
  }
  private set(state: MoonPaySnapshot) {
    this.state = state;
    this.listeners.forEach((fn) => {
      fn();
    });
  }
  private current(id: number, wallet: string) {
    return (
      this.state.active?.id === id &&
      this.deps.currentWallet() === wallet &&
      this.state.active.identity === this.deps.currentIdentity()
    );
  }
  open = (
    asset: RampAsset = 'SOL',
    options?: { baseCurrencyAmount?: number },
  ) => {
    if (this.state.active) return;
    const walletAddress = this.deps.currentWallet();
    const id = ++this.sequence;
    this.set({
      ...this.state,
      active: {
        id,
        walletAddress: walletAddress ?? '',
        identity: this.deps.currentIdentity(),
        asset,
        phase: walletAddress ? 'loading' : 'error',
        ...(walletAddress ? {} : { error: copy.buy.authDoorUnsupported }),
      },
    });
    if (walletAddress)
      void this.start(id, walletAddress, asset, options?.baseCurrencyAmount);
  };
  close = () => {
    if (this.state.active?.phase === 'widget') {
      this.returned('dismiss');
      return;
    }
    this.finishBrowser?.({ type: 'cancel' });
    this.finishBrowser = null;
    this.set({ ...this.state, active: null });
  };
  returned = (status = 'success') => {
    const active = this.state.active;
    if (active?.phase !== 'widget') return;
    const owned = this.current(active.id, active.walletAddress);
    this.finishBrowser?.({ type: status });
    this.finishBrowser = null;
    this.set({
      active: null,
      // Only a return (untrusted hint, see below) marks local pending; dismissal does not.
      pending:
        owned && status === 'success'
          ? { id: active.id, walletAddress: active.walletAddress }
          : owned
            ? this.state.pending
            : null,
    });
    if (owned) {
      this.deps.onReturned(status, active.asset);
      this.emitReturnHint({
        walletAddress: active.walletAddress,
        asset: active.asset,
      });
      if (status === 'success') this.deps.goHome();
    }
  };
  clearPending = () => {
    this.set({ ...this.state, pending: null });
  };
  reset = () => {
    this.retainedHint = null;
    this.finishBrowser?.({ type: 'cancel' });
    this.finishBrowser = null;
    this.set({ active: null, pending: null });
  };
  private fail(id: number, error: string) {
    if (this.state.active?.id === id)
      this.set({
        ...this.state,
        active: { ...this.state.active, phase: 'error', error },
      });
  }
  /** Read-only preview; Review never trusts this result to authorize checkout. */
  availability = async (asset: RampAsset): Promise<RampAvailability> => {
    const wallet = this.deps.currentWallet();
    const identity = this.deps.currentIdentity();
    if (!wallet)
      return { status: 'unsupported', message: copy.buy.authDoorUnsupported };
    try {
      const config = await this.deps.loadConfig();
      if (
        wallet !== this.deps.currentWallet() ||
        identity !== this.deps.currentIdentity()
      )
        return { status: 'unsupported', message: copy.buy.authDoorUnsupported };
      const admission = this.configAdmission(asset, config);
      if (admission.status !== 'ready') return admission;
      const gate = resolveBuyNetworkGate(config.network);
      if (!buyMayContinueOnNetwork(gate))
        return { status: 'network', message: copy.buy.networkUnknownBody };
      const decision = resolveBuyGateDecision(
        {
          gateEnabled: config.gateEnabled,
          observedJurisdiction: config.jurisdiction,
          selectedAsset: asset,
          cluster: gate.cluster,
        },
        copy.swap,
      );
      return decision.allowed
        ? { status: 'ready' }
        : { status: 'region', message: decision.errorMessage };
    } catch {
      return { status: 'offline', message: addCashCopy.offline };
    }
  };
  private configAdmission(
    asset: RampAsset,
    config: Awaited<ReturnType<MoonPayFlowDeps['loadConfig']>>,
  ): RampAvailability {
    // Unreachable config has no authoritative flag value; never call it ramp-off.
    if (config.reachable === false)
      return { status: 'offline', message: addCashCopy.offline };
    if (!config.enabled || (asset === 'USDC' && !config.usdcEnabled))
      return { status: 'disabled', message: copy.buy.disabled };
    if (!buyMayContinueOnNetwork(resolveBuyNetworkGate(config.network)))
      return { status: 'network', message: copy.buy.networkUnknownBody };
    return { status: 'ready' };
  }
  private async start(
    id: number,
    walletAddress: string,
    asset: RampAsset,
    baseCurrencyAmount?: number,
  ) {
    try {
      const config = await this.deps.loadConfig();
      if (!this.current(id, walletAddress)) return;
      const admission = this.configAdmission(asset, config);
      if (admission.status !== 'ready') {
        this.fail(id, admission.message);
        return;
      }
      const networkGate = resolveBuyNetworkGate(config.network);
      if (!buyMayContinueOnNetwork(networkGate)) {
        this.fail(id, copy.buy.networkUnknownBody);
        return;
      }
      const runGatedBuyContinue =
        this.deps.runGatedContinue ?? defaultRunGatedBuyContinue;
      const result = await runGatedBuyContinue({
        gate: {
          gateEnabled: config.gateEnabled,
          observedJurisdiction: config.jurisdiction,
          selectedAsset: asset,
          cluster: networkGate.cluster,
        },
        copy: {
          accessJurisdiction: copy.swap.accessJurisdiction,
          accessAsset: copy.swap.accessAsset,
        },
        continueArgs: {
          walletAddress,
          selectedAsset: asset,
          baseCurrencyAmount,
          // Read, never invented (rampAssets.ts: "Mobile never invents
          // enablement; false / missing is fail-closed"). The early returns
          // above are the first layer; runBuyContinue's asset gate is the
          // second, and it only holds if these are the server's flags.
          flags: {
            rampEnabled: config.enabled,
            rampUsdcEnabled: config.usdcEnabled,
          },
          returnUrlRaw: this.deps.returnUrl,
          messages: {
            ...buyRampErrorMessages(copy.buy),
            missingAddress: copy.buy.missingAddress,
          },
          createSession: async (body) => {
            if (!this.current(id, walletAddress))
              return { ok: false, error: 'ramp_auth_session_changed' };
            const session = await this.deps.createSession(body);
            // Do not return a URL to the launcher after dismissal, lock, or wallet replacement.
            return this.current(id, walletAddress)
              ? session
              : { ok: false, error: 'ramp_auth_session_changed' };
          },
          onRampOpened: ({ asset: openedAsset }) => {
            if (this.current(id, walletAddress))
              this.deps.onOpened(openedAsset);
          },
          openAuthSession: async (url, returnUrl) => {
            if (!this.current(id, walletAddress)) return { type: 'cancel' };
            this.set({
              ...this.state,
              active: {
                id,
                walletAddress,
                identity: this.deps.currentIdentity(),
                asset,
                phase: 'widget',
                url,
                returnUrl,
              },
            });
            // The native return and sheet close race safely; only the current attempt can settle.
            const closed = new Promise<{ type: string }>((resolve) => {
              this.finishBrowser = resolve;
            });
            const result = await Promise.race([
              this.deps.openContainer(url, returnUrl),
              closed,
            ]);
            const type: unknown = result?.type;
            const settled = {
              type: typeof type === 'string' && type !== '' ? type : 'close',
            };
            if (this.current(id, walletAddress)) this.returned(settled.type);
            return settled;
          },
        },
        runContinue: runBuyContinue,
      });
      if (!this.current(id, walletAddress)) return;
      if (result.status === 'refused') this.fail(id, result.errorMessage);
      else if (!result.result.ok) this.fail(id, result.result.errorMessage);
    } catch {
      if (this.current(id, walletAddress)) this.fail(id, copy.buy.errorGeneric);
    }
  }
}

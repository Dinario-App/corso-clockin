import {
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import {
  resolveRampConfigReachable,
  resolveRampEnabled,
  resolveRampUsdcEnabled,
  resolveJurisdictionGateEnabled,
  resolveObservedJurisdiction,
  resolveNetworkStatus,
} from '@/src/lib/apiConfig';
import { useBuyRampSession } from './useBuyRampSession';
import { trackRampEvent } from './rampAnalytics';
import { chooseMoonPayBrowser } from './moonPayContainer';
import { MoonPayFlow } from './moonPayFlow';
import { MoonPaySheet } from './MoonPaySheet';
import { MoonPayFlowContext as Context } from './moonPayContext';

export function MoonPayProvider({ children }: { children: ReactNode }) {
  const { session, locked, lockStateCell } = useCorsoSession();
  const createSession = useBuyRampSession();
  const live = useRef({ session, createSession });
  live.current = { session, createSession };
  const flowRef = useRef<MoonPayFlow | null>(null);
  if (!flowRef.current) {
    const currentWallet = () => {
      const session = live.current.session;
      return !lockStateCell.current &&
        session &&
        session.type !== 'connected_external'
        ? session.address
        : null;
    };
    flowRef.current = new MoonPayFlow({
      currentWallet,
      currentIdentity: () =>
        currentWallet()
          ? `${live.current.session?.type}:${currentWallet()}`
          : null,
      returnUrl: process.env.EXPO_PUBLIC_RAMP_RETURN_URL,
      loadConfig: async () => {
        // These resolvers share one config snapshot, including the dual-stack readiness gate.
        const [
          enabled,
          usdcEnabled,
          gateEnabled,
          jurisdiction,
          network,
          reachable,
        ] = await Promise.all([
          resolveRampEnabled(),
          resolveRampUsdcEnabled(),
          resolveJurisdictionGateEnabled(),
          resolveObservedJurisdiction(),
          resolveNetworkStatus(),
          resolveRampConfigReachable(),
        ]);
        return {
          enabled,
          usdcEnabled,
          gateEnabled,
          jurisdiction,
          network,
          reachable,
        };
      },
      createSession: (body) => live.current.createSession(body),
      openContainer: async (url, returnUrl) => {
        if (Platform.OS === 'ios')
          return new Promise<{ type: string }>(() => {}); // Native WebView navigation/close settles the flow.
        let browserPackage: string | undefined;
        if (Platform.OS === 'android') {
          try {
            browserPackage = chooseMoonPayBrowser(
              (await WebBrowser.getCustomTabsSupportingBrowsersAsync())
                .browserPackages,
            );
          } catch {
            /* Package discovery unavailable: use the system default. */
          }
        }
        const active = flowRef.current?.getSnapshot().active;
        if (
          !active ||
          active.url !== url ||
          currentWallet() !== active.walletAddress ||
          active.identity !== `${live.current.session?.type}:${currentWallet()}`
        )
          return { type: 'cancel' };
        // On Android Expo implements this using Custom Tabs, with a close/return listener.
        // No ASWebAuthenticationSession is opened on iOS.
        return WebBrowser.openAuthSessionAsync(url, returnUrl, {
          ...(browserPackage ? { browserPackage } : {}),
          toolbarColor: '#090909',
        });
      },
      onOpened: (asset) =>
        trackRampEvent('ramp_opened', { provider: 'moonpay', asset }),
      onReturned: (status, asset) =>
        trackRampEvent('ramp_returned', {
          provider: 'moonpay',
          asset,
          status,
        }),
      goHome: () => router.replace('/(app)'),
    });
  }
  const flow = flowRef.current;
  const snapshot = useSyncExternalStore(
    flow.subscribe,
    flow.getSnapshot,
    flow.getSnapshot,
  );
  const identity = `${session?.type ?? ''}:${session?.address ?? ''}:${locked}`;
  const previousIdentity = useRef(identity);
  useEffect(() => {
    if (previousIdentity.current !== identity) {
      flow.reset();
      previousIdentity.current = identity;
    }
  }, [flow, identity]);
  useEffect(() => () => flow.reset(), [flow]);
  return (
    <Context.Provider value={flow}>
      {children}
      <MoonPaySheet
        active={
          !locked &&
          (snapshot.active?.walletAddress === '' ||
            snapshot.active?.identity ===
              `${session?.type}:${session?.address}`)
            ? snapshot.active
            : null
        }
        flow={flow}
      />
    </Context.Provider>
  );
}
export function useMoonPay() {
  const flow = useContext(Context);
  if (!flow) throw new Error('MoonPayProvider is required');
  const snapshot = useSyncExternalStore(
    flow.subscribe,
    flow.getSnapshot,
    flow.getSnapshot,
  );
  return { flow, ...snapshot };
}

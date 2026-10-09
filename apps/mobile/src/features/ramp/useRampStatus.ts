import {
  resolveNetworkStatus,
  resolveRampStatusScope,
} from '@/src/lib/apiConfig';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { usePrivy } from '@privy-io/expo';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { fetchRampStatus, type RampStatusItem } from './rampStatusClient';
import {
  rejectStatusCredential,
  readStatusCredential,
  statusGeneration,
  statusReadsBlocked,
  subscribeStatusCredential,
  trackStatusRequest,
} from './statusCredentialStore';

/** Fresh read on mount/foreground, then serialized polling while foregrounded. */
export function useRampStatus(): RampStatusItem[] {
  const { session, locked, lockStateCell } = useCorsoSession();
  const { getAccessToken } = usePrivy();
  const [accessRevision, refreshAccess] = useState(0);
  useEffect(
    () =>
      subscribeStatusCredential(() => {
        if (session?.type === 'imported_seed')
          refreshAccess((value) => value + 1);
      }),
    [session?.type],
  );
  const credentialGeneration =
    session?.type === 'imported_seed' ? statusGeneration() : 0;
  const eligible =
    !locked &&
    (session?.type === 'privy_embedded' ||
      (session?.type === 'imported_seed' && !statusReadsBlocked()));
  const key = eligible
    ? `${session.type}:${session.privyUserId ?? ''}:${session.address}:${session.type === 'imported_seed' ? credentialGeneration : ''}`
    : '';
  const live = useRef({ session, getAccessToken, key });
  live.current = { session, getAccessToken, key };
  const [snapshot, setSnapshot] = useState<{
    key: string;
    items: RampStatusItem[];
  }>({ key: '', items: [] });
  // biome-ignore lint/correctness/useExhaustiveDependencies: key encodes the session type, address and credential generation the effect reads; accessRevision is the credential-store refresh trigger and is listed on purpose.
  useEffect(() => {
    if (!key) {
      setSnapshot({ key: '', items: [] });
      return;
    }
    let disposed = false;
    let active =
      AppState.currentState !== 'background' &&
      AppState.currentState !== 'inactive';
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let generation = 0;
    let networkKey = '';
    let forgetRequest: (() => void) | undefined;
    const stop = () => {
      generation++;
      clearTimeout(timer);
      controller?.abort();
      forgetRequest?.();
    };
    const read = async () => {
      if (disposed || !active || live.current.key !== key) return;
      stop();
      const attempt = generation;
      const requestController = new AbortController();
      controller = requestController;
      if (session?.type === 'imported_seed')
        forgetRequest = trackStatusRequest(requestController);
      const signal = requestController.signal;
      const deadline = setTimeout(() => requestController.abort(), 10_000);
      const aborted = new Promise<{ ok: false }>((resolve) =>
        signal.addEventListener('abort', () => resolve({ ok: false }), {
          once: true,
        }),
      );
      const result = await Promise.race([
        (async () => {
          const current = () =>
            !signal.aborted &&
            live.current.key === key &&
            !lockStateCell?.current &&
            (session?.type !== 'imported_seed' ||
              statusGeneration() === credentialGeneration);
          if (session?.type === 'imported_seed') {
            const scope = await resolveRampStatusScope(session.address);
            if (!scope || !current()) return { ok: false as const };
            const nextNetworkKey = JSON.stringify(scope);
            if (networkKey && networkKey !== nextNetworkKey)
              setSnapshot({ key, items: [] });
            networkKey = nextNetworkKey;
            const credential = await readStatusCredential(scope, current);
            if (!credential || !current()) return { ok: false as const };
            const result = await fetchRampStatus({
              session,
              cluster: scope.cluster,
              apiBaseUrl: scope.audience,
              importedAccess: {
                bearer: credential.token,
                environment: scope.environment,
              },
              getAccessToken: live.current.getAccessToken,
              signal,
            });
            if (!current()) return { ok: false as const };
            if (!result.ok && result.reason === 'reprove')
              await rejectStatusCredential(credential);
            return result;
          }
          const network = await resolveNetworkStatus();
          if (
            network.state !== 'known' ||
            signal.aborted ||
            live.current.key !== key
          )
            return { ok: false as const };
          return fetchRampStatus({
            session: live.current.session,
            cluster: network.cluster,
            getAccessToken: live.current.getAccessToken,
            signal,
          });
        })().catch(() => ({ ok: false as const })),
        aborted,
      ]);
      clearTimeout(deadline);
      if (
        disposed ||
        !active ||
        generation !== attempt ||
        (session?.type === 'imported_seed' &&
          credentialGeneration !== statusGeneration()) ||
        lockStateCell?.current ||
        live.current.key !== key
      )
        return;
      // Retain last-known pending on a failed read; never infer settlement.
      if (result.ok) setSnapshot({ key, items: result.items });
      timer = setTimeout(() => void read(), 15_000);
    };
    void read();
    const subscription = AppState.addEventListener('change', (state) => {
      active = state === 'active';
      stop();
      if (active) void read();
    });
    return () => {
      disposed = true;
      stop();
      subscription.remove();
    };
  }, [key, credentialGeneration, lockStateCell, accessRevision]);
  return key && snapshot.key === key ? snapshot.items : [];
}

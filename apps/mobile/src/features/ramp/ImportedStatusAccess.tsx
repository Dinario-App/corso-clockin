import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useCorsoSession } from '../session/SessionContext';
import { importedMnemonicStore } from '../session/importedMnemonicStore';
import { createImportedSolanaSigner } from '../security/importedSeedSolanaSigner';
import { resolveRampStatusScope } from '@/src/lib/apiConfig';
import { CorsoText } from '@/src/theme/CorsoText';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { useEthenaMaterial } from '@/src/ui/ethena/useEthenaMaterial';
import {
  requestStatusCredential,
  type StatusScope,
} from './statusAuthorization';
import {
  readStatusCredential,
  rejectStatusCredential,
  saveStatusCredential,
  statusGeneration,
  statusReadsBlocked,
  statusRequiresReproof,
  subscribeStatusCredential,
  trackStatusRequest,
} from './statusCredentialStore';
import { statusAccessCopy } from './statusAccessCopy';

/** Explicit status-only proof. Polling never calls this action. */
export function ImportedStatusAccess() {
  const { session, locked, lockStateCell } = useCorsoSession();
  const tray = useEthenaMaterial('ground');
  const key =
    !locked && !statusReadsBlocked() && session?.type === 'imported_seed'
      ? session.address
      : '';
  const live = useRef({ key, session });
  live.current = { key, session };
  const [scope, setScope] = useState<StatusScope | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [, refreshAccess] = useState(0);
  useEffect(
    () => subscribeStatusCredential(() => refreshAccess((value) => value + 1)),
    [],
  );
  const flight = useRef<AbortController | null>(null);
  useEffect(() => {
    let disposed = false;
    setScope(null);
    setBusy(false);
    setMessage(null);
    if (key)
      void resolveRampStatusScope(key)
        .then((value) => {
          if (!disposed && live.current.key === key) setScope(value);
        })
        .catch(() => undefined);
    return () => {
      disposed = true;
      flight.current?.abort();
      flight.current = null;
    };
  }, [key]);
  const prove = useCallback(async () => {
    if (!key || !scope || flight.current || lockStateCell.current) return;
    const generation = statusGeneration();
    const controller = new AbortController();
    flight.current = controller;
    const untrack = trackStatusRequest(controller);
    const deadline = setTimeout(() => controller.abort(), 60_000);
    const current = () =>
      !controller.signal.aborted &&
      !statusReadsBlocked() &&
      live.current.key === key &&
      !lockStateCell.current &&
      statusGeneration() === generation;
    setBusy(true);
    setMessage(null);
    try {
      const freshScope = await resolveRampStatusScope(key);
      if (!current()) return;
      if (!freshScope || JSON.stringify(freshScope) !== JSON.stringify(scope)) {
        setScope(freshScope);
        return;
      }
      const previous = await readStatusCredential(scope, current);
      const result = await requestStatusCredential({
        scope,
        previous,
        isCurrent: current,
        signal: controller.signal,
        getSigner: async () => {
          const active = live.current.session;
          if (active?.type !== 'imported_seed' || !current())
            throw new Error('Status session changed');
          return createImportedSolanaSigner({
            store: importedMnemonicStore,
            session: active,
          });
        },
      });
      if (!current()) return;
      if (result.ok) {
        if (
          !(await saveStatusCredential(result.credential, current)) &&
          current()
        )
          setMessage(statusAccessCopy.unavailable);
      } else {
        setMessage(
          result.reason === 'reprove'
            ? statusAccessCopy.reprove
            : statusAccessCopy.unavailable,
        );
        if (result.reason === 'reprove' && previous)
          await rejectStatusCredential(previous);
      }
    } catch {
      if (current()) setMessage(statusAccessCopy.unavailable);
    } finally {
      clearTimeout(deadline);
      untrack();
      if (flight.current === controller) {
        flight.current = null;
        setBusy(false);
      }
    }
  }, [key, scope, lockStateCell]);
  if (!key || !scope || scope.owner !== key) return null;
  return (
    <View
      testID="imported-status-access-card"
      style={[
        styles.container,
        {
          backgroundColor: tray.fill as string,
          borderWidth: tray.borderWidth,
          borderColor: tray.borderColor ?? undefined,
        },
      ]}
    >
      <CorsoText style={styles.body}>{statusAccessCopy.explanation}</CorsoText>
      <Pressable
        testID="imported-status-access"
        accessibilityRole="button"
        disabled={busy}
        accessibilityState={{ busy, disabled: busy }}
        onPress={prove}
        style={styles.button}
      >
        <CorsoText style={styles.title}>{statusAccessCopy.check}</CorsoText>
      </Pressable>
      {message || statusRequiresReproof() ? (
        <CorsoText accessibilityLiveRegion="polite" style={styles.body}>
          {message ?? statusAccessCopy.reprove}
        </CorsoText>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    borderRadius: ethenaGeometry.radiusBox,
    padding: ethenaGeometry.pad,
  },
  button: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  title: { ...ETHENA_TYPE.keyValue, color: ethena.ink.primary },
  body: { ...ETHENA_TYPE.rowSub, color: ethena.ink.secondary },
});

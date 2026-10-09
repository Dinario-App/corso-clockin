import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import { ethena } from '@/constants/theme.ethena';
import { canonNumerals } from '@/src/ui/cards/canonType';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { AccountScreenHeader } from '@/src/features/account/ui/AccountScreenHeader';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { connectMwa } from '@/src/features/connect/mwaClient';
import { mwaSessionStore } from '@/src/features/connect/mwaSessionStore';
import { mwaRuntimeTransact } from '@/src/features/connect/mwaRuntime';
import { MWA_IDENTITY, runConnectFlow, type ConnectState } from '@/src/features/connect/connectFlow';
import { useMwaAvailability } from '@/src/features/connect/useMwaAvailability';
import { EthenaGround } from '@/src/ui/ethena/EthenaPrimitives';
import { CorsoText } from '@/src/theme/CorsoText';
import { TextButton } from '@/src/ui/controls/TextButton';
export default function ConnectScreen() {
  const available = useMwaAvailability();
  const { session, connectedStatus, setConnectedSession, clearConnectedSession } = useCorsoSession();
  const [state, setState] = useState<ConnectState>('idle');
  const [disconnectError, setDisconnectError] = useState(false);
  const busy = useRef(false);
  const connected = session?.type === 'connected_external';
  async function connect() {
    if (busy.current || !available) return;
    busy.current = true;
    await runConnectFlow({
      connect: () => connectMwa({ transact: mwaRuntimeTransact, store: mwaSessionStore, identity: MWA_IDENTITY, chain: 'solana:mainnet' }),
      apply: result => setConnectedSession({ dto: result.session, walletName: null }),
      update: setState,
    });
    busy.current = false;
  }
  async function disconnect() {
    if (busy.current) return;
    busy.current = true;
    setDisconnectError(false);
    setState('opening');
    try { await clearConnectedSession(); setState('idle'); }
    catch { setDisconnectError(true); setState('failed'); }
    finally { busy.current = false; }
  }
  if (available === false) return <Redirect href="/profile/security" />;
  return <EthenaGround><SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    <AccountScreenHeader family="desk" title={copy.connect.title} onBack={() => goBackOr(BACK_FALLBACK.securityHub)} backAccessibilityLabel={copy.v1.back} />
    <View style={styles.body}>
      <CorsoText style={styles.status}>{connected ? (connectedStatus === 'ready' ? copy.connect.connected : copy.connect.failed) : copy.connect[state]}</CorsoText>
      {connected ? <CorsoText style={styles.address}>{`${session.address.slice(0, 4)}…${session.address.slice(-4)}`}</CorsoText> : null}
      {disconnectError ? <CorsoText style={styles.status}>{copy.connect.disconnectFailed}</CorsoText> : null}
      <TextButton tone="action" labelStyle={styles.cta} label={(connected || disconnectError) ? copy.connect.disconnect : copy.connect.title} disabled={available !== true || state === 'opening'} onPress={() => { void ((connected || disconnectError) ? disconnect() : connect()); }} />
    </View>
  </SafeAreaView></EthenaGround>;
}
const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: ethenaGeometry.gutter, gap: 16 },
  cta: { color: ethena.ink.primary },
  status: { color: ethena.ink.secondary },
  address: { color: ethena.ink.primary, fontVariant: canonNumerals() },
});

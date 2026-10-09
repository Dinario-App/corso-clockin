import { useEffect, useState } from 'react';
import {
  Platform,
  Share,
  StyleSheet,
  View,
  type TextStyle,
} from 'react-native';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import {
  AccountActionButton,
  AccountActionPair,
} from '@/src/features/account/ui/AccountActionPair';
import { AccountScreenHeader } from '@/src/features/account/ui/AccountScreenHeader';
import {
  RECEIVE_QR_MODULE_COLOR,
  RECEIVE_QR_SIZE,
  RECEIVE_QR_TILE_COLOR,
  RECEIVE_QR_TILE_PADDING,
  RECEIVE_QR_TILE_RADIUS,
  resolveReceivePresentation,
} from '@/src/features/request/receivePresentation';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { resolveCluster, type PublicAppConfig } from '@/src/lib/apiConfig';
import { CorsoText } from '@/src/theme/CorsoText';
import { SettingsCard } from '@/src/ui/cards/SettingsCard';
import { canonNumerals } from '@/src/ui/cards/canonType';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon';
import { EthenaGround } from '@/src/ui/ethena/EthenaPrimitives';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ethena } from '@/constants/theme.ethena';

const COPY_FLASH_MS = 1600;

export default function ReceiveScreen() {
  const { session } = useCorsoSession();
  const [cluster, setCluster] = useState<PublicAppConfig['cluster'] | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void resolveCluster()
      .then((resolved) => {
        if (!cancelled) setCluster(resolved);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!copied) return;
    const handle = setTimeout(() => setCopied(false), COPY_FLASH_MS);
    return () => clearTimeout(handle);
  }, [copied]);

  const receive = resolveReceivePresentation({
    address: session?.address,
    cluster,
  });

  async function onCopy() {
    if (!receive.address) return;
    try {
      await Clipboard.setStringAsync(receive.address);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function onShare() {
    if (!receive.address) return;
    try {
      await Share.share(
        Platform.OS === 'ios'
          ? { message: receive.address }
          : { message: receive.address, title: receive.title },
      );
    } catch {
      // Android dismisses with a rejection; treat as cancel, not a hard failure.
    }
  }

  return (
    <EthenaGround>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <AccountScreenHeader
          family="desk"
          title={receive.title}
          onBack={() => goBackOr(BACK_FALLBACK.accountTab)}
          backAccessibilityLabel={copy.v1.back}
          testID="receive-header"
        />

        <View style={styles.body}>
          {receive.hasAddress && receive.address ? (
            <>
              <SettingsCard
                radius={22}
                contentStyle={styles.qrPane}
                testID="receive-qr-pane"
              >
                <View
                  style={styles.qrTile}
                  accessible
                  accessibilityLabel={receive.qrAccessibilityLabel}
                  testID="receive-qr"
                >
                  <QRCode
                    value={receive.address}
                    size={RECEIVE_QR_SIZE}
                    color={RECEIVE_QR_MODULE_COLOR}
                    backgroundColor={RECEIVE_QR_TILE_COLOR}
                    ecl="M"
                  />
                </View>
                <View style={styles.qrId}>
                  <CorsoText style={styles.qrName} numberOfLines={1}>
                    {receive.accountName}
                  </CorsoText>
                  <CorsoText
                    style={[styles.qrAddress, MONO]}
                    numberOfLines={1}
                    selectable
                    accessibilityLabel={`${copy.request.walletAddress} ${receive.address}`}
                  >
                    {receive.addressShort}
                  </CorsoText>
                </View>
              </SettingsCard>

              <AccountActionPair
                style={styles.actions}
                testID="receive-actions"
              >
                <AccountActionButton
                  label={
                    copied ? copy.account.addressCopied : receive.copyLabel
                  }
                  glyph="copy"
                  confirmed={copied}
                  testID="receive-actions-copy"
                  onPress={() => {
                    void onCopy();
                  }}
                />
                <AccountActionButton
                  label={receive.shareLabel}
                  glyph="send"
                  testID="receive-actions-share"
                  onPress={() => {
                    void onShare();
                  }}
                />
              </AccountActionPair>

              <View style={styles.note}>
                {/* Informational glyph → WCAG 1.4.11's 3:1 floor. `--ink28` is
                  2.22:1; `--ink48` clears it with room. */}
                <CorsoIcon
                  name="warning"
                  size={13}
                  color={ethena.ink.tertiary}
                />
                <CorsoText style={styles.noteText}>
                  {copy.account.receiveCaution}
                </CorsoText>
              </View>
            </>
          ) : (
            <CorsoText style={styles.noteText}>
              {receive.missingAddress}
            </CorsoText>
          )}
        </View>
      </SafeAreaView>
    </EthenaGround>
  );
}

const MONO: TextStyle = {
  fontVariant: canonNumerals(),
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: {
    flex: 1,
    paddingHorizontal: ethenaGeometry.gutter,
    paddingTop: ethenaGeometry.gutter,
  },
  /** `.qr-pane{border-radius:22px;padding:22px 18px 18px;gap:14px}` */
  qrPane: {
    alignItems: 'center',
    gap: 14,
    paddingTop: ethenaGeometry.gutter,
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  qrTile: {
    padding: RECEIVE_QR_TILE_PADDING,
    borderRadius: RECEIVE_QR_TILE_RADIUS,
    backgroundColor: RECEIVE_QR_TILE_COLOR,
  },
  qrId: { alignItems: 'center', gap: 2 },
  qrName: {
    ...ETHENA_TYPE.keyValueTotal,
    color: ethena.ink.primary,
  },
  qrAddress: {
    ...ETHENA_TYPE.rowSub,
    color: ethena.ink.tertiary,
  },
  /** `.rc-actions{margin:16px 22px 0}` — the gutter is the screen's. */
  actions: { marginTop: 16 },
  /** `.rc-note{margin:16px 22px 0;gap:8px;padding:0 2px}` */
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 2,
  },
  noteText: {
    flex: 1,
    ...ETHENA_TYPE.rowSub,
    color: ethena.ink.tertiary,
  },
});

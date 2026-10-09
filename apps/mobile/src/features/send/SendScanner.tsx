import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import {
  resolveSendScannerChrome,
  scanRejectionMessage,
  type CameraPermission,
} from '@/src/features/send/sendScannerPresentation';
import {
  parseScannedPayload,
  type ScannedRequest,
  type SendCluster,
} from '@/src/features/send/solanaPayRequest';
import { GlassPill } from '@/src/ui/controls/GlassPill';
import { TextButton } from '@/src/ui/controls/TextButton';
import { colors, radii, spacing, typography } from '@/src/ui/tokens';

export type SendScannerProps = {
  ownerAddress: string | null;
  cluster: SendCluster | null;
  onScanned: (request: ScannedRequest) => void;
  onClose: () => void;
};

/**
 * A state of the Send sheet. Never a route, never its own destination.
 *
 * The camera is only mounted once permission is granted, so a denial renders a
 * real state instead of a black rectangle.
 */
export function SendScanner({
  ownerAddress,
  cluster,
  onScanned,
  onClose,
}: SendScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [rejection, setRejection] = useState<string | null>(null);
  // One code per open. Barcode callbacks fire every frame.
  const handled = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  const status: CameraPermission =
    permission == null
      ? 'undetermined'
      : permission.granted
        ? 'granted'
        : permission.canAskAgain
          ? 'undetermined'
          : 'denied';

  const chrome = resolveSendScannerChrome({ permission: status });

  const onBarcode = useCallback(
    ({ data }: { data: string }) => {
      if (handled.current) return;
      const result = parseScannedPayload({
        raw: data,
        ownerAddress,
        cluster,
      });
      if (!result.ok) {
        setRejection(scanRejectionMessage(result.reason));
        return;
      }
      handled.current = true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onScanned(result.request);
    },
    [cluster, onScanned, ownerAddress],
  );

  return (
    <View style={styles.root}>
      <Text style={styles.title} accessibilityRole="header">
        {chrome.title}
      </Text>

      <View style={styles.viewfinder}>
        {chrome.cameraActive ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={onBarcode}
          />
        ) : null}
      </View>

      {chrome.body_text ? (
        <Text style={styles.body} accessibilityLiveRegion="polite">
          {chrome.body_text}
        </Text>
      ) : null}
      {chrome.hint ? <Text style={styles.hint}>{chrome.hint}</Text> : null}
      {rejection ? (
        <Text style={styles.rejection} accessibilityLiveRegion="polite">
          {rejection}
        </Text>
      ) : null}

      {chrome.actionLabel && chrome.action === 'open-settings' ? (
        <GlassPill
          label={chrome.actionLabel}
          style={styles.action}
          onPress={() => {
            void Linking.openSettings();
          }}
        />
      ) : null}
      <TextButton label={chrome.closeLabel} tone="action" onPress={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  title: {
    fontFamily: typography.face('600'),
    fontSize: typography.hero,
    fontWeight: '600',
    color: colors.ink,
  },
  viewfinder: {
    marginTop: spacing.lg,
    aspectRatio: 1,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassStroke,
  },
  body: {
    marginTop: spacing.md,
    color: colors.ink,
    fontFamily: typography.face('400'),
    fontSize: typography.body,
  },
  hint: {
    marginTop: spacing.sm,
    color: colors.muted,
    fontFamily: typography.face('400'),
    fontSize: typography.caption,
  },
  rejection: {
    marginTop: spacing.md,
    color: colors.ink,
    fontFamily: typography.face('400'),
    fontSize: typography.body,
  },
  action: {
    marginTop: spacing.md,
  },
});

import { Scrim } from '@/src/ui/primitives/Scrim';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import { CorsoText } from '@/src/theme/CorsoText';
import { colors, radii, spacing } from '@/src/ui/tokens';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon';
import { moonPayNavigation } from './moonPayContainer';
import type { MoonPayFlow, MoonPaySnapshot } from './moonPayFlow';

export function MoonPaySheet({
  active,
  flow,
}: {
  active: MoonPaySnapshot['active'];
  flow: MoonPayFlow;
}) {
  const insets = useSafeAreaInsets();
  if (!active) return null;
  const navigate = (url: string) => {
    if (!active.returnUrl) return false;
    const action = moonPayNavigation(url, active.returnUrl);
    if (action === 'return') flow.returned();
    if (action === 'external')
      void WebBrowser.openBrowserAsync(url).catch(() => undefined);
    return action === 'allow';
  };
  return (
    <Modal
      transparent
      visible
      animationType="slide"
      onRequestClose={flow.close}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.backdrop} accessibilityViewIsModal>
        <Scrim />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, spacing.md) },
          ]}
          testID="moonpay-sheet"
        >
          <View style={styles.grabber} />
          <View style={styles.header}>
            <View style={styles.heading}>
              <CorsoText style={styles.title}>{copy.buy.title}</CorsoText>
              <CorsoText style={styles.muted}>
                {copy.buy.sheetSubtitle(active.walletAddress.slice(-4))}
              </CorsoText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.v1.dismissSheet(copy.buy.title)}
              onPress={flow.close}
              style={styles.close}
              testID="moonpay-close"
            >
              <CorsoIcon name="close" size={20} color={colors.ink} />
            </Pressable>
          </View>
          <View style={styles.content}>
            {active.phase === 'error' ? (
              <CorsoText accessibilityRole="alert" style={styles.error}>
                {active.error}
              </CorsoText>
            ) : active.phase === 'widget' &&
              Platform.OS === 'ios' &&
              active.url ? (
              <WebView
                testID="moonpay-webview"
                source={{ uri: active.url }}
                enableApplePay
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled
                domStorageEnabled
                javaScriptCanOpenWindowsAutomatically
                // Route every scheme through our policy. WebView's default rejection path
                // calls Linking and can log full URLs before our handler sees them.
                originWhitelist={['*']}
                onShouldStartLoadWithRequest={(request) =>
                  request.isTopFrame === false
                    ? /^https:\/\//.test(request.url)
                    : navigate(request.url)
                }
                onOpenWindow={(event) => {
                  const url = event.nativeEvent.targetUrl;
                  const action = moonPayNavigation(url, active.returnUrl!);
                  if (action === 'return') flow.returned();
                  else if (action !== 'block')
                    void WebBrowser.openBrowserAsync(url).catch(
                      () => undefined,
                    );
                }}
                startInLoadingState
                renderLoading={() => (
                  <ActivityIndicator
                    accessibilityLabel={copy.buy.opening}
                    color={colors.ink}
                    style={styles.loading}
                  />
                )}
                // Suppress WebView's default native-event logger (it includes the URL).
                onError={() => {}}
                renderError={() => (
                  <CorsoText style={styles.error}>
                    {copy.buy.errorGeneric}
                  </CorsoText>
                )}
                style={styles.webview}
              />
            ) : (
              <View
                style={styles.skeleton}
                accessibilityLabel={copy.buy.opening}
                accessibilityRole="progressbar"
              >
                <View style={styles.skeletonRow}>
                  <View style={styles.pill} />
                  <View style={styles.pill} />
                </View>
                <View style={styles.amountPlaceholder} />
                <View style={styles.buttonPlaceholder} />
                <ActivityIndicator color={colors.ink} />
              </View>
            )}
          </View>
          <CorsoText style={styles.disclosure}>
            {copy.buy.checkoutDisclosure}
          </CorsoText>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    height: '92%',
    backgroundColor: colors.groundSheet,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    overflow: 'hidden',
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.inkTertiary,
    alignSelf: 'center',
    marginTop: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  heading: { flex: 1, alignItems: 'center', paddingLeft: 44 },
  title: { color: colors.ink, fontSize: 17 },
  muted: { color: colors.muted, fontSize: 12, marginTop: 4 },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: colors.canvas,
  },
  content: { flex: 1 },
  webview: { flex: 1, backgroundColor: colors.groundSheet },
  disclosure: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
  },
  error: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    padding: spacing.gutter,
  },
  loading: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  skeleton: { flex: 1, padding: spacing.gutter, gap: 32 },
  skeletonRow: { flexDirection: 'row', justifyContent: 'space-between' },
  pill: {
    width: 100,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.canvas,
  },
  amountPlaceholder: {
    width: 170,
    height: 70,
    marginTop: 30,
    alignSelf: 'center',
    borderRadius: 14,
    backgroundColor: colors.canvas,
  },
  buttonPlaceholder: {
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.canvas,
  },
});

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import {
  WebView,
  type WebViewMessageEvent,
  type WebViewNavigation,
} from 'react-native-webview';
import { colors } from '@/src/ui/tokens';
import {
  encodeHostMessage,
  parseChartMessage,
  type VelaCandle,
  type VelaChartMessage,
  type VelaHostMessage,
  type VelaOverlays,
  type VelaThemeMode,
  type VelaTimeframe,
} from '@/src/ui/charts/vela/velaBridge';
import { buildVelaChartHtml } from '@/src/ui/charts/vela/velaChartHtml';
import { decideVelaNavigation } from '@/src/ui/charts/vela/velaNavigationPolicy';

export type VelaChartWebViewProps = {
  candles: VelaCandle[];
  overlays: VelaOverlays;
  timeframe: VelaTimeframe;
  theme?: VelaThemeMode;
  /** Fired for each typed message the chart posts back (already validated). */
  onChartMessage?: (message: VelaChartMessage) => void;
  /** Convenience: fired on scrub/tap select. */
  onSelect?: (barMs: number, price: string) => void;
  testID?: string;
};

/**
 * WebView props that keep the surface OFFLINE and locked down. Same posture as
 * the export feature's `buildExportWebViewConfig`: no origin but the inline
 * document, no persistent storage, no file access, no windows.
 */
export const VELA_WEBVIEW_HARDENING = {
  originWhitelist: ['about:*'] as string[],
  incognito: true as const,
  cacheEnabled: false as const,
  javaScriptEnabled: true as const,
  domStorageEnabled: false as const,
  allowFileAccess: false as const,
  allowFileAccessFromFileURLs: false as const,
  allowUniversalAccessFromFileURLs: false as const,
  allowsLinkPreview: false as const,
  allowsInlineMediaPlayback: false as const,
  setSupportMultipleWindows: false as const,
  javaScriptCanOpenWindowsAutomatically: false as const,
  thirdPartyCookiesEnabled: false as const,
  sharedCookiesEnabled: false as const,
  /** The chart owns pan/zoom; the page must not bounce or zoom the document. */
  bounces: false as const,
  scrollEnabled: false as const,
  overScrollMode: 'never' as const,
  /** Hide the RN-side loader — the page paints its own background instantly. */
  startInLoadingState: false as const,
};

export function VelaChartWebView({
  candles,
  overlays,
  timeframe,
  theme = 'dark',
  onChartMessage,
  onSelect,
  testID,
}: VelaChartWebViewProps) {
  const webViewRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  const reloadedRef = useRef(false);
  // The document is built once per theme; data never lives in the HTML.
  const html = useMemo(() => buildVelaChartHtml(theme), [theme]);

  const post = useCallback((message: VelaHostMessage) => {
    webViewRef.current?.postMessage(encodeHostMessage(message));
  }, []);

  const init = useCallback(() => {
    post({ t: 'init', theme, timeframe, candles, overlays });
  }, [post, theme, timeframe, candles, overlays]);

  // New candles (timeframe change, bar-close refresh) re-seed the chart; new
  // overlays alone repaint in place. Both only once the page said `ready`.
  useEffect(() => {
    if (readyRef.current) init();
  }, [init]);

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const message = parseChartMessage(event.nativeEvent.data);
      if (!message) return; // untrusted/malformed — drop it
      if (message.t === 'ready') {
        readyRef.current = true;
        init();
      }
      onChartMessage?.(message);
      if (message.t === 'select') onSelect?.(message.barMs, message.price);
    },
    [init, onChartMessage, onSelect],
  );

  const onShouldStartLoadWithRequest = useCallback(
    (request: WebViewNavigation) => {
      const decision = decideVelaNavigation(request.url);
      if (decision.action === 'open_external') {
        void Linking.openURL(decision.url).catch(() => undefined);
        return false;
      }
      return decision.action === 'allow';
    },
    [],
  );

  const onProcessGone = useCallback(() => {
    readyRef.current = false;
    onChartMessage?.({ t: 'error', detail: 'web_content_process_terminated' });
    if (reloadedRef.current) return;
    reloadedRef.current = true;
    webViewRef.current?.reload();
  }, [onChartMessage]);

  return (
    <View style={styles.container} testID={testID}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        onContentProcessDidTerminate={onProcessGone}
        onRenderProcessGone={onProcessGone}
        style={styles.webview}
        {...VELA_WEBVIEW_HARDENING}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  webview: { flex: 1, backgroundColor: colors.canvas },
});

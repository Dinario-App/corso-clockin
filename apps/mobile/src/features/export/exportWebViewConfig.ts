/** Android `CacheMode` literal accepted by react-native-webview 13.16.1. */
type CacheMode = 'LOAD_DEFAULT' | 'LOAD_CACHE_ELSE_NETWORK' | 'LOAD_NO_CACHE' | 'LOAD_CACHE_ONLY';

export type ExportWebViewConfig = {
  incognito: true;
  cacheEnabled: false;
  cacheMode: CacheMode;
  thirdPartyCookiesEnabled: false;
  sharedCookiesEnabled: false;
  domStorageEnabled: false;
  javaScriptEnabled: true;
  javaScriptCanOpenWindowsAutomatically: false;
  setSupportMultipleWindows: false;
  allowFileAccess: false;
  allowFileAccessFromFileURLs: false;
  allowUniversalAccessFromFileURLs: false;
  allowsLinkPreview: false;
  mediaPlaybackRequiresUserAction: true;
  originWhitelist: string[];
  /**
   * No app state is injected into the page. The only bridge is the page →
   * app postMessage the Privy recipe defines; nothing flows app → page.
   */
  injectedJavaScript: undefined;
};

/**
 * Build the exact prop set for the export WebView.
 * @param origin normalized https origin, e.g. `https://export.corso.trade`
 */
export function buildExportWebViewConfig(origin: string): ExportWebViewConfig {
  return {
    incognito: true,
    cacheEnabled: false,
    cacheMode: 'LOAD_NO_CACHE',
    thirdPartyCookiesEnabled: false,
    sharedCookiesEnabled: false,
    domStorageEnabled: false,
    javaScriptEnabled: true,
    javaScriptCanOpenWindowsAutomatically: false,
    setSupportMultipleWindows: false,
    allowFileAccess: false,
    allowFileAccessFromFileURLs: false,
    allowUniversalAccessFromFileURLs: false,
    allowsLinkPreview: false,
    mediaPlaybackRequiresUserAction: true,
    originWhitelist: [`${origin}/*`],
    injectedJavaScript: undefined,
  };
}

/**
 * Imperative teardown run on unmount, in order.
 * `clearCache` is a cross-platform WebView command; `clearHistory` and
 * `clearFormData` are Android-only commands and are no-ops elsewhere.
 * `stopLoading` runs first so nothing lands after the clear.
 */
export const EXPORT_WEBVIEW_TEARDOWN_COMMANDS = [
  'stopLoading',
  'clearCache',
  'clearHistory',
  'clearFormData',
] as const;

export type ExportWebViewRef = {
  stopLoading?: () => void;
  clearCache?: (includeDiskFiles: boolean) => void;
  clearHistory?: () => void;
  clearFormData?: () => void;
};

export function teardownExportWebView(
  ref: ExportWebViewRef | null | undefined,
): string[] {
  const ran: string[] = [];
  if (!ref) return ran;
  for (const command of EXPORT_WEBVIEW_TEARDOWN_COMMANDS) {
    try {
      if (command === 'clearCache') {
        if (typeof ref.clearCache === 'function') {
          ref.clearCache(true);
          ran.push(command);
        }
        continue;
      }
      const fn = ref[command];
      if (typeof fn === 'function') {
        fn.call(ref);
        ran.push(command);
      }
    } catch {
      // Best-effort: continue clearing.
    }
  }
  return ran;
}

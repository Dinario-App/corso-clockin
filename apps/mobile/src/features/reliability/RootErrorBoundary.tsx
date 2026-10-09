import { Component, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { colors, spacing } from '@/src/ui/tokens';
import { ErrorState } from '@/src/ui/state/ErrorState';
import { reportRootCrash } from '@/src/features/reliability/rootCrashReport';
import { resolveRootCrashPresentation } from '@/src/features/reliability/rootErrorBoundaryPresentation';

export type RootErrorBoundaryProps = {
  /**
   * Set by expo-router when ITS boundary already caught (`views/Try.js` renders
   * `<ErrorBoundary error retry />`). Absent when this component is the one
   * doing the catching, around `children`.
   */
  error?: unknown;
  /** expo-router's re-render of the failed route. Absent on the children path. */
  retry?: () => void | Promise<void>;
  children?: ReactNode;
  report?: (error: unknown) => void;
  hideSplash?: () => void;
};

export type RootErrorBoundaryState = { caught: unknown };

export class RootErrorBoundary extends Component<
  RootErrorBoundaryProps,
  RootErrorBoundaryState
> {
  state: RootErrorBoundaryState = { caught: undefined };

  static getDerivedStateFromError(error: unknown): RootErrorBoundaryState {
    return { caught: error === undefined ? new Error('Render failed') : error };
  }

  componentDidMount(): void {
    // Position 1: expo-router caught before we mounted, so there is no
    // `componentDidCatch` coming and this is the only chance to report.
    if (this.props.error !== undefined) this.report(this.props.error);
    this.revealFallbackIfShowing();
  }

  componentDidUpdate(previous: RootErrorBoundaryProps): void {
    // Retry re-rendered the route, it threw again, and `Try` handed down a
    // second error without remounting us. Without this the retry loop is
    // invisible to the reporter, which is the loop most worth seeing.
    if (this.props.error !== undefined && this.props.error !== previous.error) {
      this.report(this.props.error);
    }
    this.revealFallbackIfShowing();
  }

  /** Position 2: we caught it ourselves. */
  componentDidCatch(error: unknown): void {
    this.report(error);
    this.revealFallbackIfShowing();
  }

  private report(error: unknown): void {
    (this.props.report ?? reportRootCrash)(error);
  }

  private revealFallbackIfShowing(): void {
    if (this.state.caught === undefined && this.props.error === undefined) {
      return;
    }
    try {
      (this.props.hideSplash ?? defaultHideSplash)();
    } catch {
      /* splash API may be missing in a given host */
    }
  }

  handleRetry = (): void => {
    // Clears the children path. On the expo-router path the state is already
    // empty and it is `retry` below that clears `Try`'s.
    this.setState({ caught: undefined });
    const { retry } = this.props;
    if (!retry) return;
    // The recovery door must not itself throw or reject into an unguarded
    // promise — there is no boundary above this one on position 1.
    try {
      void Promise.resolve(retry()).catch(() => {});
    } catch {
      /* a failed retry leaves the screen exactly as it was */
    }
  };

  render(): ReactNode {
    const error = this.state.caught ?? this.props.error;
    if (error === undefined) return this.props.children ?? null;

    const surface = resolveRootCrashPresentation(error);
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <View style={styles.canvas}>
          <ErrorState
            testID={surface.testID}
            retry={surface.retry}
            cta={surface.cta}
            title={surface.title}
            body={surface.body}
            ctaLabel={surface.ctaLabel}
            onPress={this.handleRetry}
          />
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  canvas: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.gutter,
  },
});

function defaultHideSplash(): void {
  SplashScreen.hideAsync().catch(() => {
    /* non-fatal */
  });
}

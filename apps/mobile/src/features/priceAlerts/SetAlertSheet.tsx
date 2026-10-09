import { typography } from '@/src/ui/tokens';
import { useEffect, useRef, useState } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { copy } from '@/constants/copy';
import { CorsoText } from '@/src/theme/CorsoText';
import { CorsoGlass } from '@/src/ui/glass/CorsoGlass';
import { resolveEthenaMaterial } from '@/src/ui/ethena/materialLaw';
import { resolveFloatGlassSurface } from '@/src/ui/glass/corsoGlassRecipe';
import { EthenaPill } from '@/src/ui/ethena/EthenaPrimitives';
import { Grabber } from '@/src/ui/primitives/Grabber';
import { Scrim } from '@/src/ui/primitives/Scrim';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import {
  resolveBottomSheetBodyFadeTop,
  resolveBottomSheetBottomInset,
} from '@/src/ui/primitives/bottomSheetPresentation';
import { useKeyboardOverlapInset } from '@/src/ui/primitives/useKeyboardOverlapInset';
import {
  ALERT_COPY,
  alertLine,
  currentPriceLine,
  safeAlertSymbol,
} from './alertCopy';
import { PUSH_COPY } from './pushRegistration';
import {
  ALERT_CAP,
  normalizePriceInput,
  refusal,
  isFreshPrice,
  type Direction,
  type SpotPrice,
} from './alertModel';
export type SetAlertSheetProps = {
  symbol: string;
  visible: boolean;
  onClose(): void;
  readPrice(): Promise<SpotPrice | null>;
  save(direction: Direction, threshold: string): Promise<void>;
  registerPush(): Promise<'off' | 'in-app' | 'registered'>;
};
export function SetAlertSheet(props: SetAlertSheetProps) {
  const inset = useKeyboardOverlapInset();
  const safe = useSafeAreaInsets();
  const [direction, setDirection] = useState<Direction>('above');
  const [raw, setRaw] = useState('');
  const [spot, setSpot] = useState<SpotPrice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [pushOff, setPushOff] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const live = useRef(true);
  const [fadeTop, setFadeTop] = useState(0);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  useEffect(() => {
    if (confirmation) return;
    let current = true;
    const refreshPrice = () => {
      void props
        .readPrice()
        .then((value) => {
          if (current) {
            setSpot(value);
            setError((previous) =>
              !isFreshPrice(value)
                ? ALERT_COPY.noPrice
                : previous === ALERT_COPY.noPrice
                  ? null
                  : previous,
            );
          }
        })
        .catch(() => {
          if (current) {
            setSpot(null);
            setError(ALERT_COPY.noPrice);
          }
        });
    };
    refreshPrice();
    const timer = setInterval(refreshPrice, 15000);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [props.readPrice, confirmation]);
  const threshold = normalizePriceInput(raw);
  const symbol = safeAlertSymbol(props.symbol);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const freshSpot = isFreshPrice(spot, now);
  const surface = resolveEthenaMaterial('float');
  async function setAlert() {
    if (busyRef.current || !threshold || !symbol || confirmation) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const fresh = await props.readPrice();
      if (!live.current) return;
      setSpot(fresh);
      const reason = refusal(direction, threshold, fresh);
      if (reason) {
        setError(
          reason === 'crossed'
            ? alertLine('crossed', props.symbol, direction, threshold)
            : ALERT_COPY.noPrice,
        );
        return;
      }
      await props.save(direction, threshold);
      if (!live.current) return;
      setConfirmation(
        alertLine('confirmation', props.symbol, direction, threshold),
      );
      // Registration failures do not turn a saved alert into a failed save.
      const result = await props.registerPush().catch(() => null);
      if (live.current) setPushOff(result === 'in-app');
    } catch (error) {
      if (!live.current) return;
      const code =
        error && typeof error === 'object' && 'code' in error ? error.code : '';
      setError(
        code === 'price_alert_already_crossed'
          ? alertLine('crossed', props.symbol, direction, threshold)
          : code === 'price_alert_wallet_full'
            ? ALERT_COPY.cap.replace('{N}', String(ALERT_CAP))
            : code === 'price_alert_exists'
              ? ALERT_COPY.exists
              : code === 'disabled'
                ? ALERT_COPY.off
                : code === 'price_alert_unavailable'
                  ? ALERT_COPY.failed
                  : ALERT_COPY.failed,
      );
    } finally {
      busyRef.current = false;
      if (live.current) setBusy(false);
    }
  }
  return (
    <Modal
      transparent
      visible={props.visible}
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={props.onClose}
    >
      <View
        testID="set-alert-backdrop"
        style={[styles.backdrop, { paddingBottom: inset }]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={props.onClose}
          accessibilityLabel={copy.v1.dismissSheet(ALERT_COPY.title)}
        >
          <Scrim />
        </Pressable>
        <CorsoGlass
          testID="set-alert-sheet"
          material={surface.material}
          tint={surface.tint ?? undefined}
          radius={ethenaGeometry.radiusSheet}
          style={[
            styles.sheet,
            { paddingBottom: resolveBottomSheetBottomInset(safe.bottom) },
          ]}
        >
          <Grabber />
          <CorsoText style={styles.title} accessibilityRole="header">
            {ALERT_COPY.title}
          </CorsoText>
          <View style={styles.scrollWrap}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              scrollEventThrottle={16}
              onScroll={(event) =>
                setFadeTop(
                  resolveBottomSheetBodyFadeTop(
                    event.nativeEvent.contentOffset.y,
                  ),
                )
              }
              contentContainerStyle={styles.body}
            >
              {confirmation ? (
                <CorsoText testID="alert-confirmation" style={styles.text}>
                  {confirmation}
                </CorsoText>
              ) : (
                <>
                  <View style={styles.directions}>
                    {(['above', 'below'] as const).map((value) => (
                      <Pressable
                        key={value}
                        testID={`alert-${value}`}
                        accessibilityRole="button"
                        accessibilityState={{
                          selected: direction === value,
                          disabled: busy,
                        }}
                        disabled={busy}
                        onPress={() => {
                          setDirection(value);
                          setError(null);
                        }}
                        style={[
                          styles.direction,
                          direction === value ? styles.selected : null,
                        ]}
                      >
                        <CorsoText style={styles.text}>
                          {ALERT_COPY[value]}
                        </CorsoText>
                      </Pressable>
                    ))}
                  </View>
                  <CorsoText style={styles.text}>{ALERT_COPY.price}</CorsoText>
                  <TextInput
                    testID="alert-price"
                    accessibilityLabel={ALERT_COPY.price}
                    value={raw}
                    editable={!busy}
                    onChangeText={(value) => {
                      setRaw(value);
                      setError((previous) =>
                        previous === ALERT_COPY.noPrice ? previous : null,
                      );
                    }}
                    keyboardType="decimal-pad"
                    style={styles.input}
                  />
                  {spot && freshSpot && symbol ? (
                    <CorsoText
                      testID="alert-current-price"
                      style={styles.helper}
                    >
                      {currentPriceLine(symbol!, spot.price)}
                    </CorsoText>
                  ) : null}
                  {error || (spot && !freshSpot) || !symbol ? (
                    <CorsoText testID="alert-error" style={styles.helper}>
                      {!symbol ? ALERT_COPY.off : (error ?? ALERT_COPY.noPrice)}
                    </CorsoText>
                  ) : null}
                </>
              )}
              {pushOff ? (
                <>
                  <View style={styles.actionRow}>
                    <EthenaPill
                      testID="alert-settings"
                      label={PUSH_COPY.settings}
                      plane="ground"
                      onPress={() =>
                        void Linking.openSettings().catch(() => {})
                      }
                    />
                  </View>
                </>
              ) : null}
              <View style={{ height: 32 }} />
            </ScrollView>
            <ScrollEdgeFade
              top={fadeTop}
              color={resolveFloatGlassSurface(surface.tint ?? undefined)}
            />
          </View>
          {!confirmation ? (
            <View style={styles.actionRow}>
              <EthenaPill
                testID="alert-set"
                label={ALERT_COPY.set}
                disabled={busy || !threshold || !freshSpot || !symbol}
                plane="ground"
                onPress={() => void setAlert()}
              />
            </View>
          ) : null}
        </CorsoGlass>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  actionRow: { flexDirection: 'row', alignSelf: 'stretch' },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    marginHorizontal: 8,
    marginBottom: 8,
    paddingHorizontal: ethenaGeometry.gutter,
    paddingTop: 12,
    gap: 12,
    flexShrink: 1,
    overflow: 'hidden',
  },
  title: {
    ...ETHENA_TYPE.navMid,
    color: ethena.ink.primary,
    textAlign: 'center',
  },
  text: { ...ETHENA_TYPE.body, color: ethena.ink.primary },
  helper: { ...ETHENA_TYPE.body, color: ethena.ink.tertiary },
  scrollWrap: { flexShrink: 1, position: 'relative' },
  body: { gap: 12 },
  directions: { flexDirection: 'row', gap: 8 },
  direction: {
    flex: 1,
    minHeight: typography.control,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: ethenaGeometry.radiusSheet,
  },
  selected: { backgroundColor: ethena.crest },
  input: {
    ...ETHENA_TYPE.body,
    color: ethena.ink.primary,
    minHeight: typography.control,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ethena.hair,
  },
});

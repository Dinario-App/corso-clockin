import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { addCashCopy as words } from '@/constants/copy/addCash';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ethena } from '@/constants/theme.ethena';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { CorsoText } from '@/src/theme/CorsoText';
import { ScreenHeader } from '@/src/ui/navigation/ScreenHeader';
import {
  EthenaGround,
  EthenaPill,
  EthenaTray,
} from '@/src/ui/ethena/EthenaPrimitives';
import type { RampAvailability } from '@/src/features/ramp/moonPayFlow';
import {
  useRampQuote,
  type LoadRampQuote,
} from '@/src/features/ramp/rampQuote';
import { parseCashAmount } from '@/src/features/ramp/addCashAmount';

import { ADD_CASH_QUOTE_ROWS } from '@/src/features/ramp/addCashQuoteRows';
import { formatFiatAmount } from '@/src/ui/format/numberCraft';

type Availability = RampAvailability | { status: 'loading' };
/** Provider USD at cents or finer: pads, groups, drops no digit. */
function quoteUsd(value: number | null | undefined): string | null {
  if (typeof value !== 'number') return null;
  const [whole, fraction = ''] = String(value).split('.');
  return formatFiatAmount(`${whole}.${fraction.padEnd(2, '0')}`);
}
export function AddCashScreen({
  availability,
  busy,
  topInset,
  bottomInset,
  onClose,
  onReview,
  loadQuote,
}: {
  loadQuote?: LoadRampQuote;
  availability: Availability;
  busy: boolean;
  topInset: number;
  bottomInset: number;
  onClose: () => void;
  onReview: (amount: number) => void;
}) {
  const [raw, setRaw] = useState('250');
  const [other, setOther] = useState(false);
  const amount = parseCashAmount(raw);
  const showAmount =
    availability.status === 'ready' || availability.status === 'offline';
  const { quote, limits, inRange, loading } = useRampQuote(
    amount,
    ADD_CASH_QUOTE_ROWS && availability.status === 'ready' && !busy,
    loadQuote,
  );
  const usdRows =
    ADD_CASH_QUOTE_ROWS && quote
      ? ([
          [words.rowYouPay, quoteUsd(quote.totalAmount)],
          [words.rowProviderFee, quoteUsd(quote.feeAmount)],
          [words.rowNetworkFee, quoteUsd(quote.networkFeeAmount)],
        ] as const)
      : null;
  // A value the formatter refuses keeps the 07-a line, never a raw number.
  const quoteRows =
    quote && usdRows?.every(([, value]) => value !== null)
      ? [
          ...usdRows,
          [words.rowLands, `${String(quote.quoteCurrencyAmount)} USDC`],
        ]
      : null;
  const minimum = quoteUsd(limits?.minBuyAmount);
  const maximum = quoteUsd(limits?.maxBuyAmount);
  const enabled =
    availability.status === 'ready' &&
    amount !== null &&
    !busy &&
    !loading &&
    inRange;
  return (
    <EthenaGround>
      <View style={{ paddingTop: topInset }}>
        <ScreenHeader
          family="desk"
          title={words.title}
          onBack={onClose}
          backAccessibilityLabel={words.close}
          backGlyph="close"
          testID="add-cash-header"
        />
      </View>
      <View style={{ flex: 1, position: 'relative' }}>
        <ScrollView
          testID="add-cash-body"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.body,
            { paddingBottom: bottomInset + 24 },
          ]}
        >
          {showAmount && (
            <>
              <CorsoText testID="add-cash-amount" style={styles.amount}>
                {amount === null ? '—' : `$${amount.toFixed(2)}`}
              </CorsoText>
              <View style={styles.chips}>
                {[50, 250, 500].map((value) => (
                  <Pressable
                    key={value}
                    testID={`add-cash-${value}`}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: !other && amount === value,
                    }}
                    onPress={() => {
                      setRaw(String(value));
                      setOther(false);
                    }}
                    style={[
                      styles.chip,
                      !other && amount === value && styles.selected,
                    ]}
                  >
                    <CorsoText style={styles.chipText}>${value}</CorsoText>
                  </Pressable>
                ))}
                <Pressable
                  testID="add-cash-other"
                  accessibilityRole="button"
                  accessibilityState={{ selected: other }}
                  onPress={() => setOther(true)}
                  style={[styles.chip, other && styles.selected]}
                >
                  <CorsoText style={styles.chipText}>
                    {words.chipOther}
                  </CorsoText>
                </Pressable>
              </View>
              {other && (
                <TextInput
                  testID="add-cash-input"
                  accessibilityLabel={words.amountLabel}
                  value={raw}
                  onChangeText={setRaw}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              )}
              <EthenaTray testID="add-cash-fees" style={styles.fees}>
                {quoteRows ? (
                  <>
                    {quoteRows.map(([label, value]) => (
                      <View key={label} style={styles.quoteRow}>
                        <CorsoText style={styles.bodyText}>{label}</CorsoText>
                        <CorsoText
                          style={
                            label === words.rowLands
                              ? styles.lands
                              : styles.bodyText
                          }
                        >
                          {value}
                        </CorsoText>
                      </View>
                    ))}
                  </>
                ) : (
                  <CorsoText style={styles.bodyText}>
                    {words.quoteFallback}
                  </CorsoText>
                )}
              </EthenaTray>
              {ADD_CASH_QUOTE_ROWS && minimum !== null && (
                <CorsoText style={styles.muted}>
                  {words.minimum} {minimum}
                </CorsoText>
              )}
              {ADD_CASH_QUOTE_ROWS && maximum !== null && (
                <CorsoText style={styles.muted}>
                  {words.maximum} {maximum}
                </CorsoText>
              )}
              <CorsoText style={styles.muted}>{words.finePrint}</CorsoText>
            </>
          )}
          {availability.status === 'loading' && (
            <ActivityIndicator
              testID="add-cash-loading"
              accessibilityRole="progressbar"
              color={ethena.ink.primary}
            />
          )}
          {!showAmount && (
            <CorsoText style={styles.bodyText}>{words.quoteFallback}</CorsoText>
          )}
          {'message' in availability && (
            <CorsoText accessibilityRole="alert" style={styles.bodyText}>
              {availability.message}
            </CorsoText>
          )}
          {showAmount && (
            <View style={styles.floor}>
              <EthenaPill
                testID="add-cash-review"
                label={words.review}
                plane="cta"
                disabled={!enabled}
                onPress={() => {
                  if (enabled) onReview(amount);
                }}
                style={{ flex: 0 }}
              />
            </View>
          )}
        </ScrollView>
        <ScrollEdgeFade
          top={12}
          bottom={24}
          color={ethena.groundStops[0][1]}
        />
      </View>
    </EthenaGround>
  );
}
const styles = StyleSheet.create({
  body: {
    flexGrow: 1,
    paddingHorizontal: ethenaGeometry.gutter,
    paddingTop: 36,
    gap: 24,
  },
  amount: {
    ...ETHENA_TYPE.amount,
    color: ethena.ink.primary,
    textAlign: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  chip: {
    minHeight: ethenaGeometry.pillHeight,
    minWidth: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: ethena.tray,
  },
  selected: { borderWidth: 1, borderColor: ethena.ink.primary },
  chipText: {
    ...ETHENA_TYPE.pill,
    color: ethena.ink.primary,
    textAlign: 'center',
  },
  input: {
    ...ETHENA_TYPE.rowValue,
    color: ethena.ink.primary,
    minHeight: ethenaGeometry.pillHeight,
    padding: 16,
    borderRadius: 16,
    backgroundColor: ethena.tray,
  },
  fees: { paddingVertical: 20, gap: 12 },
  quoteRow: {
    minHeight: 32,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  lands: { ...ETHENA_TYPE.keyValueTotal, color: ethena.ink.primary },
  bodyText: { ...ETHENA_TYPE.body, color: ethena.ink.primary },
  muted: { ...ETHENA_TYPE.body, color: ethena.ink.secondary },
  floor: { marginTop: 'auto', paddingTop: 24 },
});

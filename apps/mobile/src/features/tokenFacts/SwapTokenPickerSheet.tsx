import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  type TextStyle,
  View,
} from 'react-native';
import { useKeyboardOverlapInset } from '@/src/ui/primitives/useKeyboardOverlapInset';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { copy } from '@/constants/copy';
import { colors, typography } from '@/constants/theme';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { resolveEthenaMaterial } from '@/src/ui/ethena/materialLaw';
import { CorsoGlass } from '@/src/ui/glass/CorsoGlass';
import { resolveFloatGlassSurface } from '@/src/ui/glass/corsoGlassRecipe';
import { CorsoText } from '@/src/theme/CorsoText';
import { liftInkColor } from '@/src/ui/glass/inkContrast';
import { useInkContrastEnabled } from '@/src/ui/glass/useInkContrast';
import {
  buildPickerRows,
  type PickerRow,
} from '@/src/features/swap/heldTokenPicker';
import {
  fetchTokenSearchOutcome,
  type TokenSearchResult,
} from '@/src/features/swap/fetchTokenSearch';
import {
  buildPickerFactsSubtitle,
  buildPickerRowRisk,
  buildTokenIdentityPresentation,
} from '@/src/features/tokenFacts/formatTokenFactsDisplay';
import { resolveRugcheckDangerLinePresentation } from '@/src/features/tokenFacts/rugcheckReviewPresentation';
import { useTokenFacts } from '@/src/features/tokenFacts/useTokenFacts';
import type { SwapToken } from '@/src/features/swap/tokens';
import { resolveAcquireAccess } from '@/src/features/security/acquireAccessPresentation';
import type { JurisdictionGateInputs } from '@/src/features/security/jurisdictionGateInputs';
import { useAcquireGateInputs } from '@/src/features/security/useAcquireGateInputs';
import { Scrim } from '@/src/ui/primitives/Scrim';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import {
  resolveBottomSheetBodyFadeTop,
  resolveBottomSheetBottomInset,
} from '@/src/ui/primitives/bottomSheetPresentation';

/** Long enough that every keystroke is not a Jupiter round trip. */
const SEARCH_DEBOUNCE_MS = 300;
/** One character matches half the chain; two is the shortest useful query. */
const MIN_SEARCH_LENGTH = 2;

function TokenPickerOption({
  token,
  selected,
  onSelect,
  nowMs,
  searchIdentity,
  acquireGateInputs,
}: {
  token: SwapToken;
  selected: boolean;
  onSelect: () => void;
  nowMs: number;
  searchIdentity: TokenSearchResult | null;
  acquireGateInputs: JurisdictionGateInputs | null;
}) {
  const { status, facts, error } = useTokenFacts(token.mint);
  const subtitle = buildPickerFactsSubtitle({
    status,
    facts,
    error,
    nowMs,
    includeIdentity: false,
  });
  // RugCheck risk is a separate speech act from Jupiter identity verification.
  // It may add a provider-backed warning line, but it never supplies the
  // Verified label below.
  const risk = buildPickerRowRisk({ status, facts });
  const dangerLine = resolveRugcheckDangerLinePresentation(risk);
  const jupiterFacts =
    facts?.sources.jupiter.status === 'ok'
      ? facts.sources.jupiter.fields
      : null;
  const identity = buildTokenIdentityPresentation({
    mint: token.mint,
    isVerified: jupiterFacts?.isVerified ?? null,
    liquidityUsd: jupiterFacts?.liquidityUsd ?? null,
  });
  const acquireAccess = resolveAcquireAccess({
    gateInputs: acquireGateInputs,
    mint: token.mint,
    symbol: token.symbol,
    name: jupiterFacts?.name ?? null,
  });
  const acquireRefusedNote =
    acquireAccess.kind === 'refused' ? acquireAccess.note : null;
  const accessibilityLabel = [
    token.symbol,
    identity.mintLabel,
    identity.verificationLabel,
    identity.liquidityLabel ??
      `${copy.tokenFacts.liquidity} ${copy.tokenFacts.unknown.toLowerCase()}`,
    subtitle,
    risk.ambientDescription,
    dangerLine?.text,
    acquireRefusedNote,
  ]
    .filter((part): part is string => part != null)
    .join(', ');

  return (
    <Pressable
      style={styles.row}
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.rowMain}>
        <CorsoText style={styles.symbol}>{token.symbol}</CorsoText>
        <CorsoText style={styles.mintTail}>{identity.mintLabel}</CorsoText>
        <View style={styles.identityLine}>
          <CorsoText
            style={[
              styles.verification,
              identity.verificationTone === 'riskDanger' &&
                styles.verificationRisk,
            ]}
          >
            {identity.verificationLabel}
          </CorsoText>
          <CorsoText style={styles.identitySeparator}>
            {' · '}
            {identity.liquidityLabel ??
              `${copy.tokenFacts.liquidity} ${copy.tokenFacts.unknown.toLowerCase()}`}
          </CorsoText>
        </View>
        <CorsoText style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </CorsoText>
        {risk.ambientDescription ? (
          <CorsoText style={styles.riskLine} numberOfLines={2}>
            {risk.ambientDescription}
          </CorsoText>
        ) : null}
        {dangerLine ? (
          <CorsoText
            style={[styles.dangerLine, dangerLine.style]}
            numberOfLines={2}
          >
            {dangerLine.text}
          </CorsoText>
        ) : null}
        {acquireRefusedNote ? (
          <CorsoText style={styles.riskLine} numberOfLines={2}>
            {acquireRefusedNote}
          </CorsoText>
        ) : null}
      </View>
      {selected ? <CorsoText style={styles.check}>✓</CorsoText> : null}
    </Pressable>
  );
}

export function SwapTokenPickerSheet({
  visible,
  tokens,
  selectedMint,
  onSelect,
  onClose,
  nowMs = Date.now(),
  allowSearch = false,
  acquireRows = false,
}: {
  visible: boolean;
  /** What they hold. Always rendered above search results. */
  tokens: SwapToken[];
  selectedMint: string;
  onSelect: (token: SwapToken) => void;
  onClose: () => void;
  nowMs?: number;
  allowSearch?: boolean;
  acquireRows?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const sheetMaterial = resolveEthenaMaterial('float');
  // The placeholder is the sheet's one tertiary ink, and a TextInput does not
  // go through CorsoText, so it takes the Increase Contrast lift here.
  const increaseContrast = useInkContrastEnabled();
  const gateInputs = useAcquireGateInputs(visible && acquireRows);
  const acquireGateInputs = acquireRows ? gateInputs : null;
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TokenSearchResult[]>([]);
  // `searching` runs from the keystroke until that query's search settles, so
  // an open search does not look like a sheet nobody typed in. `failed` is a
  // failure this side can see; the API answers its own vendor's failure as a
  // search that ran, so that one settles as `ran`.
  const [searchPhase, setSearchPhase] = useState<
    'idle' | 'searching' | 'ran' | 'failed'
  >('idle');
  // Bumped by Retry to run the same query again.
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [fadeTop, setFadeTop] = useState(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!visible || !allowSearch || trimmed.length < MIN_SEARCH_LENGTH) {
      setSearchResults([]);
      setSearchPhase('idle');
      return;
    }

    setSearchPhase('searching');
    const abort = new AbortController();
    const handle = setTimeout(() => {
      void (async () => {
        const outcome = await fetchTokenSearchOutcome({
          query: trimmed,
          signal: abort.signal,
        });
        if (!abort.signal.aborted) {
          setSearchResults(outcome.status === 'ok' ? outcome.results : []);
          setSearchPhase(outcome.status === 'ok' ? 'ran' : 'failed');
        }
      })();
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(handle);
      abort.abort();
    };
  }, [allowSearch, query, searchAttempt, visible]);

  const rows: PickerRow[] = useMemo(
    () =>
      buildPickerRows({
        held: tokens,
        searchResults: searchResults.map((result) => result.token),
        query,
      }),
    [tokens, searchResults, query],
  );
  const searchIdentityByMint = useMemo(
    () => new Map(searchResults.map((result) => [result.token.mint, result])),
    [searchResults],
  );

  async function pasteMint() {
    try {
      const next = await Clipboard.getStringAsync();
      setQuery(next.trim());
    } catch {
      // Stay on the typed query.
    }
  }

  function close() {
    setQuery('');
    setSearchResults([]);
    setFadeTop(0);
    onClose();
  }

  const keyboardInset = useKeyboardOverlapInset();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}
    >
      <Pressable
        style={
          keyboardInset > 0
            ? [styles.backdrop, { paddingBottom: keyboardInset }]
            : styles.backdrop
        }
        onPress={close}
      >
        <Scrim />
        <Pressable
          style={styles.sheetSlot}
          onPress={(event) => event.stopPropagation()}
        >
          <CorsoGlass
            testID="swap-token-picker-sheet"
            material={sheetMaterial.material}
            tint={sheetMaterial.tint ?? undefined}
            radius={ethenaGeometry.radiusSheet}
            style={[
              styles.sheet,
              { paddingBottom: resolveBottomSheetBottomInset(insets.bottom) },
            ]}
          >
            <View style={styles.grabberRow}>
              <View style={styles.grabber} />
            </View>
            <CorsoText accessibilityRole="header" style={styles.title}>
              {copy.v1.pickAToken}
            </CorsoText>
            <View style={styles.searchRow}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={copy.v1.searchOrPaste}
                placeholderTextColor={liftInkColor(
                  ethena.ink.tertiary,
                  increaseContrast,
                )}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.search}
                accessibilityLabel={copy.v1.searchOrPaste}
              />
              <Pressable
                onPress={() => {
                  void pasteMint();
                }}
                accessibilityRole="button"
                accessibilityLabel={copy.v1.paste}
                style={styles.paste}
              >
                <CorsoText style={styles.pasteLabel}>{copy.v1.paste}</CorsoText>
              </Pressable>
            </View>
            {allowSearch ? (
              <CorsoText style={styles.verifiedMeaning}>
                {copy.tokenFacts.verifiedMeaning}
              </CorsoText>
            ) : null}
            <View style={styles.scrollWrap}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                scrollEventThrottle={16}
                onScroll={(event) => {
                  const next = resolveBottomSheetBodyFadeTop(
                    event.nativeEvent.contentOffset.y,
                  );
                  setFadeTop((prev) => (prev === next ? prev : next));
                }}
              >
                {rows.map((row) => (
                  <TokenPickerOption
                    key={row.token.mint}
                    token={row.token}
                    selected={row.token.mint === selectedMint}
                    nowMs={nowMs}
                    searchIdentity={
                      searchIdentityByMint.get(row.token.mint) ?? null
                    }
                    acquireGateInputs={acquireGateInputs}
                    onSelect={() => {
                      onSelect(row.token);
                      close();
                    }}
                  />
                ))}
                {/* The label is for a screen reader only; nothing is printed. */}
                {searchPhase === 'searching' ? (
                  <View style={styles.searchStatus}>
                    <ActivityIndicator
                      color={ethena.ink.primary}
                      accessible
                      accessibilityRole="progressbar"
                      accessibilityLabel={copy.v1.searching}
                    />
                  </View>
                ) : null}
                {/* Only when the sheet has no row at all: a held match is
                    something to show. */}
                {searchPhase === 'ran' && rows.length === 0 ? (
                  <View style={styles.searchStatus}>
                    <CorsoText style={styles.searchStatusLine}>
                      {copy.v1.searchNothing}
                    </CorsoText>
                  </View>
                ) : null}
                {searchPhase === 'failed' ? (
                  <View style={styles.searchStatus}>
                    <CorsoText style={styles.searchStatusLine}>
                      {copy.v1.searchFailed}
                    </CorsoText>
                    <Pressable
                      onPress={() => setSearchAttempt((n) => n + 1)}
                      accessibilityRole="button"
                      accessibilityLabel={copy.vitals.retry}
                      style={styles.paste}
                    >
                      <CorsoText style={styles.pasteLabel}>
                        {copy.vitals.retry}
                      </CorsoText>
                    </Pressable>
                  </View>
                ) : null}
              </ScrollView>
              <ScrollEdgeFade
                top={fadeTop}
                color={resolveFloatGlassSurface(
                  sheetMaterial.tint ?? undefined,
                )}
              />
            </View>
          </CorsoGlass>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetSlot: {
    zIndex: 1,
    maxHeight: '85%',
  },
  sheet: {
    marginHorizontal: 8,
    marginBottom: 8,
    overflow: 'hidden',
    paddingHorizontal: ethenaGeometry.gutter,
    gap: 4,
    flexShrink: 1,
  },
  grabberRow: { alignItems: 'center', paddingTop: 10, paddingBottom: 8 },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: ethena.ink.tertiary,
  },
  scrollWrap: { flexShrink: 1, position: 'relative' },
  title: {
    ...ETHENA_TYPE.navMid,
    color: ethena.ink.primary,
    textAlign: 'center',
    paddingBottom: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  search: {
    flex: 1,
    minHeight: 44,
    color: ethena.ink.primary,
    ...ETHENA_TYPE.body,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ethena.hair,
  },
  paste: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  pasteLabel: {
    ...ETHENA_TYPE.cardAction,
    color: ethena.ink.primary,
    fontWeight: '600',
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ethena.hair,
    gap: 12,
    paddingVertical: 4,
  },
  // 18 + a 20pt spinner + 18 is one row, so the first result takes the
  // spinner's place without a jump.
  searchStatus: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  searchStatusLine: {
    ...ETHENA_TYPE.rowSub,
    color: ethena.ink.secondary,
    textAlign: 'center',
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  mintTail: {
    ...ETHENA_TYPE.rowSub,
    color: ethena.ink.secondary,
    fontVariant: [...typography.fontVariantMono] as TextStyle['fontVariant'],
  },
  identityLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  verification: {
    ...ETHENA_TYPE.rowSub,
    color: ethena.ink.secondary,
    fontWeight: '600',
  },
  verificationRisk: {
    color: colors.riskDanger,
  },
  identitySeparator: {
    ...ETHENA_TYPE.rowSub,
    color: ethena.ink.secondary,
  },
  verifiedMeaning: {
    ...ETHENA_TYPE.rowSub,
    color: ethena.ink.secondary,
    marginBottom: 8,
  },
  symbol: {
    ...ETHENA_TYPE.rowName,
    color: ethena.ink.primary,
  },
  subtitle: {
    ...ETHENA_TYPE.rowSub,
    color: ethena.ink.secondary,
  },
  riskLine: {
    ...ETHENA_TYPE.rowSub,
    color: ethena.ink.primary,
  },
  dangerLine: {
    fontSize: ETHENA_TYPE.rowSub.fontSize,
    color: colors.riskDanger,
    fontWeight: '600',
  },
  check: {
    ...ETHENA_TYPE.rowName,
    color: ethena.ink.primary,
    fontWeight: '600',
  },
});

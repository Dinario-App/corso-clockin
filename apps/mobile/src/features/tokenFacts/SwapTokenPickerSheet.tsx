import { usePlainRisk } from '@/src/features/plainRisk/usePlainRisk';
import { RiskLevelSlot, spokenRiskLevel } from '@/src/ui/risk/RiskLevel';
import { useMemo, useState } from 'react';
import {
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
import { matchPickerQuery } from '@/src/features/swap/heldTokenPicker';
import {
  curatedSwapToken,
  searchCuratedBook,
  type CuratedBook,
  type CuratedName,
} from '@/src/features/universe/curatedBook';
import type { CuratedBookState } from '@/src/features/universe/useCuratedBook';
import {
  buildPickerFactsSubtitle,
  buildTokenIdentityPresentation,
} from '@/src/features/tokenFacts/formatTokenFactsDisplay';
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

/**
 * Two characters is the shortest useful query, and every listed row reads its
 * own facts, so one character does not list half the book.
 */
const MIN_SEARCH_LENGTH = 2;

/**
 * One sheet row: a held token as the caller handed it, or a curated-book name.
 */
type SheetRow = {
  mint: string;
  symbol: string;
  held: SwapToken | null;
  curated: CuratedName | null;
};

function TokenPickerOption({
  token,
  held,
  curated,
  selected,
  onSelect,
  nowMs,
  acquireGateInputs,
}: {
  token: { mint: string; symbol: string };
  held: SwapToken | null;
  curated: CuratedName | null;
  selected: boolean;
  onSelect: (token: SwapToken) => void;
  nowMs: number;
  acquireGateInputs: JurisdictionGateInputs | null;
}) {
  const { status, facts, error } = useTokenFacts(token.mint);
  const chainDecimals =
    facts?.mint === token.mint && facts.sources.chain.status === 'ok'
      ? facts.sources.chain.fields.decimals
      : null;
  const pick =
    held ??
    (curated
      ? curatedSwapToken(curated, curated.decimals ?? chainDecimals)
      : null);
  const subtitle = buildPickerFactsSubtitle({
    status,
    facts,
    error,
    nowMs,
    includeIdentity: false,
  });
  const plainRisk = usePlainRisk(token.mint);
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
    spokenRiskLevel(plainRisk),
    acquireRefusedNote,
  ]
    .filter((part): part is string => part != null)
    .join(', ');

  return (
    <Pressable
      style={styles.row}
      onPress={() => {
        if (pick) onSelect(pick);
      }}
      disabled={pick == null}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: pick == null }}
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
        <RiskLevelSlot read={plainRisk} testID={`picker-row-${token.mint}-risk`} />
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
  book = null,
  bookState = 'loading',
  acquireRows = false,
}: {
  visible: boolean;
  /** What they hold. Always rendered above search results. */
  tokens: SwapToken[];
  selectedMint: string;
  onSelect: (token: SwapToken) => void;
  onClose: () => void;
  nowMs?: number;
  book?: CuratedBook | null;
  bookState?: CuratedBookState;
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
  const [fadeTop, setFadeTop] = useState(0);

  const trimmedQuery = query.trim();
  const searched = book != null && trimmedQuery.length >= MIN_SEARCH_LENGTH;
  const rows: SheetRow[] = useMemo(() => {
    const heldRows = matchPickerQuery(tokens, query).map(
      (token): SheetRow => ({
        mint: token.mint,
        symbol: token.symbol,
        held: token,
        curated: null,
      }),
    );
    if (!searched || book == null) return heldRows;
    const seen = new Set(heldRows.map((row) => row.mint));
    const bookRows = searchCuratedBook(book, query)
      .filter((name) => !seen.has(name.mint))
      .map(
        (name): SheetRow => ({
          mint: name.mint,
          symbol: name.symbol,
          held: null,
          curated: name,
        }),
      );
    return [...heldRows, ...bookRows];
  }, [tokens, query, book, searched]);

  function close() {
    setQuery('');
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
                placeholder={copy.sleeve.findToken}
                placeholderTextColor={liftInkColor(
                  ethena.ink.tertiary,
                  increaseContrast,
                )}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.search}
                accessibilityLabel={copy.sleeve.findToken}
              />
            </View>
            {book != null ? (
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
                    key={row.mint}
                    token={row}
                    held={row.held}
                    curated={row.curated}
                    selected={row.mint === selectedMint}
                    nowMs={nowMs}
                    acquireGateInputs={acquireGateInputs}
                    onSelect={(token) => {
                      onSelect(token);
                      close();
                    }}
                  />
                ))}
                {/* Only when the sheet has no row at all: a held match is
                    something to show. */}
                {searched && rows.length === 0 && bookState === 'served' ? (
                  <View style={styles.searchStatus}>
                    <CorsoText style={styles.searchStatusTitle}>
                      {copy.v1.searchNoMatchTitle}
                    </CorsoText>
                    <CorsoText style={styles.searchStatusLine}>
                      {copy.v1.searchNoMatchBody}
                    </CorsoText>
                  </View>
                ) : null}
                {searched && rows.length === 0 && bookState === 'failed' ? (
                  <View style={styles.searchStatus}>
                    <CorsoText style={styles.searchStatusLine}>
                      {copy.v1.searchFailed}
                    </CorsoText>
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
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ethena.hair,
    gap: 12,
    paddingVertical: 4,
  },
  searchStatus: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 18,
  },
  searchStatusTitle: {
    ...ETHENA_TYPE.navMid,
    color: ethena.ink.primary,
    textAlign: 'center',
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

import type { Ref } from 'react';
import {
  PanResponder,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useKeyboardOverlapInset } from '@/src/ui/primitives/useKeyboardOverlapInset';
import { CorsoText } from '@/src/theme/CorsoText';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_BODY_MARGIN, ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { EthenaPill, EthenaTray } from '@/src/ui/ethena/EthenaPrimitives';
import { resolveEthenaMaterial } from '@/src/ui/ethena/materialLaw';
import { CorsoGlass } from '@/src/ui/glass/CorsoGlass';
import { resolveFloatGlassSurface } from '@/src/ui/glass/corsoGlassRecipe';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { SCROLL_FADE_BOTTOM } from '@/src/ui/primitives/scrollEdgeFadePresentation';
import type {
  AskCardRow,
  AskChip,
  AskSheetCard,
  AskSheetView,
} from '@/src/ui/ethena/askSheetModel';

export function AskSheet({
  view,
  draft,
  inputRef,
  bottomInset,
  onChangeDraft,
  onSend,
  onChip,
  onDoor,
  onOpen,
  onOpenReview,
  onWait,
  onClose,
}: {
  view: AskSheetView;
  draft: string;
  inputRef?: Ref<TextInput>;
  /** The phone's home-indicator inset. */
  bottomInset: number;
  onChangeDraft?: (text: string) => void;
  onSend?: () => void;
  onChip?: (key: string) => void;
  onDoor?: (key: string) => void;
  onOpen?: () => void;
  onOpenReview?: () => void;
  onWait?: () => void;
  onClose?: () => void;
}) {
  const sheet = resolveEthenaMaterial('float');
  const field = resolveEthenaMaterial('ground');
  const drag = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy > 4,
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dy > 48) onClose?.();
    },
  });
  const canSend = view.composer.enabled && draft.trim().length > 0;
  const keyboardInset = useKeyboardOverlapInset();

  return (
    <View
      testID="ethena-ask-root"
      style={{ flex: 1, justifyContent: 'flex-end' }}
    >
      {/* The book stays behind, dimmed. A tap on it closes the sheet. */}
      <Pressable
        testID="ethena-ask-scrim"
        accessibilityRole="button"
        accessibilityLabel={view.closeLabel}
        onPress={onClose}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: ethena.void,
          opacity: 0.55,
        }}
      />
      <View style={{ maxHeight: '100%', paddingBottom: keyboardInset }}>
        <CorsoGlass
          testID="ethena-ask-sheet"
          material={sheet.material}
          tint={sheet.tint ?? undefined}
          radius={ethenaGeometry.radiusSheet}
          style={{
            marginHorizontal: 8,
            marginBottom: bottomInset > 0 ? bottomInset : 8,
            overflow: 'hidden',
            maxHeight: '100%',
          }}
        >
          <View
            testID="ethena-ask-grab"
            accessibilityRole="button"
            accessibilityLabel={view.closeLabel}
            {...drag.panHandlers}
            style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 14 }}
          >
            <View
              style={{
                width: 36,
                height: 5,
                borderRadius: 3,
                backgroundColor: ethena.ink.tertiary,
              }}
            />
          </View>

          <View style={{ flexShrink: 1 }}>
            <ScrollView
              testID="ethena-ask-scroll"
              contentContainerStyle={{
                paddingHorizontal: ethenaGeometry.gutter + 4,
                // Resting content clears the bottom fade.
                paddingBottom: SCROLL_FADE_BOTTOM,
              }}
              keyboardShouldPersistTaps="handled"
            >
              <CorsoText
                testID="ethena-ask-title"
                accessibilityRole="header"
                style={{
                  ...ETHENA_TYPE.cardHeading,
                  color: ethena.ink.primary,
                  marginBottom: 16,
                }}
              >
                {view.title}
              </CorsoText>

              {view.state === 'thinking' ? <ThinkingCard /> : null}
              {view.card ? (
                <AnswerCard
                  card={view.card}
                  onChip={onChip}
                  onDoor={onDoor}
                  onOpen={onOpen}
                />
              ) : null}

              {view.lookedAt ? (
                <CorsoText
                  testID="ethena-ask-looked-at"
                  style={{
                    ...ETHENA_TYPE.rowSub,
                    color: ethena.ink.tertiary,
                    marginTop: 14,
                  }}
                >
                  {view.lookedAt}
                </CorsoText>
              ) : null}

              {view.card?.kind === 'trade' ? (
                <TradeActions
                  card={view.card}
                  onOpenReview={onOpenReview}
                  onWait={onWait}
                />
              ) : null}

              {view.suggestions.length > 0 ? (
                <View
                  testID="ethena-ask-suggestions"
                  style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
                >
                  {view.suggestions.map((chip) => (
                    <ChipView
                      key={chip.key}
                      testID={`ethena-ask-suggestion-${chip.key}`}
                      chip={chip}
                      onPress={() => onChip?.(chip.key)}
                    />
                  ))}
                </View>
              ) : null}
            </ScrollView>
            <ScrollEdgeFade
              top={0}
              bottom={SCROLL_FADE_BOTTOM}
              color={resolveFloatGlassSurface(sheet.tint ?? undefined)}
              testID="ethena-ask-fade"
            />
          </View>

          <View
            style={{
              paddingHorizontal: ethenaGeometry.gutter,
              paddingBottom: 12,
              paddingTop: 4,
            }}
          >
            <View
              testID="ethena-ask-composer"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                minHeight: ethenaGeometry.pillHeight,
                borderRadius: ethenaGeometry.pillHeight / 2,
                paddingLeft: 18,
                paddingRight: 6,
                borderWidth: field.borderWidth,
                borderColor: field.borderColor ?? undefined,
                backgroundColor: field.fill as string,
              }}
            >
              <TextInput
                testID="ethena-ask-input"
                ref={inputRef}
                value={draft}
                onChangeText={onChangeDraft}
                onSubmitEditing={canSend ? onSend : undefined}
                // Multiline so the placeholder and a long question wrap at font
                // 2.0; Return still sends, it never inserts a newline.
                multiline
                submitBehavior="submit"
                editable={view.composer.enabled}
                placeholder={view.composer.placeholder}
                placeholderTextColor={ethena.ink.tertiary}
                returnKeyType="send"
                accessibilityLabel={view.composer.placeholder}
                style={{
                  ...ETHENA_TYPE.body,
                  flex: 1,
                  color: ethena.ink.primary,
                  paddingVertical: 12,
                }}
              />
              <Pressable
                testID="ethena-ask-send"
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSend }}
                disabled={!canSend}
                onPress={onSend}
                hitSlop={8}
                style={{ paddingHorizontal: 12, paddingVertical: 12 }}
              >
                <CorsoText
                  style={{
                    ...ETHENA_TYPE.body,
                    color: canSend ? ethena.ink.primary : ethena.ink.tertiary,
                  }}
                >
                  {view.composer.sendLabel}
                </CorsoText>
              </Pressable>
            </View>
          </View>
        </CorsoGlass>
      </View>
    </View>
  );
}

function ThinkingCard() {
  return (
    <EthenaTray
      testID="ethena-ask-card-thinking"
      style={{ paddingVertical: 16 }}
    >
      {[0, 1, 2].map((at) => (
        <View
          key={at}
          style={{
            height: 12,
            width: at === 2 ? '45%' : '75%',
            borderRadius: 6,
            marginVertical: 6,
            backgroundColor: ethena.hair,
          }}
        />
      ))}
    </EthenaTray>
  );
}

function AnswerCard({
  card,
  onChip,
  onDoor,
  onOpen,
}: {
  card: AskSheetCard;
  onChip?: (key: string) => void;
  onDoor?: (key: string) => void;
  onOpen?: () => void;
}) {
  switch (card.kind) {
    case 'table':
      return (
        <EthenaTray testID="ethena-ask-card" style={{ paddingVertical: 6 }}>
          {card.rows.map((row) => (
            <RowView key={row.key} row={row} />
          ))}
          {card.total ? <RowView row={card.total} total /> : null}
        </EthenaTray>
      );
    case 'fact':
    case 'facts':
    case 'trade':
      return (
        <EthenaTray testID="ethena-ask-card" style={{ paddingVertical: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 6,
            }}
          >
            <CorsoText
              testID="ethena-ask-card-title"
              style={{
                ...ETHENA_TYPE.cardHeading,
                color: ethena.ink.primary,
                flexShrink: 1,
              }}
            >
              {card.title}
            </CorsoText>
            {card.kind !== 'trade' && card.openLabel ? (
              <Pressable
                testID="ethena-ask-open"
                accessibilityRole="button"
                onPress={onOpen}
                hitSlop={8}
              >
                <CorsoText
                  style={{
                    ...ETHENA_TYPE.cardAction,
                    color: ethena.ink.secondary,
                  }}
                >
                  {card.openLabel}
                </CorsoText>
              </Pressable>
            ) : null}
          </View>
          {card.rows.map((row) => (
            <RowView key={row.key} row={row} />
          ))}
          {card.kind === 'trade' ? (
            <CorsoText
              testID="ethena-ask-trade-note"
              style={{
                ...ETHENA_TYPE.body,
                color: ethena.ink.secondary,
                marginTop: ETHENA_BODY_MARGIN,
              }}
            >
              {card.note}
            </CorsoText>
          ) : null}
        </EthenaTray>
      );
    case 'clarify':
      return (
        <View testID="ethena-ask-card">
          <CorsoText
            testID="ethena-ask-line"
            style={{
              ...ETHENA_TYPE.body,
              color: ethena.ink.primary,
              marginBottom: 12,
            }}
          >
            {card.line}
          </CorsoText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {card.chips.map((chip) => (
              <ChipView
                key={chip.key}
                testID={`ethena-ask-chip-${chip.key}`}
                chip={chip}
                onPress={() => onChip?.(chip.key)}
              />
            ))}
          </View>
        </View>
      );
    case 'line':
      return (
        <View testID="ethena-ask-card">
          <CorsoText
            testID="ethena-ask-line"
            style={{ ...ETHENA_TYPE.body, color: ethena.ink.primary }}
          >
            {card.line}
          </CorsoText>
          {card.doors.length > 0 ? (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
                marginTop: 12,
              }}
            >
              {card.doors.map((door) => (
                <ChipView
                  key={door.key}
                  testID={`ethena-ask-door-${door.key}`}
                  chip={door}
                  onPress={() => onDoor?.(door.key)}
                />
              ))}
            </View>
          ) : null}
        </View>
      );
  }
}

/** Label · value, values right-aligned. Wraps at large font scales. */
function RowView({ row, total = false }: { row: AskCardRow; total?: boolean }) {
  const step = total ? ETHENA_TYPE.keyValueTotal : ETHENA_TYPE.keyValue;
  return (
    <View
      testID={`ethena-ask-row-${row.key}`}
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        columnGap: 12,
        paddingVertical: 10,
      }}
    >
      <CorsoText
        style={{
          ...step,
          color: total ? ethena.ink.primary : ethena.ink.secondary,
          flexShrink: 1,
        }}
      >
        {row.label}
      </CorsoText>
      <CorsoText
        style={{
          ...step,
          color: ethena.ink.primary,
          fontVariant: ['tabular-nums'],
          textAlign: 'right',
          marginLeft: 'auto',
        }}
      >
        {row.value}
      </CorsoText>
    </View>
  );
}

function ChipView({
  testID,
  chip,
  onPress,
}: {
  testID: string;
  chip: AskChip;
  onPress?: () => void;
}) {
  const material = resolveEthenaMaterial('ground');
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: ethenaGeometry.segHeight / 2,
        borderWidth: material.borderWidth,
        borderColor: material.borderColor ?? undefined,
        backgroundColor: material.fill as string,
        maxWidth: '100%',
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        columnGap: 6,
      }}
    >
      <CorsoText
        style={{
          ...ETHENA_TYPE.body,
          color: ethena.ink.primary,
          flexShrink: 1,
        }}
      >
        {chip.label}
      </CorsoText>
      {chip.marker ? (
        <CorsoText
          style={{ ...ETHENA_TYPE.rowSub, color: ethena.ink.tertiary }}
        >
          {chip.marker}
        </CorsoText>
      ) : null}
    </Pressable>
  );
}

/** Open Review and Wait: two equal glass peers (see the header). */
function TradeActions({
  card,
  onOpenReview,
  onWait,
}: {
  card: Extract<AskSheetCard, { kind: 'trade' }>;
  onOpenReview?: () => void;
  onWait?: () => void;
}) {
  return (
    <View style={{ marginTop: 16, marginBottom: 4 }}>
      {card.disabledLine ? (
        <CorsoText
          testID="ethena-ask-swaps-off"
          style={{
            ...ETHENA_TYPE.rowSub,
            color: ethena.ink.secondary,
            marginBottom: 10,
          }}
        >
          {card.disabledLine}
        </CorsoText>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <EthenaPill
          testID="ethena-ask-wait"
          label={card.waitLabel}
          plane="floatAction"
          onPress={onWait}
        />
        <EthenaPill
          testID="ethena-ask-open-review"
          label={card.openReviewLabel}
          plane="floatAction"
          onPress={onOpenReview}
          disabled={!card.openReviewEnabled}
        />
      </View>
    </View>
  );
}

import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextInputContentSizeChangeEventData,
  type ViewStyle,
} from 'react-native';
import { copy } from '@/constants/copy';
import { noteComposerBusy } from '@/src/features/aiConnect/ui/threadAttributionPresentation';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference.js';
import { Material } from '@/src/ui/glass/Material';
import { useInkContrastEnabled } from '@/src/ui/glass/useInkContrast';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon';
import { CorsoText } from '@/src/theme/CorsoText';
import {
  MODEL_MENU_AUTO_ONLY,
  type ModelMenuPresentation,
  type ModelMenuRow,
} from '@/src/features/aiConnect/ui/modelMenuPresentation';
import { colors, kitType, radii, spacing, typography } from '@/src/ui/tokens';
import {
  COMPOSER_CARD_WEIGHT,
  COMPOSER_CONTROL_FILL,
  COMPOSER_CONTROL_QUIET_INK,
  resolveComposerControlPaint,
} from './composerDeskPaint';
import { DockScrim } from './DockScrim';
import { QuickActionRow } from './QuickActionRow';
import {
  COMPOSER_ACTION_ROW_GAP,
  COMPOSER_ACTION_ROW_HEIGHT,
  COMPOSER_ATTACH_MENU_RADIUS,
  COMPOSER_CONNECT_MONOGRAM_GAP,
  COMPOSER_CONNECT_MONOGRAM_SIZE,
  COMPOSER_INPUT_FONT_SIZE,
  COMPOSER_INPUT_LINE_HEIGHT,
  COMPOSER_INPUT_PADDING_HORIZONTAL,
  COMPOSER_INPUT_PADDING_VERTICAL,
  COMPOSER_INPUT_REST_HEIGHT,
  COMPOSER_MODEL_MENU_RADIUS,
  COMPOSER_MODEL_MENU_WIDTH,
  COMPOSER_PADDING_BOTTOM,
  COMPOSER_PADDING_HORIZONTAL,
  COMPOSER_PADDING_TOP,
  COMPOSER_PRIMARY_SIZE,
  COMPOSER_RADIUS,
  COMPOSER_SPEAK_HEIGHT,
  COMPOSER_WELL_SIZE,
  isComposerSwipeDown,
  resolveComposerField,
  resolveComposerInputHeight,
  resolveComposerPrimary,
} from './composerPresentation';
import {
  COMPOSER_GRABBER_DASH_HEIGHT,
  COMPOSER_GRABBER_HIT_SLOP,
  COMPOSER_GRABBER_ROW_HEIGHT,
  COMPOSER_GRABBER_WIDTH,
} from './quickActionsPresentation';

export type ComposerAttachKind = 'paste-address';

export type ComposerProps = {
  value: string;
  onChangeText: (text: string) => void;
  /** Text present + primary pressed, or the keyboard's return. */
  onSend: () => void;
  /** No text + primary pressed: the voice pipeline (rest = Speak). */
  onSpeak: () => void;
  /** Mic: OS dictation — the caller focuses the field. */
  onDictate: () => void;
  /** A downward drag on the card, or a tap on the grabber: re-summon the tab bar. */
  onSwipeDown?: () => void;
  tabBarHidden?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  /** Attach menu rows. Only `paste-address` is live in SPINE; the rest say so. */
  onAttach?: (kind: ComposerAttachKind) => void;
  /** The picker's Connect door → "Connect your AI" (the BYO-AI screen). */
  onConnectModel?: () => void;
  /**
   * A row in the picker was chosen: `MODEL_AUTO_ID` for Auto, or a `brainId`
   * for a connected model. The root owns what that means — the composer only
   * reports the tap and closes the pane.
   */
  onSelectModel?: (id: string) => void;
  modelMenu?: ModelMenuPresentation;
  /**
   * The Skills chip in the quick-action row → the Skills marketplace
   * (`app/skills/index.tsx`). Absent → the row ships its four verbs without
   * the Skills door; the composer does not navigate on its own.
   */
  onSkills?: () => void;
  quickActionsVisible?: boolean;
  rulesEnabled?: boolean;
  busy: boolean;
  /** FLAG_ASK from public config, fail-closed. Off = honest empty state. */
  askEnabled: boolean;
  /** Voice is transcribing into the field: the field is not editable. */
  voiceEditable?: boolean;
  listening?: boolean;
  menuOpen?: 'model';
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

type MenuKind = 'attach' | 'model' | null;

const SPEAK_BARS = [
  { id: 'a', height: 9 },
  { id: 'b', height: 14 },
  { id: 'c', height: 11 },
  { id: 'd', height: 14 },
  { id: 'e', height: 9 },
] as const;

export const Composer = forwardRef<TextInput, ComposerProps>(function Composer(
  {
    value,
    onChangeText,
    onSend,
    onSpeak,
    onDictate,
    onSwipeDown,
    tabBarHidden = false,
    onFocus,
    onBlur,
    onAttach,
    onConnectModel,
    onSelectModel,
    modelMenu = MODEL_MENU_AUTO_ONLY,
    onSkills,
    quickActionsVisible = true,
    rulesEnabled = false,
    busy,
    askEnabled,
    voiceEditable = true,
    listening = false,
    menuOpen,
    style,
    testID,
  },
  ref,
) {
  const { reduceMotion } = useAccessibilityPreference();
  // Paint only: a control on the float takes the 3:1 rim under Increase Contrast.
  const control = resolveComposerControlPaint({
    increaseContrast: useInkContrastEnabled(),
  });
  const controlPaint = {
    borderWidth: control.rimWidth,
    borderColor: control.rimColor ?? undefined,
  };
  const [inputHeight, setInputHeight] = useState(resolveComposerInputHeight(0));
  const clockHeld = useRef(false);
  useEffect(() => {
    if (!busy && !clockHeld.current) return;
    clockHeld.current = busy;
    noteComposerBusy(busy);
  }, [busy]);
  const [pickedMenu, setMenu] = useState<MenuKind>(null);
  const menu: MenuKind = menuOpen ?? pickedMenu;
  const primary = resolveComposerPrimary({
    text: value,
    busy,
    askEnabled,
    labels: {
      speak: copy.ask.speak,
      send: copy.ask.sendA11y,
      disabled: copy.ask.disabledA11y,
    },
  });
  const field = resolveComposerField({
    askEnabled,
    busy,
    voiceEditable,
    copy: {
      placeholder: copy.ask.placeholder,
      disabledPlaceholder: copy.ask.disabledPlaceholder,
      disabledNotice: copy.ask.disabledNotice,
    },
  });
  const swipe = useRef(onSwipeDown);
  swipe.current = onSwipeDown;
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          swipe.current != null &&
          isComposerSwipeDown({ dx: gesture.dx, dy: gesture.dy }),
        onPanResponderRelease: (_event, gesture) => {
          if (isComposerSwipeDown({ dx: gesture.dx, dy: gesture.dy }))
            swipe.current?.();
        },
      }),
    [],
  );
  const bars = useRef(new Animated.Value(1)).current;

  function onContentSizeChange(
    event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>,
  ) {
    const next = resolveComposerInputHeight(
      event.nativeEvent.contentSize.height,
    );
    setInputHeight((current) => (current === next ? current : next));
  }

  function onPrimary() {
    if (primary.disabled) return;
    if (primary.mode === 'send') {
      onSend();
      return;
    }
    onSpeak();
  }

  function toggleMenu(kind: Exclude<MenuKind, null>) {
    setMenu((current) => (current === kind ? null : kind));
  }

  function attach(kind: ComposerAttachKind) {
    setMenu(null);
    onAttach?.(kind);
  }

  return (
    <View style={[styles.dock, style]} testID={testID} pointerEvents="box-none">
      <DockScrim testID={testID ? `${testID}-scrim` : undefined} />

      {field.disabledNotice ? (
        <CorsoText style={styles.notice} accessibilityLiveRegion="polite">
          {field.disabledNotice}
        </CorsoText>
      ) : null}

      {menu ? (
        <Pressable
          onPress={() => setMenu(null)}
          accessibilityLabel="Close"
          accessibilityRole="button"
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      {menu === 'attach' ? (
        <Material
          weight="menu"
          style={styles.attachMenu}
          radius={COMPOSER_ATTACH_MENU_RADIUS}
          contentStyle={styles.menuContent}
          hug
        >
          <MenuRow
            label={copy.ask.attachPaste}
            caption={copy.ask.attachPasteCaption}
            onPress={() => attach('paste-address')}
          />
        </Material>
      ) : null}

      {menu === 'model' ? (
        <Material
          weight="menu"
          style={styles.modelMenu}
          radius={COMPOSER_MODEL_MENU_RADIUS}
          contentStyle={styles.modelMenuContent}
          hug
        >
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={copy.ask.modelChipA11y}
          >
            <ModelRow
              row={modelMenu.auto}
              onPress={() => {
                setMenu(null);
                onSelectModel?.(modelMenu.auto.id);
              }}
            />
            {modelMenu.groups.map((group) => (
              <View key={group.label}>
                <CorsoText style={styles.menuGroup}>{group.label}</CorsoText>
                {group.rows.map((row) => (
                  <ModelRow
                    key={row.id}
                    row={row}
                    onPress={() => {
                      setMenu(null);
                      onSelectModel?.(row.id);
                    }}
                  />
                ))}
              </View>
            ))}
          </View>
          {modelMenu.connect ? (
            <View style={styles.menuFoot}>
              <Pressable
                onPress={() => {
                  setMenu(null);
                  onConnectModel?.();
                }}
                accessibilityRole="menuitem"
                accessibilityLabel={
                  modelMenu.connect.caption
                    ? `${modelMenu.connect.label}. ${modelMenu.connect.caption}`
                    : modelMenu.connect.label
                }
                style={styles.connectRow}
              >
                <View style={styles.menuText}>
                  <CorsoText style={styles.modelName}>
                    {modelMenu.connect.label}
                  </CorsoText>
                  {modelMenu.connect.caption ? (
                    <CorsoText style={styles.menuCaption}>
                      {modelMenu.connect.caption}
                    </CorsoText>
                  ) : null}
                </View>
                <View style={styles.connectMarks} accessible={false}>
                  {modelMenu.connect.badges.map((badge) => (
                    <View key={badge} style={styles.connectMono}>
                      <CorsoText style={styles.connectMonoText}>
                        {badge}
                      </CorsoText>
                    </View>
                  ))}
                </View>
                <CorsoIcon
                  name="chevron-right"
                  size={12}
                  color={colors.inkQuaternary}
                />
              </Pressable>
            </View>
          ) : null}
        </Material>
      ) : null}

      {tabBarHidden && onSwipeDown ? (
        <Pressable
          onPress={onSwipeDown}
          accessibilityRole="button"
          accessibilityLabel={copy.ask.showTabsA11y}
          style={styles.grabberTarget}
          hitSlop={COMPOSER_GRABBER_HIT_SLOP}
          testID={testID ? `${testID}-grabber` : 'composer-grabber'}
        >
          <View style={styles.grabber} />
        </Pressable>
      ) : null}

      {quickActionsVisible ? (
        <QuickActionRow
          copy={copy.ask.quickActions}
          disabled={!askEnabled || busy}
          onFill={(text) => {
            onChangeText(text);
            onFocus?.();
          }}
          onSkills={onSkills}
          rulesEnabled={rulesEnabled}
          testID={testID ? `${testID}-quick-actions` : undefined}
        />
      ) : null}

      <View {...pan.panHandlers}>
        <Material
          weight={COMPOSER_CARD_WEIGHT}
          radius={COMPOSER_RADIUS}
          contentStyle={styles.card}
          hug
          testID={testID ? `${testID}-card` : undefined}
        >
          <TextInput
            ref={ref}
            value={value}
            onChangeText={onChangeText}
            onFocus={() => onFocus?.()}
            onBlur={() => onBlur?.()}
            onContentSizeChange={onContentSizeChange}
            placeholder={field.placeholder}
            placeholderTextColor={field.placeholderColor}
            editable={field.editable}
            multiline
            scrollEnabled
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={() => {
              if (!primary.disabled && primary.mode === 'send') onSend();
            }}
            accessibilityLabel={field.placeholder}
            style={[styles.input, { height: inputHeight }]}
            testID={testID ? `${testID}-input` : undefined}
          />
          <View style={styles.row}>
            <Pressable
              onPress={() => toggleMenu('attach')}
              disabled={!askEnabled}
              accessibilityRole="button"
              accessibilityLabel={copy.ask.attachA11y}
              accessibilityState={{
                expanded: menu === 'attach',
                disabled: !askEnabled,
              }}
              style={[styles.well, controlPaint]}
              hitSlop={6}
            >
              <CorsoIcon name="plus" size={16} color={colors.ink} />
            </Pressable>
            <Pressable
              onPress={() => toggleMenu('model')}
              disabled={!askEnabled}
              accessibilityRole="button"
              accessibilityLabel={copy.ask.modelChipA11y}
              accessibilityState={{
                expanded: menu === 'model',
                disabled: !askEnabled,
              }}
              style={[
                styles.chip,
                controlPaint,
                // The rim is drawn inside the pill, so the pill does not widen.
                { paddingHorizontal: CHIP_PADDING_HORIZONTAL - control.rimWidth },
              ]}
              hitSlop={6}
            >
              <CorsoText style={styles.chipLabel}>
                {modelMenu.chipLabel}
              </CorsoText>
              <CorsoIcon
                name="chevron-down"
                size={11}
                color={menu === 'model' ? colors.ink : colors.inkSecondary}
              />
            </Pressable>
            <View style={styles.spacer} />
            <Pressable
              onPress={onDictate}
              disabled={!askEnabled || busy}
              accessibilityRole="button"
              accessibilityLabel={copy.ask.dictateA11y}
              accessibilityState={{ disabled: !askEnabled || busy }}
              style={[styles.well, controlPaint]}
              hitSlop={4}
            >
              <CorsoIcon name="mic" size={17} color={colors.ink} />
            </Pressable>
            <Pressable
              onPress={onPrimary}
              disabled={primary.disabled}
              accessibilityRole="button"
              accessibilityLabel={primary.accessibilityLabel}
              accessibilityState={{ disabled: primary.disabled }}
              style={({ pressed }) => [
                primary.mode === 'speak' ? styles.speak : styles.primary,
                { backgroundColor: primary.fill },
                pressed && !reduceMotion ? styles.primaryPressed : null,
              ]}
              hitSlop={4}
              testID={testID ? `${testID}-primary` : undefined}
            >
              {primary.mode === 'busy' ? (
                <ActivityIndicator color={primary.glyphColor} />
              ) : primary.mode === 'speak' ? (
                <>
                  <SpeakBars
                    color={primary.glyphColor}
                    listening={listening}
                    scale={bars}
                  />
                  <CorsoText
                    style={[styles.speakLabel, { color: primary.glyphColor }]}
                  >
                    {copy.ask.speak}
                  </CorsoText>
                </>
              ) : (
                <CorsoText
                  style={[styles.sendGlyph, { color: primary.glyphColor }]}
                >
                  ↑
                </CorsoText>
              )}
            </Pressable>
          </View>
        </Material>
      </View>
    </View>
  );
});

function SpeakBars({
  color,
  listening,
  scale,
}: {
  color: string;
  listening: boolean;
  scale: Animated.Value;
}) {
  return (
    <View style={styles.bars} accessible={false}>
      {SPEAK_BARS.map((bar) => (
        <Animated.View
          key={bar.id}
          style={[
            styles.bar,
            { height: bar.height, backgroundColor: color },
            listening ? { transform: [{ scaleY: scale }] } : null,
          ]}
        />
      ))}
    </View>
  );
}

function ModelRow({
  row,
  onPress,
}: {
  row: ModelMenuRow;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: row.checked }}
      accessibilityLabel={row.accessibilityLabel}
      style={styles.modelRow}
    >
      <View style={styles.modelBadge}>
        {row.badge ? (
          <CorsoText style={styles.modelBadgeText}>{row.badge}</CorsoText>
        ) : (
          <CorsoIcon name="sparkle" size={15} color={colors.inkSecondary} />
        )}
      </View>
      <View style={styles.menuText}>
        <CorsoText style={styles.modelName}>{row.name}</CorsoText>
        <CorsoText style={styles.menuCaption}>{row.caption}</CorsoText>
      </View>
      {row.checked ? (
        <View style={styles.check}>
          <CorsoIcon name="check" size={11} color={colors.canvas} />
        </View>
      ) : null}
    </Pressable>
  );
}

function MenuRow({
  label,
  caption,
  onPress,
  checked = false,
}: {
  label: string;
  caption?: string;
  onPress: () => void;
  checked?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="menuitem"
      accessibilityLabel={caption ? `${label}, ${caption}` : label}
      accessibilityState={checked ? { checked: true } : undefined}
      style={styles.menuRow}
    >
      <View style={styles.menuText}>
        <CorsoText style={styles.menuLabel}>{label}</CorsoText>
        {caption ? (
          <CorsoText style={styles.menuCaption}>{caption}</CorsoText>
        ) : null}
      </View>
      {checked ? (
        <View style={styles.check}>
          <CorsoIcon name="check" size={11} color={colors.canvas} />
        </View>
      ) : null}
    </Pressable>
  );
}

const CHIP_PADDING_HORIZONTAL = 11;

const styles = StyleSheet.create({
  dock: {
    position: 'relative',
  },
  grabberTarget: {
    alignSelf: 'center',
    height: COMPOSER_GRABBER_ROW_HEIGHT,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grabber: {
    width: COMPOSER_GRABBER_WIDTH,
    height: COMPOSER_GRABBER_DASH_HEIGHT,
    borderRadius: COMPOSER_GRABBER_DASH_HEIGHT / 2,
    backgroundColor: colors.grabber,
  },
  notice: {
    textAlign: 'center',
    color: colors.inkTertiary,
    fontSize: typography.caption,
    fontFamily: typography.face('400'),
    paddingBottom: spacing.sm,
  },
  card: {
    paddingTop: COMPOSER_PADDING_TOP,
    paddingBottom: COMPOSER_PADDING_BOTTOM,
    paddingHorizontal: COMPOSER_PADDING_HORIZONTAL,
  },
  input: {
    color: colors.ink,
    fontSize: COMPOSER_INPUT_FONT_SIZE,
    lineHeight: COMPOSER_INPUT_LINE_HEIGHT,
    fontFamily: typography.face('400'),
    paddingHorizontal: COMPOSER_INPUT_PADDING_HORIZONTAL,
    paddingTop: COMPOSER_INPUT_PADDING_VERTICAL,
    paddingBottom: COMPOSER_INPUT_PADDING_VERTICAL,
    minHeight: COMPOSER_INPUT_REST_HEIGHT,
    includeFontPadding: false,
    textAlignVertical: 'top',
  },
  row: {
    height: COMPOSER_ACTION_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: COMPOSER_ACTION_ROW_GAP,
    paddingHorizontal: 2,
  },
  well: {
    width: COMPOSER_WELL_SIZE,
    height: COMPOSER_WELL_SIZE,
    borderRadius: radii.pill,
    backgroundColor: COMPOSER_CONTROL_FILL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** The model chip: a 34pt pill on the float, its label 15/500 white. */
  chip: {
    height: COMPOSER_WELL_SIZE,
    paddingHorizontal: CHIP_PADDING_HORIZONTAL,
    borderRadius: radii.pill,
    backgroundColor: COMPOSER_CONTROL_FILL,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  chipLabel: {
    color: colors.ink,
    fontSize: kitType.sub,
    fontFamily: typography.face('500'),
    fontWeight: '500',
  },
  spacer: { flex: 1 },
  /** Every mode but `speak`: the 34pt circle. */
  primary: {
    width: COMPOSER_PRIMARY_SIZE,
    height: COMPOSER_PRIMARY_SIZE,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Rest: the 34pt white Speak pill, the bars glyph plus `Speak` (FC). */
  speak: {
    height: COMPOSER_SPEAK_HEIGHT,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  speakLabel: {
    fontSize: kitType.sub,
    fontFamily: typography.face('600'),
    fontWeight: '600',
  },
  primaryPressed: { transform: [{ scale: 0.94 }] },
  sendGlyph: {
    fontSize: typography.body,
    fontFamily: typography.face('600'),
    fontWeight: '600',
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 14,
  },
  bar: { width: 2, borderRadius: 2 },
  attachMenu: {
    position: 'absolute',
    left: 0,
    bottom: COMPOSER_ACTION_ROW_HEIGHT + COMPOSER_PADDING_BOTTOM + 12,
    minWidth: 238,
    zIndex: 2,
  },
  modelMenu: {
    position: 'absolute',
    left: 0,
    bottom: COMPOSER_ACTION_ROW_HEIGHT + COMPOSER_PADDING_BOTTOM + 12,
    width: COMPOSER_MODEL_MENU_WIDTH,
    zIndex: 2,
  },
  menuContent: { padding: 6 },
  modelMenuContent: { paddingTop: 6, paddingHorizontal: 6, paddingBottom: 3 },
  modelRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 8,
    borderRadius: 14,
  },
  modelBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: COMPOSER_CONTROL_FILL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelBadgeText: {
    color: COMPOSER_CONTROL_QUIET_INK,
    fontSize: 10.5,
    fontFamily: typography.face('600'),
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  modelName: {
    color: colors.ink,
    fontSize: 13.5,
    fontFamily: typography.face('600'),
    fontWeight: '600',
    letterSpacing: -0.135,
  },
  menuGroup: {
    color: colors.inkTertiary,
    fontSize: kitType.sub,
    fontFamily: typography.face('500'),
    fontWeight: '500',
    paddingTop: 9,
    paddingBottom: 3,
    paddingHorizontal: 10,
  },
  menuFoot: {
    marginTop: 3,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: 3,
  },
  connectRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 8,
    borderRadius: 14,
  },
  connectMarks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: COMPOSER_CONNECT_MONOGRAM_GAP,
  },
  connectMono: {
    width: COMPOSER_CONNECT_MONOGRAM_SIZE,
    height: COMPOSER_CONNECT_MONOGRAM_SIZE,
    borderRadius: 10,
    backgroundColor: COMPOSER_CONTROL_FILL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectMonoText: {
    color: COMPOSER_CONTROL_QUIET_INK,
    fontSize: 8.5,
    fontFamily: typography.face('600'),
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  menuRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  menuText: { flex: 1, gap: 2 },
  menuLabel: {
    color: colors.ink,
    fontSize: 13.5,
    fontFamily: typography.face('600'),
    fontWeight: '600',
  },
  menuCaption: {
    color: colors.inkTertiary,
    fontSize: 11.5,
    fontFamily: typography.face('500'),
    fontWeight: '500',
  },
  check: {
    width: 18,
    height: 18,
    borderRadius: radii.pill,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

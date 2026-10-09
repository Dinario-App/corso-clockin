import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import { AccountSectionHeading } from '@/src/features/account/ui/AccountSectionHeading';
import { parseByoAiFlags } from '@/src/features/aiConnect/flags';
import {
  resolveHowItWorksPagePresentation,
  type HowItWorksPageFlags,
  type HowItWorksQuestion,
} from '@/src/features/howItWorks/howItWorksPagePresentation';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import { resolveBotsEnabled, resolveByoAiFlags } from '@/src/lib/apiConfig';
import { CorsoText } from '@/src/theme/CorsoText';
import { SettingsCard } from '@/src/ui/cards/SettingsCard';
import { ScreenHeader } from '@/src/ui/navigation/ScreenHeader';
import { BottomSheet } from '@/src/ui/primitives/BottomSheet';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { useScrollLinkedFadeTop } from '@/src/ui/primitives/useScrollLinkedFadeTop';
import { SettingsRow } from '@/src/ui/rows/SettingsRow';
import {
  ACCOUNT_CARD_PADDING_HORIZONTAL,
  ACCOUNT_CARD_PADDING_VERTICAL,
  ACCOUNT_ROW_PADDING_HORIZONTAL,
} from '@/src/ui/rows/accountRowPresentation';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { EthenaGround } from '@/src/ui/ethena/EthenaPrimitives';

const FLAGS_OFF: HowItWorksPageFlags = {
  botsEnabled: false,
  byoAiEnabled: false,
  chatgptEnabled: false,
  grokEnabled: false,
};

export function HowItWorksPageScreen() {
  const scrollFade = useScrollLinkedFadeTop();
  const [flags, setFlags] = useState<HowItWorksPageFlags | null>(null);
  const [openQuestion, setOpenQuestion] = useState<HowItWorksQuestion | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      resolveBotsEnabled().catch(() => false),
      resolveByoAiFlags().catch(() => parseByoAiFlags(undefined)),
    ]).then(([botsEnabled, byo]) => {
      if (cancelled) return;
      setFlags({
        botsEnabled,
        byoAiEnabled: byo.byoAiEnabled,
        chatgptEnabled: byo.chatgptEnabled,
        grokEnabled: byo.grokEnabled,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const page = resolveHowItWorksPagePresentation(flags ?? FLAGS_OFF);
  const sheetOpen = openQuestion !== null && openQuestion.answer !== null;

  return (
    <EthenaGround>
      <SafeAreaView
        style={styles.safe}
        edges={['top', 'bottom']}
        testID="how-it-works-page"
      >
        <ScreenHeader
          family="desk"
          title={page.title}
          onBack={() => goBackOr(BACK_FALLBACK.settingsHub)}
          backAccessibilityLabel={copy.v1.back}
          testID="how-it-works-header"
        />
        <View style={styles.scrollWrap}>
          <ScrollView
            {...scrollFade.scroller}
            style={styles.scroll}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            testID="how-it-works-scroll"
          >
            {page.replay ? (
              <SettingsCard
                contentStyle={styles.cardContent}
                testID="how-it-works-replay-card"
              >
                <SettingsRow
                  glyph="play"
                  label={page.replay.label}
                  accessory="chevron"
                  last
                  onPress={() => {
                    if (page.replay) router.push(page.replay.href as never);
                  }}
                  testID="how-it-works-replay"
                />
              </SettingsCard>
            ) : null}

            <AccountSectionHeading
              label={page.basicsHeading}
              first={page.replay == null}
            />
            <SettingsCard
              contentStyle={styles.cardContent}
              testID="how-it-works-basics-card"
            >
              {page.basics.map((basic, index) => {
                const last = index === page.basics.length - 1;
                return (
                  <View
                    key={basic.id}
                    style={styles.basic}
                    testID={`how-it-works-basic-${basic.id}`}
                  >
                    <CorsoText
                      style={styles.basicHead}
                      accessibilityRole="header"
                    >
                      {basic.head}
                    </CorsoText>
                    <CorsoText style={styles.basicBody}>{basic.body}</CorsoText>
                    {last ? null : <View style={styles.basicDivider} />}
                  </View>
                );
              })}
            </SettingsCard>

            {page.questions.length > 0 ? (
              <>
                <AccountSectionHeading label={page.questionsHeading} />
                <SettingsCard
                  contentStyle={styles.cardContent}
                  testID="how-it-works-questions-card"
                >
                  {page.questions.map((question, index) => {
                    const last = index === page.questions.length - 1;
                    return (
                      <SettingsRow
                        key={question.id}
                        label={question.question}
                        accessory="chevron"
                        last={last}
                        onPress={() => {
                          if (question.answer !== null) {
                            setOpenQuestion(question);
                          }
                        }}
                        testID={`how-it-works-question-${question.id}`}
                      />
                    );
                  })}
                </SettingsCard>
              </>
            ) : null}
          </ScrollView>
          <ScrollEdgeFade
            top={scrollFade.top}
            color={ethena.groundStops[0][1]}
          />
        </View>

        <BottomSheet
          title={openQuestion?.question ?? page.title}
          visible={sheetOpen}
          dismissible
          signing={false}
          surface="solid"
          closeButton
          onRequestClose={() => {
            setOpenQuestion(null);
          }}
          testID="how-it-works-sheet"
        >
          {openQuestion?.answer ? (
            <CorsoText style={styles.sheetBody}>
              {openQuestion.answer}
            </CorsoText>
          ) : null}
        </BottomSheet>
      </SafeAreaView>
    </EthenaGround>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scrollWrap: { flex: 1, position: 'relative' },
  scroll: { flex: 1 },
  body: {
    paddingHorizontal: ethenaGeometry.gutter,
    paddingTop: 16,
    paddingBottom: 64,
  },
  cardContent: {
    paddingHorizontal: ACCOUNT_CARD_PADDING_HORIZONTAL,
    paddingVertical: ACCOUNT_CARD_PADDING_VERTICAL,
  },
  basic: {
    paddingHorizontal: ACCOUNT_ROW_PADDING_HORIZONTAL,
    paddingTop: 14,
  },
  basicHead: {
    ...ETHENA_TYPE.sub,
    fontWeight: '500',
    color: ethena.ink.tertiary,
  },
  basicBody: {
    ...ETHENA_TYPE.body,
    color: ethena.ink.primary,
    marginTop: 4,
    paddingBottom: 14,
  },
  basicDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: ethena.hair,
    marginLeft: 0,
  },
  sheetBody: {
    ...ETHENA_TYPE.body,
    color: ethena.ink.primary,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
});

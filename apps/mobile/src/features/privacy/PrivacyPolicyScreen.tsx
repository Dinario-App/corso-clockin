import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import {
  privacyPolicyCopy,
  splitPrivacyPolicyInlines,
  type PrivacyPolicyHrefKey,
} from '@/constants/copy/privacyPolicy';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import { LEGAL_URLS } from '@/src/lib/legalUrls';
import { CorsoText } from '@/src/theme/CorsoText';
import { ScreenHeader } from '@/src/ui/navigation/ScreenHeader';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { useScrollLinkedFadeTop } from '@/src/ui/primitives/useScrollLinkedFadeTop';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { EthenaGround } from '@/src/ui/ethena/EthenaPrimitives';

function openPrivacyPolicyLink(hrefKey: PrivacyPolicyHrefKey): void {
  const url = LEGAL_URLS[hrefKey];
  if (hrefKey === 'supportEmail') {
    void Linking.openURL(url);
    return;
  }
  void WebBrowser.openBrowserAsync(url).catch(() => undefined);
}

function PrivacyPolicyInlines({ text }: { text: string }) {
  return splitPrivacyPolicyInlines(text).map((part, index) => {
    if (part.kind === 'text') {
      return (
        <CorsoText key={index} style={styles.body}>
          {part.value}
        </CorsoText>
      );
    }
    return (
      <CorsoText
        key={index}
        style={styles.link}
        accessibilityRole="link"
        accessibilityLabel={part.value}
        onPress={() => {
          openPrivacyPolicyLink(part.hrefKey);
        }}
      >
        {part.value}
      </CorsoText>
    );
  });
}

export function PrivacyPolicyScreen() {
  const scrollFade = useScrollLinkedFadeTop();
  return (
    <EthenaGround>
      <SafeAreaView
        style={styles.safe}
        edges={['top', 'bottom']}
        testID="privacy-policy-screen"
      >
        <ScreenHeader
          family="desk"
          title={copy.profile.aboutPrivacy}
          onBack={() => goBackOr(BACK_FALLBACK.settingsHub)}
          backAccessibilityLabel={copy.v1.back}
          testID="privacy-policy-header"
        />
        <View style={styles.scrollWrap}>
          <ScrollView
            {...scrollFade.scroller}
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            testID="privacy-policy-scroll"
          >
            <CorsoText style={styles.heading} accessibilityRole="header">
              {privacyPolicyCopy.heading}
            </CorsoText>
            <CorsoText style={styles.body}>
              <PrivacyPolicyInlines text={privacyPolicyCopy.intro} />
            </CorsoText>
            {privacyPolicyCopy.sections.map((section) => (
              <View key={section.id} style={styles.section}>
                <CorsoText style={styles.lead} accessibilityRole="header">
                  {section.lead}
                </CorsoText>
                {'paragraphs' in section ? (
                  <CorsoText style={styles.body}>
                    {section.paragraphs.map((paragraph, index) => (
                      <PrivacyPolicyInlines
                        key={paragraph}
                        text={index === 0 ? paragraph : ` ${paragraph}`}
                      />
                    ))}
                  </CorsoText>
                ) : null}
                {'bullets' in section
                  ? section.bullets.map((bullet) => (
                      <CorsoText key={bullet.text} style={styles.bullet}>
                        {'lead' in bullet ? (
                          <CorsoText style={styles.lead}>
                            {bullet.lead}
                          </CorsoText>
                        ) : null}
                        <PrivacyPolicyInlines text={bullet.text} />
                      </CorsoText>
                    ))
                  : null}
              </View>
            ))}
            <CorsoText style={[styles.body, styles.closing]}>
              <PrivacyPolicyInlines text={privacyPolicyCopy.closing} />
            </CorsoText>
          </ScrollView>
          <ScrollEdgeFade
            top={scrollFade.top}
            color={ethena.groundStops[0][1]}
          />
        </View>
      </SafeAreaView>
    </EthenaGround>
  );
}

const styles = StyleSheet.create({
  scrollWrap: { flex: 1, position: 'relative' },
  safe: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: ethenaGeometry.gutter,
    paddingTop: 16,
    paddingBottom: 64,
  },
  heading: {
    ...ETHENA_TYPE.cardHeading,
    color: ethena.ink.primary,
    marginBottom: 16,
  },
  lead: {
    ...ETHENA_TYPE.cardHeading,
    color: ethena.ink.primary,
  },
  body: {
    ...ETHENA_TYPE.body,
    color: ethena.ink.primary,
  },
  link: {
    ...ETHENA_TYPE.body,
    color: ethena.ink.primary,
    textDecorationLine: 'underline',
  },
  section: {
    marginTop: 24,
    gap: 8,
  },
  bullet: {
    ...ETHENA_TYPE.body,
    color: ethena.ink.primary,
    marginTop: 8,
  },
  closing: {
    marginTop: 24,
  },
});

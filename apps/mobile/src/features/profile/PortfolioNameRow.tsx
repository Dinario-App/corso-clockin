import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { copy } from '@/constants/copy';
import {
  PORTFOLIO_NAME_MAX,
  normalizePortfolioName,
} from '@/src/features/onboarding/firstRunOnboarding';
import { resolveBookName } from '@/src/features/home/book/homeBookPresenter';
import {
  clearPortfolioNameOnSignOut,
  readPortfolioName,
  savePortfolioName,
  type PortfolioNameReader,
  type PortfolioNameStorage,
} from '@/src/features/onboarding/portfolioNameStore';
import { ethena } from '@/constants/theme.ethena';
import { CorsoText } from '@/src/theme/CorsoText';
import { ProfileRootRow } from '@/src/features/account/ui/ProfileRootEthena';

type NameStorage = PortfolioNameReader & PortfolioNameStorage;

export function PortfolioNameRow({ storage }: { storage?: NameStorage } = {}) {
  const [stored, setStored] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readPortfolioName(storage).then((name) => {
      if (!cancelled) setStored(name);
    });
    return () => {
      cancelled = true;
    };
  }, [storage]);

  function begin() {
    setDraft(stored ?? '');
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setError(null);
  }

  async function commit() {
    const normalized = normalizePortfolioName(draft);
    try {
      if (!normalized) {
        await clearPortfolioNameOnSignOut(storage);
        setStored(null);
      } else {
        const saved = await savePortfolioName(draft, storage);
        if (!saved) {
          setError(copy.profile.errorSetting);
          return;
        }
        setStored(normalized);
      }
      setEditing(false);
      setError(null);
    } catch {
      setError(copy.profile.errorSetting);
    }
  }

  if (!editing) {
    return (
      <ProfileRootRow
        glyph="compose"
        label={copy.firstRun.nameA11y}
        accessory="chevron"
        value={resolveBookName(stored)}
        onPress={begin}
        last
        testID="profile-name-row"
      />
    );
  }

  return (
    <View style={styles.editor}>
      <TextInput
        testID="profile-name-field"
        value={draft}
        onChangeText={setDraft}
        placeholder={copy.homeBook.defaultName}
        placeholderTextColor={ethena.ink.secondary}
        maxLength={PORTFOLIO_NAME_MAX}
        accessibilityLabel={copy.firstRun.nameA11y}
        autoCorrect={false}
        autoCapitalize="words"
        style={styles.field}
      />
      <Pressable
        testID="profile-name-save"
        accessibilityRole="button"
        accessibilityLabel={copy.account.nameSave}
        onPress={() => {
          void commit();
        }}
        style={styles.action}
      >
        <CorsoText style={styles.actionLabel}>{copy.account.nameSave}</CorsoText>
      </Pressable>
      <Pressable
        testID="profile-name-cancel"
        accessibilityRole="button"
        accessibilityLabel={copy.v1.cancel}
        onPress={cancel}
        style={styles.action}
      >
        <CorsoText style={styles.actionLabel}>{copy.v1.cancel}</CorsoText>
      </Pressable>
      {error ? (
        <CorsoText style={styles.error}>{error}</CorsoText>
      ) : null}
    </View>
  );
}

const EDITOR_BODY = 17;

const styles = StyleSheet.create({
  editor: { paddingVertical: 8, gap: 4 },
  field: {
    color: ethena.ink.primary,
    fontSize: EDITOR_BODY,
    fontWeight: '400',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  action: { paddingVertical: 8, paddingHorizontal: 16 },
  actionLabel: {
    color: ethena.ink.primary,
    fontSize: EDITOR_BODY,
    fontWeight: '600',
  },
  error: {
    color: ethena.mute,
    fontSize: 13,
    paddingHorizontal: 16,
  },
});

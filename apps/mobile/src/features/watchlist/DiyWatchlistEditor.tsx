import { Pressable, TextInput, View } from 'react-native';
import { CorsoText } from '@/src/theme/CorsoText';
import { copy } from '@/constants/copy';
import { ethena } from '@/constants/theme.ethena';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';

export type DiyEditorList = { id: string; name: string; count: number };
export type DiyEditorToken = { mint: string; symbol: string };

/**
 * Create, rename, remove a list, and add or remove a mint.
 * The caller owns the store. This view prints the notice it is given.
 */
export function DiyWatchlistEditor({
  lists,
  selectedId,
  tokens,
  nameDraft,
  mintDraft,
  notice,
  onNameDraft,
  onMintDraft,
  onCreate,
  onRename,
  onRemoveList,
  onSelect,
  onAdd,
  onRemoveMint,
}: {
  lists: readonly DiyEditorList[];
  selectedId: string | null;
  tokens: readonly DiyEditorToken[];
  nameDraft: string;
  mintDraft: string;
  notice: string | null;
  onNameDraft: (value: string) => void;
  onMintDraft: (value: string) => void;
  onCreate: () => void;
  onRename: () => void;
  onRemoveList: () => void;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemoveMint: (mint: string) => void;
}) {
  const field = {
    ...ETHENA_TYPE.body,
    color: ethena.ink.primary,
    borderBottomWidth: 1,
    borderBottomColor: ethena.ink.tertiary,
    paddingVertical: 8,
    marginTop: 8,
  } as const;
  return (
    <View testID="diy-watchlist-editor" style={{ marginTop: 12 }}>
      <TextInput
        testID="diy-watchlist-name"
        value={nameDraft}
        onChangeText={onNameDraft}
        placeholder={copy.diyLists.namePlaceholder}
        placeholderTextColor={ethena.ink.tertiary}
        accessibilityLabel={copy.diyLists.namePlaceholder}
        style={field}
      />
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
        <Pressable
          testID="diy-watchlist-create"
          onPress={onCreate}
          accessibilityRole="button"
        >
          <CorsoText
            style={{ ...ETHENA_TYPE.cardAction, color: ethena.ink.primary }}
          >
            {copy.diyLists.newList}
          </CorsoText>
        </Pressable>
        <Pressable
          testID="diy-watchlist-rename"
          onPress={onRename}
          accessibilityRole="button"
        >
          <CorsoText
            style={{ ...ETHENA_TYPE.cardAction, color: ethena.ink.secondary }}
          >
            {copy.diyLists.rename}
          </CorsoText>
        </Pressable>
        <Pressable
          testID="diy-watchlist-remove-list"
          onPress={onRemoveList}
          accessibilityRole="button"
        >
          <CorsoText
            style={{ ...ETHENA_TYPE.cardAction, color: ethena.ink.secondary }}
          >
            {copy.diyLists.removeList}
          </CorsoText>
        </Pressable>
      </View>
      {lists.map((list) => (
        <Pressable
          key={list.id}
          testID={`diy-watchlist-pick-${list.id}`}
          onPress={() => onSelect(list.id)}
          accessibilityRole="button"
          accessibilityState={{ selected: list.id === selectedId }}
          accessibilityLabel={copy.diyLists.selectList}
        >
          <CorsoText
            style={{
              ...ETHENA_TYPE.body,
              color:
                list.id === selectedId
                  ? ethena.ink.primary
                  : ethena.ink.secondary,
              marginTop: 8,
            }}
          >
            {list.name}
          </CorsoText>
        </Pressable>
      ))}
      <TextInput
        testID="diy-watchlist-mint"
        value={mintDraft}
        onChangeText={onMintDraft}
        placeholder={copy.diyLists.mintPlaceholder}
        placeholderTextColor={ethena.ink.tertiary}
        accessibilityLabel={copy.diyLists.mintPlaceholder}
        autoCapitalize="none"
        autoCorrect={false}
        style={field}
      />
      <Pressable
        testID="diy-watchlist-add"
        onPress={onAdd}
        accessibilityRole="button"
      >
        <CorsoText
          style={{
            ...ETHENA_TYPE.cardAction,
            color: ethena.ink.primary,
            marginTop: 8,
          }}
        >
          {copy.diyLists.addToken}
        </CorsoText>
      </Pressable>
      {tokens.map((token) => (
        <View
          key={token.mint}
          testID={`diy-watchlist-token-${token.mint}`}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: 8,
            marginTop: 8,
          }}
        >
          <CorsoText style={{ ...ETHENA_TYPE.body, color: ethena.ink.primary }}>
            {token.symbol}
          </CorsoText>
          <Pressable
            testID={`diy-watchlist-remove-${token.mint}`}
            onPress={() => onRemoveMint(token.mint)}
            accessibilityRole="button"
            accessibilityLabel={copy.diyLists.removeToken}
          >
            <CorsoText
              style={{ ...ETHENA_TYPE.rowSub, color: ethena.ink.secondary }}
            >
              {copy.diyLists.removeToken}
            </CorsoText>
          </Pressable>
        </View>
      ))}
      {notice ? (
        <CorsoText
          testID="diy-watchlist-notice"
          style={{
            ...ETHENA_TYPE.rowSub,
            color: ethena.ink.secondary,
            marginTop: 8,
          }}
        >
          {notice}
        </CorsoText>
      ) : null}
    </View>
  );
}

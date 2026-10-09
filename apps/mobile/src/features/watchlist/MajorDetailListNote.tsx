import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { CorsoText } from '@/src/theme/CorsoText';
import { copy } from '@/constants/copy';
import { ethena } from '@/constants/theme.ethena';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { isModeratedTokenLabel } from '@/src/features/discovery/moderation';
import { EthenaTray } from '@/src/ui/ethena/EthenaPrimitives';
import { loadTokenFacts } from '@/src/features/tokenFacts/useTokenFacts';
import { DiyWatchlistEditor } from './DiyWatchlistEditor';
import { presentDiyNotice } from './presentReviewWatchlist';
import { addListedMint, runDiyCommand } from './runDiyCommand';
import { selectedDiyList } from './diyWatchlistModel';
import { isWatchlistMint } from './watchlistEntry';
import { useDiyWatchlists } from './watchlistStore';

export function MajorDetailListNote({ mint }: { mint: string }) {
  const runtime = useDiyWatchlists();
  const selected = selectedDiyList(runtime.data);
  const [nameDraft, setNameDraft] = useState('');
  const [mintDraft, setMintDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);

  async function addResolved(
    listId: string,
    rawMint: string,
  ): Promise<boolean> {
    const trimmed = rawMint.trim();
    if (!isWatchlistMint(trimmed)) {
      setNotice(copy.diyLists.invalidMint);
      return false;
    }
    const loaded = await loadTokenFacts({ mint: trimmed });
    const source = loaded.ok ? loaded.facts.sources.jupiter : null;
    const facts =
      source && source.status === 'ok'
        ? { symbol: source.fields.symbol, name: source.fields.name }
        : null;
    const result = addListedMint(listId, trimmed, facts);
    setNotice(result.ok ? null : presentDiyNotice(result.reason, 'addMint'));
    return result.ok;
  }

  if (!runtime.hydrated) {
    return (
      <EthenaTray testID="major-detail-list-tray">
        <View style={LIST_TRAY_BODY}>
          <CorsoText
            testID="major-detail-list-loading"
            style={{ ...ETHENA_TYPE.rowSub, color: ethena.ink.secondary }}
          >
            {copy.diyLists.reading}
          </CorsoText>
        </View>
      </EthenaTray>
    );
  }
  const onList = selected?.tokens.some((token) => token.mint === mint) ?? false;
  return (
    <EthenaTray testID="major-detail-list-tray">
      <View testID="major-detail-list" style={LIST_TRAY_BODY}>
        {selected ? (
          <CorsoText
            testID="major-detail-list-membership"
            style={{ ...ETHENA_TYPE.sub, color: ethena.ink.secondary }}
          >
            {onList
              ? copy.diyLists.onList(selected.name)
              : copy.diyLists.notOnList(selected.name)}
          </CorsoText>
        ) : (
          <TextInput
            testID="major-detail-list-name"
            value={nameDraft}
            onChangeText={setNameDraft}
            placeholder={copy.diyLists.namePlaceholder}
            placeholderTextColor={ethena.ink.tertiary}
            accessibilityLabel={copy.diyLists.namePlaceholder}
            style={{
              ...ETHENA_TYPE.body,
              color: ethena.ink.primary,
              borderBottomWidth: 1,
              borderBottomColor: ethena.ink.tertiary,
              paddingVertical: 8,
            }}
          />
        )}
        <View style={LIST_ACTIONS}>
          <Pressable
            testID="major-detail-list-action"
            accessibilityRole="button"
            onPress={() => {
              void (async () => {
                if (adding) return;
                if (!selected) {
                  const created = runDiyCommand({
                    type: 'create',
                    name: nameDraft,
                  });
                  setNotice(
                    created.ok
                      ? null
                      : presentDiyNotice(created.reason, 'create'),
                  );
                  if (!created.ok || !created.state.selectedId) return;
                  setAdding(true);
                  const ok = await addResolved(created.state.selectedId, mint);
                  setAdding(false);
                  if (ok) setNameDraft('');
                  return;
                }
                if (onList) {
                  const result = runDiyCommand({
                    type: 'removeMint',
                    listId: selected.id,
                    mint,
                  });
                  setNotice(
                    result.ok
                      ? null
                      : presentDiyNotice(result.reason, 'removeMint'),
                  );
                  return;
                }
                setAdding(true);
                await addResolved(selected.id, mint);
                setAdding(false);
              })();
            }}
          >
            <CorsoText
              style={{ ...ETHENA_TYPE.cardAction, color: ethena.ink.primary }}
            >
              {selected
                ? onList
                  ? copy.diyLists.removeToken
                  : copy.diyLists.addToList
                : copy.diyLists.newList}
            </CorsoText>
          </Pressable>
          <Pressable
            testID="major-detail-list-edit"
            accessibilityRole="button"
            accessibilityLabel={
              editing ? copy.diyLists.done : copy.diyLists.edit
            }
            onPress={() => setEditing((open) => !open)}
          >
            <CorsoText
              style={{ ...ETHENA_TYPE.cardAction, color: ethena.ink.secondary }}
            >
              {editing ? copy.diyLists.done : copy.diyLists.edit}
            </CorsoText>
          </Pressable>
        </View>
        {editing ? (
          <DiyWatchlistEditor
            lists={runtime.data.lists.map((list) => ({
              id: list.id,
              name: list.name,
              count: list.tokens.length,
            }))}
            selectedId={runtime.data.selectedId}
            tokens={(selected?.tokens ?? []).map((token) => ({
              mint: token.mint,
              symbol:
                token.symbol === copy.diyLists.unknownToken
                  ? token.symbol
                  : isModeratedTokenLabel({ symbol: token.symbol })
                    ? copy.watchlist.withheldSymbol
                    : token.symbol,
            }))}
            nameDraft={nameDraft}
            mintDraft={mintDraft}
            notice={notice}
            onNameDraft={setNameDraft}
            onMintDraft={setMintDraft}
            onCreate={() => {
              const created = runDiyCommand({
                type: 'create',
                name: nameDraft,
              });
              setNotice(
                created.ok ? null : presentDiyNotice(created.reason, 'create'),
              );
              if (created.ok) setNameDraft('');
            }}
            onRename={() => {
              if (!runtime.data.selectedId) return;
              const result = runDiyCommand({
                type: 'rename',
                id: runtime.data.selectedId,
                name: nameDraft,
              });
              setNotice(
                result.ok ? null : presentDiyNotice(result.reason, 'rename'),
              );
            }}
            onRemoveList={() => {
              if (!runtime.data.selectedId) return;
              const result = runDiyCommand({
                type: 'removeList',
                id: runtime.data.selectedId,
              });
              setNotice(
                result.ok
                  ? null
                  : presentDiyNotice(result.reason, 'removeList'),
              );
              if (result.ok) setNameDraft('');
            }}
            onSelect={(id) => {
              const result = runDiyCommand({ type: 'select', id });
              setNotice(
                result.ok ? null : presentDiyNotice(result.reason, 'select'),
              );
              const next = runtime.data.lists.find((list) => list.id === id);
              if (next) setNameDraft(next.name);
            }}
            onAdd={() => {
              if (!runtime.data.selectedId || adding) return;
              setAdding(true);
              void addResolved(runtime.data.selectedId, mintDraft).then(
                (ok) => {
                  setAdding(false);
                  if (ok) setMintDraft('');
                },
              );
            }}
            onRemoveMint={(target) => {
              if (!runtime.data.selectedId) return;
              const result = runDiyCommand({
                type: 'removeMint',
                listId: runtime.data.selectedId,
                mint: target,
              });
              setNotice(
                result.ok
                  ? null
                  : presentDiyNotice(result.reason, 'removeMint'),
              );
            }}
          />
        ) : notice ? (
          <CorsoText
            testID="major-detail-list-notice"
            style={{ ...ETHENA_TYPE.rowSub, color: ethena.ink.secondary }}
          >
            {notice}
          </CorsoText>
        ) : null}
      </View>
    </EthenaTray>
  );
}

/** The share tray's vertical rhythm (`MajorDetailFace`, `paddingVertical: 14`). */
const LIST_TRAY_BODY = { paddingVertical: 14, gap: 8 } as const;
/** The editor's action row (`DiyWatchlistEditor`, `gap: 12`). */
const LIST_ACTIONS = { flexDirection: 'row', gap: 12 } as const;

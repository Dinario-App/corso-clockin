import type { StyleProp, ViewStyle } from 'react-native';
import { copy } from '@/constants/copy';
import { GlassPill } from '@/src/ui/controls/GlassPill';
import { resolveWatchStarA11y } from './watchlistPresentation';
import { useWatchlist } from './watchlistStore';

export type WatchStarButtonProps = {
  mint: string;
  symbol: string;
  name?: string | null;
  /**
   * The store gate condemned this pair's label. The star still stores the
   * symbol — the star is the user's own and the watchlist row withholds the
   * label again when it draws it — but it never SPEAKS the word.
   */
  labelWithheld?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function WatchStarButton({
  mint,
  symbol,
  name,
  labelWithheld = false,
  style,
  testID,
}: WatchStarButtonProps) {
  const watchlist = useWatchlist();
  const watching = watchlist.isWatched(mint);
  return (
    <GlassPill
      label={watching ? copy.watchlist.watching : copy.watchlist.watch}
      accessibilityLabel={resolveWatchStarA11y({ watching, symbol, labelWithheld })}
      onPress={() => {
        watchlist.toggle({ mint, symbol, name: name ?? null });
      }}
      style={style}
      testID={testID}
    />
  );
}

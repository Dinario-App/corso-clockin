import {
  reduceDiyCommand,
  type DiyCommand,
  type DiyResult,
  type DiyWatchlists,
} from './diyWatchlistModel';

export {
  DIY_LIST_MAX,
  DIY_LIST_MINT_MAX,
  DIY_NAME_MAX,
  DIY_WATCHLISTS_STORAGE_KEY,
  EMPTY_DIY_WATCHLISTS,
  cleanDiyName,
  mergeDiyWatchlists,
  normalizeDiyWatchlists,
  parseDiyWatchlists,
  selectedDiyList,
  serializeDiyWatchlists,
} from './diyWatchlistModel';
export type {
  DiyCommand,
  DiyFailure,
  DiyList,
  DiyResult,
  DiyWatchlists,
} from './diyWatchlistModel';

/** Pure create / rename / remove / select / add / remove. Never throws. */
export function applyDiyCommand(
  state: DiyWatchlists,
  command: DiyCommand,
  nowMs: number,
): DiyResult {
  return reduceDiyCommand(state, command, nowMs);
}

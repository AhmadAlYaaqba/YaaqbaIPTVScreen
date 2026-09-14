import type { WatchHistoryEntry } from './storage';

export const HISTORY_FILTERS = ['all', 'movie', 'series', 'live'] as const;
export type HistoryFilter = (typeof HISTORY_FILTERS)[number];

export function filterWatchHistory(
  items: WatchHistoryEntry[],
  filter: HistoryFilter,
): WatchHistoryEntry[] {
  return filter === 'all' ? items : items.filter(item => item.type === filter);
}

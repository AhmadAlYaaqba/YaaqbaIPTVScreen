import AsyncStorage from '@react-native-async-storage/async-storage';

interface WatchProgress {
  contentId: string;
  progress: number; // in seconds
  timestamp: number;
  totalDuration: number;
  title: string;
  thumbnail?: string;
  seriesId?: string;
  episodeId?: string;
  episodeNumber?: string;
  seasonNumber?: string;
}

export interface RecentlyWatched {
  id: string;
  name: string;
  type: 'movie' | 'series' | 'live';
  thumbnail?: string;
  progress?: number;
  totalDuration?: number;
  seriesId?: string;
  episodeId?: string;
  episodeNumber?: number;
  seasonNumber?: number;
  channelName?: string;
  timestamp: number;
}

export interface LatestWatched {
  id: string;
  name: string;
  type: 'movie' | 'series' | 'live';
  thumbnail?: string;
  progress?: number;
  totalDuration?: number;
  seriesId?: string;
  episodeId?: string;
  episodeNumber?: number;
  seasonNumber?: number;
  channelName?: string;
  timestamp: number;
}

const STORAGE_KEYS = {
  MOVIE_PROGRESS: '@movie_progress',
  SERIES_PROGRESS: '@series_progress',
  RECENTLY_WATCHED: '@recently_watched',
  LATEST_WATCHED: '@latest_watched',
};

export const storage = {
  // Save watch progress
  saveWatchProgress: async (progress: WatchProgress, isMovie: boolean) => {
    try {
      const key = isMovie ? STORAGE_KEYS.MOVIE_PROGRESS : STORAGE_KEYS.SERIES_PROGRESS;
      const existing = await AsyncStorage.getItem(key);
      const progressMap = existing ? JSON.parse(existing) : {};
      
      // For series episodes, use both seriesId and episodeId as the key
      const storageKey = isMovie ? progress.contentId : `${progress.seriesId}_${progress.episodeId}`;
      progressMap[storageKey] = progress;
      
      await AsyncStorage.setItem(key, JSON.stringify(progressMap));
    } catch (error) {
      console.error('Error saving watch progress:', error);
    }
  },

  // Get watch progress for content
  getWatchProgress: async (contentId: string, isMovie: boolean, seriesId?: string, episodeId?: string): Promise<WatchProgress | null> => {
    try {
      const key = isMovie ? STORAGE_KEYS.MOVIE_PROGRESS : STORAGE_KEYS.SERIES_PROGRESS;
      const existing = await AsyncStorage.getItem(key);
      if (!existing) return null;
      
      const progressMap = JSON.parse(existing);
      // For series episodes, use both seriesId and episodeId as the key
      const storageKey = isMovie ? contentId : `${seriesId}_${episodeId}`;
      return progressMap[storageKey] || null;
    } catch (error) {
      console.error('Error getting watch progress:', error);
      return null;
    }
  },

  // Save to recently watched
  saveRecentlyWatched: async (item: RecentlyWatched) => {
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEYS.RECENTLY_WATCHED);
      const recent = existing ? JSON.parse(existing) : [];
      
      // Remove if already exists
      const filtered = recent.filter((i: RecentlyWatched) => i.id !== item.id);
      
      // Add to beginning
      filtered.unshift(item);
      
      // Keep only last 20 items
      const trimmed = filtered.slice(0, 30);
      
      await AsyncStorage.setItem(STORAGE_KEYS.RECENTLY_WATCHED, JSON.stringify(trimmed));
    } catch (error) {
      console.error('Error saving recently watched:', error);
    }
  },

  // Get recently watched items
  getRecentlyWatched: async (): Promise<RecentlyWatched[]> => {
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEYS.RECENTLY_WATCHED);
      return existing ? JSON.parse(existing) : [];
    } catch (error) {
      console.error('Error getting recently watched:', error);
      return [];
    }
  },

  // Clear watch progress for content
  clearWatchProgress: async (contentId: string, isMovie: boolean, seriesId?: string, episodeId?: string) => {
    try {
      const key = isMovie ? STORAGE_KEYS.MOVIE_PROGRESS : STORAGE_KEYS.SERIES_PROGRESS;
      const existing = await AsyncStorage.getItem(key);
      if (!existing) return;
      
      const progressMap = JSON.parse(existing);
      // For series episodes, use both seriesId and episodeId as the key
      const storageKey = isMovie ? contentId : `${seriesId}_${episodeId}`;
      delete progressMap[storageKey];
      
      await AsyncStorage.setItem(key, JSON.stringify(progressMap));
    } catch (error) {
      console.error('Error clearing watch progress:', error);
    }
  },

  // Get all progress for a type
  getAllProgress: async (isMovie: boolean): Promise<Record<string, WatchProgress>> => {
    try {
      const key = isMovie ? STORAGE_KEYS.MOVIE_PROGRESS : STORAGE_KEYS.SERIES_PROGRESS;
      const existing = await AsyncStorage.getItem(key);
      return existing ? JSON.parse(existing) : {};
    } catch (error) {
      console.error('Error getting all progress:', error);
      return {};
    }
  },

  // Save to latest watched (only keeps latest episode per series)
  saveLatestWatched: async (item: LatestWatched) => {
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEYS.LATEST_WATCHED);
      const latest = existing ? JSON.parse(existing) : [];
      
      // Remove if already exists (to avoid duplicates)
      const filtered = latest.filter((i: LatestWatched) => {
        if (i.type === 'series' && item.type === 'series') {
          // For series, only keep the latest episode
          return i.seriesId !== item.seriesId;
        }
        return i.id !== item.id;
      });
      
      // Add to beginning
      filtered.unshift(item);
      
      // Keep only last 10 items
      const trimmed = filtered.slice(0, 10);
      
      await AsyncStorage.setItem(STORAGE_KEYS.LATEST_WATCHED, JSON.stringify(trimmed));
    } catch (error) {
      console.error('Error saving latest watched:', error);
    }
  },

  // Get latest watched items
  getLatestWatched: async (): Promise<LatestWatched[]> => {
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEYS.LATEST_WATCHED);
      const mappedItems = existing ? JSON.parse(existing) : [];
      
      // Fetch progress for each item
      const itemsWithProgress = await Promise.all(
        mappedItems.map(async (item: LatestWatched) => {
          if (item.type === 'series' && item.seriesId && item.episodeId) {
            const progress = await storage.getWatchProgress(
              item.seriesId,
              false,
              item.seriesId,
              item.episodeId
            );
            if (progress) {
              return {
                ...item,
                progress: progress.progress,
                totalDuration: progress.totalDuration,
              };
            }
          } else if (item.type === 'movie') {
            const progress = await storage.getWatchProgress(item.id, true);
            if (progress) {
              return {
                ...item,
                progress: progress.progress,
                totalDuration: progress.totalDuration,
              };
            }
          }
          return item;
        })
      );
      
      return itemsWithProgress;
    } catch (error) {
      console.error('Error getting latest watched:', error);
      return [];
    }
  },
}; 
import AsyncStorage from '@react-native-async-storage/async-storage';

interface WatchProgress {
  seriesId: string;
  episodeId: string;
  progress: number; // in seconds
  timestamp: number;
  totalDuration: number;
  seriesName: string;
  episodeName: string;
  thumbnail?: string;
}

interface RecentlyWatched {
  id: string;
  type: 'movie' | 'series';
  name: string;
  thumbnail?: string;
  timestamp: number;
}

const STORAGE_KEYS = {
  WATCH_PROGRESS: '@watch_progress',
  RECENTLY_WATCHED: '@recently_watched',
};

export const storage = {
  // Save watch progress
  saveWatchProgress: async (progress: WatchProgress) => {
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEYS.WATCH_PROGRESS);
      const progressMap = existing ? JSON.parse(existing) : {};
      progressMap[progress.seriesId] = progress;
      await AsyncStorage.setItem(STORAGE_KEYS.WATCH_PROGRESS, JSON.stringify(progressMap));
    } catch (error) {
      console.error('Error saving watch progress:', error);
    }
  },

  // Get watch progress for a series
  getWatchProgress: async (seriesId: string): Promise<WatchProgress | null> => {
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEYS.WATCH_PROGRESS);
      if (!existing) return null;
      const progressMap = JSON.parse(existing);
      return progressMap[seriesId] || null;
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
      const trimmed = filtered.slice(0, 20);
      
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

  // Clear watch progress for a series
  clearWatchProgress: async (seriesId: string) => {
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEYS.WATCH_PROGRESS);
      if (!existing) return;
      const progressMap = JSON.parse(existing);
      delete progressMap[seriesId];
      await AsyncStorage.setItem(STORAGE_KEYS.WATCH_PROGRESS, JSON.stringify(progressMap));
    } catch (error) {
      console.error('Error clearing watch progress:', error);
    }
  }
}; 
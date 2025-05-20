export interface IPTVState {
  username: string;
  password: string;
  serverDomain: string;
  serverPort: string;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  watchProgress: {
    [key: string]: {
      progress: number;
      totalDuration: number;
      timestamp: number;
    };
  };
  recentlyWatched: Array<{
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
  }>;
}

export interface RootState {
  iptv: IPTVState;
} 
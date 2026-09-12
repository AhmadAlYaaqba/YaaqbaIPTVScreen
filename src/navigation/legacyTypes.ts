/**
 * Route contract for screens retained only as reference. These routes are not
 * registered by the production navigator and therefore are not bundled.
 */
export type LegacyStackParamList = {
  Login: undefined;
  Main: undefined;
  Home: undefined;
  Live: undefined;
  LiveTV: undefined;
  Movies: undefined;
  Series: undefined;
  Settings: undefined;
  LiveChannels: { categoryId: string; categoryName: string };
  VideoPlayer: {
    streamUrl: string;
    channelName?: string;
    isLive?: boolean;
    title?: string;
    seriesId?: string;
    episodeId?: string;
    episodeList?: any[];
    currentEpisodeIndex?: number;
    movieId?: string;
    continueTime?: { progress: number; totalDuration?: number } | null;
    thumbnail?: string;
    categoryId?: string;
  };
  MovieList: { categoryId: string; categoryName: string };
  MovieDetail: { movie: any };
  SeriesCategories: undefined;
  SeriesList: { categoryId: string; categoryName: string };
  SeriesDetail: {
    seriesId: string;
    seriesName: string;
    baseInfo?: any;
  };
};

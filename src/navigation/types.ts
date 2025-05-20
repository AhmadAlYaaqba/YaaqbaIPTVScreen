export type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  VideoPlayer: {
    streamUrl: string;
    isLive: boolean;
    title: string;
    movieId?: string;
    seriesId?: string;
    episodeId?: string;
    episodeList?: any[];
    currentEpisodeIndex?: number;
    continueTime?: number;
  };
  SeriesDetail: {
    seriesId: string;
    seriesName: string;
  };
  MovieDetail: {
    movieId: string;
    movieName: string;
  };
  LiveStream: {
    channelId: string;
    channelName: string;
  };
  LiveTV: undefined;
  Movies: undefined;
  Series: undefined;
}; 
import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type TabParamList = {
  Home: undefined;
  LiveTV: undefined;
  Movies: undefined;
  Series: undefined;
  Settings: undefined;
};

export interface ContinueTime {
  progress: number;
  totalDuration?: number;
}

export interface PlaybackEpisode {
  id: string | number;
  title?: string;
  container_extension?: string;
  [key: string]: unknown;
}

export type RootStackParamList = {
  Login: { initialTab?: 'activation' | 'xtream'; mode?: 'add' } | undefined;
  Main: NavigatorScreenParams<TabParamList> | undefined;
  SeriesDetail: {
    seriesId: string;
    seriesName: string;
    baseInfo?: Record<string, any>;
  };
  VideoPlayer: {
    streamUrl: string;
    streamId?: string;
    containerExtension?: string;
    channelName?: string;
    isLive?: boolean;
    title?: string;
    seriesId?: string;
    episodeId?: string;
    episodeList?: PlaybackEpisode[];
    currentEpisodeIndex?: number;
    movieId?: string;
    continueTime?: ContinueTime | null;
    thumbnail?: string;
    categoryId?: string;
  };
};

export type RootScreenProps<RouteName extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, RouteName>;

export type TabScreenProps<RouteName extends keyof TabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<TabParamList, RouteName>,
    NativeStackScreenProps<RootStackParamList, 'Main'>
  >;

export type MediaType = 'movie' | 'series' | 'live';

export interface MediaItem {
  id: string;
  title: string;
  originalTitle?: string;
  overview?: string;
  poster?: string;
  backdrop?: string;
  rating?: number;
  releaseDate?: string;
  genres?: string[];
  type: MediaType;
}

export interface CastMember {
  id: string;
  name: string;
  character?: string;
  profile?: string;
}

export interface SeasonEpisode {
  episodeNumber: number;
  title?: string;
  overview?: string;
  still?: string;
  airDate?: string;
  rating?: number;
}

export interface MediaDetails extends MediaItem {
  tagline?: string;
  runtime?: number;
  cast: CastMember[];
  logos?: string[];
  seasons?: SeasonEpisode[][];
}

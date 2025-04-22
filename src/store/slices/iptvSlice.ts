// store/slices/iptvSlice.ts
import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import axios from 'axios';

interface Channel {
  num: number;
  name: string;
  stream_id: number;
  stream_icon: string;
  epg_channel_id: string;
}

interface Category {
  category_id: string;
  category_name: string;
  url?: string; // or any other fields you need
}

interface MovieCategory {
  category_id: string;
  category_name: string;
  parent_id?: string;
}

interface MovieStream {
  stream_id: number;
  name: string;
  stream_icon: string;
  // other fields from your server
  // e.g., "container_extension", "rating", "added", etc.
}

interface SeriesCategory {
  category_id: string;
  category_name: string;
}

interface SeriesItem {
  series_id: string;
  name: string;
  cover: string;
  // other fields...
}

interface Episode {
  id: number;
  title: string;
  container_extension: string;
  // e.g., "info" etc.
}

interface SeriesInfo {
  info: {
    name: string;
    plot?: string;
    cast?: string;
    rating?: string;
    // ...
  };
  episodes: {
    [seasonNumber: string]: Episode[];
  };
}

interface IPTVState {
  liveCategories: Category[];
  liveChannels: Channel[];
  movieCategories: MovieCategory[];
  movieList: MovieStream[];
  seriesCategories: SeriesCategory[];
  seriesList: SeriesItem[];
  selectedSeriesInfo: SeriesInfo | null; // data from get_series_info
  loading: boolean;
  error: string | null;
}

const initialState: IPTVState = {
  liveCategories: [],
  movieCategories: [],
  movieList: [],
  liveChannels: [],
  seriesCategories: [],
  seriesList: [],
  selectedSeriesInfo: null,
  loading: false,
  error: null,
};

// 1) Fetch Live Categories
export const fetchLiveChannels = createAsyncThunk(
  'iptv/fetchLiveChannels',
  async ({
    username,
    password,
    domain,
    port,
  }: {
    username: string;
    password: string;
    domain: string;
    port: string;
  }) => {
    // For Xtream: get_live_categories or get_live_streams
    const url = `http://${domain}:${port}/player_api.php?username=${username}&password=${password}&action=get_live_categories`;
    const response = await axios.get(url);
    return response.data;
  },
);

// 2) Fetch Series Categories
export const fetchSeries = createAsyncThunk(
  'iptv/fetchSeries',
  async ({
    username,
    password,
    domain,
    port,
  }: {
    username: string;
    password: string;
    domain: string;
    port: string;
  }) => {
    const url = `http://${domain}:${port}/player_api.php?username=${username}&password=${password}&action=get_series_categories`;
    const response = await axios.get(url);
    return response.data;
  },
);

// 3) Fetch Movie Categories
export const fetchMovieCategories = createAsyncThunk(
  'iptv/fetchMovieCategories',
  async ({
    username,
    password,
    domain,
    port,
  }: {
    username: string;
    password: string;
    domain: string;
    port: string;
  }) => {
    const url = `http://${domain}:${port}/player_api.php?username=${username}&password=${password}&action=get_vod_categories`;
    const response = await axios.get(url);
    return response.data as MovieCategory[];
  },
);

// 4) Fetch Movie List in a Category
export const fetchMoviesInCategory = createAsyncThunk(
  'iptv/fetchMoviesInCategory',
  async ({
    username,
    password,
    domain,
    port,
    categoryId,
  }: {
    username: string;
    password: string;
    domain: string;
    port: string;
    categoryId: string;
  }) => {
    // e.g. http://domain:port/player_api.php?username=USER&password=PASS&action=get_vod_streams&category_id=XX
    const url = `http://${domain}:${port}/player_api.php?username=${username}&password=${password}&action=get_vod_streams&category_id=${categoryId}`;
    const response = await axios.get(url);
    return response.data as MovieStream[];
  },
);

export const fetchLiveStreamsByCategory = createAsyncThunk(
  'iptv/fetchLiveStreamsByCategory',
  async ({
    username,
    password,
    domain,
    port,
    categoryId,
  }: {
    username: string;
    password: string;
    domain: string;
    port: string;
    categoryId: string;
  }) => {
    // e.g.:
    //  http://DOMAIN:PORT/player_api.php?username=USER&password=PASS&action=get_live_streams&category_id=XX
    const url = `http://${domain}:${port}/player_api.php?username=${username}&password=${password}&action=get_live_streams&category_id=${categoryId}`;
    const response = await axios.get(url);

    // The response is typically an array of channels. Might need transformation:
    // Example returned data shape:
    // [ { "num": "1", "name": "BBC One", "stream_type": "live", ... }, { ... } ]
    return response.data;
  },
);

// SERIES APIS ACTIONS

// 1) Fetch Series Categories
export const fetchSeriesCategories = createAsyncThunk(
  'iptv/fetchSeriesCategories',
  async ({
    username,
    password,
    domain,
    port,
  }: {
    username: string;
    password: string;
    domain: string;
    port: string;
  }) => {
    const url = `http://${domain}:${port}/player_api.php?username=${username}&password=${password}&action=get_series_categories`;
    const response = await axios.get(url);
    return response.data as SeriesCategory[];
  },
);

// 2) Fetch Series by Category
export const fetchSeriesByCategory = createAsyncThunk(
  'iptv/fetchSeriesByCategory',
  async ({
    username,
    password,
    domain,
    port,
    categoryId,
  }: {
    username: string;
    password: string;
    domain: string;
    port: string;
    categoryId: string;
  }) => {
    const url = `http://${domain}:${port}/player_api.php?username=${username}&password=${password}&action=get_series&category_id=${categoryId}`;
    const response = await axios.get(url);
    return response.data as SeriesItem[];
  },
);

// 3) Fetch Series Info (Seasons/Episodes) for one series_id
export const fetchSeriesInfo = createAsyncThunk(
  'iptv/fetchSeriesInfo',
  async ({
    username,
    password,
    domain,
    port,
    seriesId,
  }: {
    username: string;
    password: string;
    domain: string;
    port: string;
    seriesId: string;
  }) => {
    const url = `http://${domain}:${port}/player_api.php?username=${username}&password=${password}&action=get_series_info&series_id=${seriesId}`;
    const response = await axios.get(url);
    return response.data as SeriesInfo;
  },
);

const iptvSlice = createSlice({
  name: 'iptv',
  initialState,
  reducers: {},
  extraReducers: builder => {
    // ============== FETCH LIVE CATEGORIES ==============
    builder
      .addCase(fetchLiveChannels.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchLiveChannels.fulfilled,
        (state, action: PayloadAction<Category[]>) => {
          state.loading = false;
          state.liveCategories = action.payload; // parse as needed
        },
      )
      .addCase(fetchLiveChannels.rejected, (state, action) => {
        console.log('error =>', action.error.message);
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch live categories';
      });

    // ============== FETCH SERIES CATEGORIES ==============
    builder
      .addCase(fetchSeries.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchSeries.fulfilled,
        (state, action: PayloadAction<Category[]>) => {
          state.loading = false;
          state.seriesCategories = action.payload;
        },
      )
      .addCase(fetchSeries.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch series';
      });

    // ============== FETCH MOVIE CATEGORIES ==============
    builder
      .addCase(fetchMovieCategories.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchMovieCategories.fulfilled,
        (state, action: PayloadAction<MovieCategory[]>) => {
          state.loading = false;
          state.movieCategories = action.payload;
        },
      )
      .addCase(fetchMovieCategories.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.error.message || 'Failed to fetch movie categories';
      });

    // ============== FETCH MOVIE LIST ==============
    builder
      .addCase(fetchMoviesInCategory.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchMoviesInCategory.fulfilled,
        (state, action: PayloadAction<MovieStream[]>) => {
          state.loading = false;
          state.movieList = action.payload;
        },
      )
      .addCase(fetchMoviesInCategory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch movies';
      });

    // ============== FETCH LIVE STREAM BY CATEGORY ==============
    builder
      .addCase(fetchLiveStreamsByCategory.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchLiveStreamsByCategory.fulfilled,
        (state, action: PayloadAction<Channel[]>) => {
          state.loading = false;
          // Here we store them in liveChannels
          state.liveChannels = action.payload;
        },
      )
      .addCase(fetchLiveStreamsByCategory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch live streams';
      });
    // =========== Series Categories ===========
    builder
      .addCase(fetchSeriesCategories.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchSeriesCategories.fulfilled,
        (state, action: PayloadAction<SeriesCategory[]>) => {
          state.loading = false;
          state.seriesCategories = action.payload;
        },
      )
      .addCase(fetchSeriesCategories.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.error.message || 'Failed to fetch series categories';
      });

    // =========== Series List by Category ===========
    builder
      .addCase(fetchSeriesByCategory.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchSeriesByCategory.fulfilled,
        (state, action: PayloadAction<SeriesItem[]>) => {
          state.loading = false;
          state.seriesList = action.payload;
        },
      )
      .addCase(fetchSeriesByCategory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch series';
      });

    // =========== Selected Series Info (Seasons/Episodes) ===========
    builder
      .addCase(fetchSeriesInfo.pending, state => {
        state.loading = true;
        state.error = null;
        state.selectedSeriesInfo = null;
      })
      .addCase(
        fetchSeriesInfo.fulfilled,
        (state, action: PayloadAction<SeriesInfo>) => {
          state.loading = false;
          state.selectedSeriesInfo = action.payload;
        },
      )
      .addCase(fetchSeriesInfo.rejected, (state, action) => {
        state.loading = false;
        state.selectedSeriesInfo = null;
        state.error = action.error.message || 'Failed to fetch series info';
      });
  },
});

export default iptvSlice.reducer;

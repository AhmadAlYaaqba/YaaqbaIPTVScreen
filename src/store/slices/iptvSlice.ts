// store/slices/iptvSlice.ts
import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import axios from 'axios';
import {proxyApiUrl} from '../../utils/proxy';
import {
  buildPlayerApiUrl,
  XTREAM_REQUEST_HEADERS,
} from '../../utils/xtream';

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
  loadingCategories: boolean;
  loadingMovies: boolean;
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
  loadingCategories: false,
  loadingMovies: false,
  error: null,
};

const xtreamRequestConfig = {
  headers: XTREAM_REQUEST_HEADERS,
  timeout: 15000,
};

type XtreamRequestMeta = {
  context: string;
  requestUrl: string;
};

async function fetchXtreamData({
  context,
  requestUrl,
}: XtreamRequestMeta) {
  try {
    const response = await axios.get(requestUrl, xtreamRequestConfig);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data =
        typeof error.response?.data === 'string'
          ? error.response.data.slice(0, 160)
          : JSON.stringify(error.response?.data ?? '').slice(0, 160);
      const detail = status
        ? `HTTP ${status}${data ? `: ${data}` : ''}`
        : error.message;
      throw new Error(`Xtream request failed (${context}): ${detail}`);
    }

    throw error;
  }
}

// 1) Fetch Live Categories
export const fetchLiveChannels = createAsyncThunk(
  'iptv/fetchLiveChannels',
  async ({
    username,
    password,
    domain,
    port,
    useProxy = true,
  }: {
    username: string;
    password: string;
    domain: string;
    port: string;
    useProxy?: boolean;
  }) => {
    const originalUrl = buildPlayerApiUrl({
      username,
      password,
      domain,
      port,
      action: 'get_live_categories',
    });
    const url = proxyApiUrl(originalUrl, useProxy);
    return fetchXtreamData({
      context: 'get_live_categories',
      requestUrl: url,
    });
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
    useProxy = true,
  }: {
    username: string;
    password: string;
    domain: string;
    port: string;
    useProxy?: boolean;
  }) => {
    const originalUrl = buildPlayerApiUrl({
      username,
      password,
      domain,
      port,
      action: 'get_series_categories',
    });
    const url = proxyApiUrl(originalUrl, useProxy);
    return fetchXtreamData({
      context: 'get_series_categories',
      requestUrl: url,
    });
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
    useProxy = true,
  }: {
    username: string;
    password: string;
    domain: string;
    port: string;
    useProxy?: boolean;
  }) => {
    const originalUrl = buildPlayerApiUrl({
      username,
      password,
      domain,
      port,
      action: 'get_vod_categories',
    });
    const url = proxyApiUrl(originalUrl, useProxy);
    return (await fetchXtreamData({
      context: 'get_vod_categories',
      requestUrl: url,
    })) as MovieCategory[];
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
    useProxy = true,
  }: {
    username: string;
    password: string;
    domain: string;
    port: string;
    categoryId: string;
    useProxy?: boolean;
  }) => {
    const originalUrl = buildPlayerApiUrl({
      username,
      password,
      domain,
      port,
      action: 'get_vod_streams',
      extraParams: {category_id: categoryId},
    });
    const url = proxyApiUrl(originalUrl, useProxy);
    return (await fetchXtreamData({
      context: 'get_vod_streams',
      requestUrl: url,
    })) as MovieStream[];
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
    useProxy = true,
  }: {
    username: string;
    password: string;
    domain: string;
    port: string;
    categoryId: string;
    useProxy?: boolean;
  }) => {
    const originalUrl = buildPlayerApiUrl({
      username,
      password,
      domain,
      port,
      action: 'get_live_streams',
      extraParams: {category_id: categoryId},
    });
    const url = proxyApiUrl(originalUrl, useProxy);
    return fetchXtreamData({
      context: 'get_live_streams',
      requestUrl: url,
    });
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
    useProxy = true,
  }: {
    username: string;
    password: string;
    domain: string;
    port: string;
    useProxy?: boolean;
  }) => {
    const originalUrl = buildPlayerApiUrl({
      username,
      password,
      domain,
      port,
      action: 'get_series_categories',
    });
    const url = proxyApiUrl(originalUrl, useProxy);
    return (await fetchXtreamData({
      context: 'get_series_categories',
      requestUrl: url,
    })) as SeriesCategory[];
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
    useProxy = true,
  }: {
    username: string;
    password: string;
    domain: string;
    port: string;
    categoryId: string;
    useProxy?: boolean;
  }) => {
    const originalUrl = buildPlayerApiUrl({
      username,
      password,
      domain,
      port,
      action: 'get_series',
      extraParams: {category_id: categoryId},
    });
    const url = proxyApiUrl(originalUrl, useProxy);
    return (await fetchXtreamData({
      context: 'get_series',
      requestUrl: url,
    })) as SeriesItem[];
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
    useProxy = true,
  }: {
    username: string;
    password: string;
    domain: string;
    port: string;
    seriesId: string;
    useProxy?: boolean;
  }) => {
    const originalUrl = buildPlayerApiUrl({
      username,
      password,
      domain,
      port,
      action: 'get_series_info',
      extraParams: {series_id: seriesId},
    });
    const url = proxyApiUrl(originalUrl, useProxy);
    return (await fetchXtreamData({
      context: 'get_series_info',
      requestUrl: url,
    })) as SeriesInfo;
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
        state.loadingCategories = true;
        state.error = null;
      })
      .addCase(
        fetchLiveChannels.fulfilled,
        (state, action: PayloadAction<Category[]>) => {
          state.loadingCategories = false;
          state.liveCategories = Array.isArray(action.payload) ? action.payload : [];
        },
      )
      .addCase(fetchLiveChannels.rejected, (state, action) => {
        if (__DEV__) console.log('error =>', action.error.message);
        state.loadingCategories = false;
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
          state.seriesCategories = Array.isArray(action.payload) ? action.payload : [];
        },
      )
      .addCase(fetchSeries.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch series';
      });

    // ============== FETCH MOVIE CATEGORIES ==============
    builder
      .addCase(fetchMovieCategories.pending, state => {
        state.loadingCategories = true;
        state.error = null;
      })
      .addCase(
        fetchMovieCategories.fulfilled,
        (state, action: PayloadAction<MovieCategory[]>) => {
          state.loadingCategories = false;
          state.movieCategories = Array.isArray(action.payload) ? action.payload : [];
        },
      )
      .addCase(fetchMovieCategories.rejected, (state, action) => {
        state.loadingCategories = false;
        state.error =
          action.error.message || 'Failed to fetch movie categories';
      });

    // ============== FETCH MOVIE LIST ==============
    builder
      .addCase(fetchMoviesInCategory.pending, state => {
        state.loadingMovies = true;
        state.error = null;
      })
      .addCase(
        fetchMoviesInCategory.fulfilled,
        (state, action: PayloadAction<MovieStream[]>) => {
          state.loadingMovies = false;
          state.movieList = Array.isArray(action.payload) ? action.payload : [];
        },
      )
      .addCase(fetchMoviesInCategory.rejected, (state, action) => {
        state.loadingMovies = false;
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
          state.liveChannels = Array.isArray(action.payload) ? action.payload : [];
        },
      )
      .addCase(fetchLiveStreamsByCategory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch live streams';
      });
    // =========== Series Categories ===========
    builder
      .addCase(fetchSeriesCategories.pending, state => {
        state.loadingCategories = true;
        state.error = null;
      })
      .addCase(
        fetchSeriesCategories.fulfilled,
        (state, action: PayloadAction<SeriesCategory[]>) => {
          state.loadingCategories = false;
          state.seriesCategories = Array.isArray(action.payload) ? action.payload : [];
        },
      )
      .addCase(fetchSeriesCategories.rejected, (state, action) => {
        state.loadingCategories = false;
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
          state.seriesList = Array.isArray(action.payload) ? action.payload : [];
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

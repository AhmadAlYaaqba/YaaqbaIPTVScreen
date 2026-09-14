import type { PlaybackRequest } from '../types/player';
import type { WatchHistoryEntry, WatchHistoryInput } from './storage';

export function playbackRequestToHistoryInput(
  request: PlaybackRequest,
  progress = 0,
  totalDuration?: number,
  timestamp = Date.now(),
): WatchHistoryInput {
  const common = {
    id: request.kind === 'episode' ? request.seriesId : request.streamId,
    name: request.title,
    thumbnail: request.thumbnail,
    containerExtension: request.extension,
    timestamp,
    completed: false,
  };

  if (request.kind === 'live') {
    return {
      ...common,
      type: 'live',
      streamId: request.streamId,
      channelName: request.channelName,
      categoryId: request.categoryId,
    };
  }

  const progressFields = {
    progress,
    totalDuration:
      totalDuration && totalDuration > 0
        ? totalDuration
        : request.resume?.totalDuration ?? request.expectedDuration,
  };
  if (request.kind === 'movie') {
    return {
      ...common,
      ...progressFields,
      type: 'movie',
      streamId: request.streamId,
    };
  }

  return {
    ...common,
    ...progressFields,
    type: 'series',
    seriesId: request.seriesId,
    episodeId: request.streamId,
    seriesName: request.seriesName,
    episodeName: request.title,
    episodeNumber: request.episodeNumber,
    seasonNumber: request.seasonNumber,
  };
}

export function historyEntryToPlaybackRequest(
  item: WatchHistoryEntry,
): PlaybackRequest {
  if (item.type === 'live') {
    return {
      kind: 'live',
      streamId: item.streamId,
      extension: item.containerExtension,
      title: item.channelName,
      channelName: item.channelName,
      thumbnail: item.thumbnail,
      categoryId: item.categoryId,
    };
  }

  const resume =
    !item.completed && (item.progress ?? 0) > 0
      ? {
          progress: item.progress ?? 0,
          totalDuration: item.totalDuration,
        }
      : undefined;

  if (item.type === 'movie') {
    return {
      kind: 'movie',
      streamId: item.streamId,
      extension: item.containerExtension,
      title: item.name,
      thumbnail: item.thumbnail,
      expectedDuration: item.totalDuration,
      ...(resume ? { resume } : {}),
    };
  }

  return {
    kind: 'episode',
    streamId: item.episodeId,
    extension: item.containerExtension,
    title: item.episodeName ?? item.name,
    thumbnail: item.thumbnail,
    expectedDuration: item.totalDuration,
    seriesId: item.seriesId,
    seriesName: item.seriesName,
    episodeNumber: item.episodeNumber,
    seasonNumber: item.seasonNumber,
    ...(resume ? { resume } : {}),
  };
}

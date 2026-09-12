export function parseDurationSeconds(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  if (!normalized.includes(':')) {
    const seconds = Number(normalized);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
  }

  const parts = normalized.split(':').map(Number);
  if (
    (parts.length !== 2 && parts.length !== 3) ||
    parts.some(part => !Number.isFinite(part) || part < 0)
  ) {
    return undefined;
  }

  const [hours, minutes, seconds] =
    parts.length === 3 ? parts : [0, parts[0], parts[1]];
  const total = hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? total : undefined;
}

export function parseRuntimeMinutes(value: unknown): number | undefined {
  if (Array.isArray(value)) {
    for (const candidate of value) {
      const minutes = parseRuntimeMinutes(candidate);
      if (minutes) return minutes;
    }
    return undefined;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }
  if (value.includes(':')) {
    const seconds = parseDurationSeconds(value);
    return seconds ? seconds / 60 : undefined;
  }
  const minutes = Number(value);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : undefined;
}

export function getMediaDurationSeconds(
  media: unknown,
  fallbackMinutes?: number,
): number | undefined {
  const item =
    media && typeof media === 'object' ? (media as Record<string, any>) : {};
  const info =
    item.info && typeof item.info === 'object'
      ? (item.info as Record<string, unknown>)
      : {};

  const candidates = [
    info.duration_secs,
    item.duration_secs,
    info.duration,
    item.duration,
  ];

  for (const candidate of candidates) {
    const duration = parseDurationSeconds(candidate);
    if (duration) {
      return duration;
    }
  }

  return fallbackMinutes && fallbackMinutes > 0
    ? fallbackMinutes * 60
    : undefined;
}

export function getSeekTimeFromPosition(
  x: number,
  width: number,
  duration: number,
): number | null {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(width) ||
    !Number.isFinite(duration) ||
    width <= 0 ||
    duration <= 0
  ) {
    return null;
  }

  const progress = Math.max(0, Math.min(1, x / width));
  return progress * duration;
}

export function formatPlaybackTime(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = Math.floor(safeSeconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds
      .toString()
      .padStart(2, '0')}`;
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

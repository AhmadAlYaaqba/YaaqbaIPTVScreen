const VLC_MIN_END_TOLERANCE_MS = 2000;
const VLC_MAX_END_TOLERANCE_MS = 5000;
const VLC_END_TOLERANCE_RATIO = 0.01;

/**
 * LibVLC exposes a stopped event rather than a dedicated natural-end event.
 * Only accept a stop as completion when it was not requested by the app and
 * playback was genuinely close to a known duration.
 */
export function isVlcNaturalCompletion({
  isLive,
  wasManuallyStopped,
  durationMs,
  positionMs,
}: {
  isLive: boolean;
  wasManuallyStopped: boolean;
  durationMs: number;
  positionMs: number;
}): boolean {
  if (
    isLive ||
    wasManuallyStopped ||
    !Number.isFinite(durationMs) ||
    !Number.isFinite(positionMs) ||
    durationMs <= 0 ||
    positionMs < 0
  ) {
    return false;
  }

  const toleranceMs = Math.min(
    VLC_MAX_END_TOLERANCE_MS,
    Math.max(VLC_MIN_END_TOLERANCE_MS, durationMs * VLC_END_TOLERANCE_RATIO),
  );

  return positionMs >= durationMs - toleranceMs;
}

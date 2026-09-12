import {
  formatPlaybackTime,
  getMediaDurationSeconds,
  getSeekTimeFromPosition,
  parseDurationSeconds,
  parseRuntimeMinutes,
} from '../src/utils/playbackTime';

describe('playback time helpers', () => {
  it('parses Xtream duration formats', () => {
    expect(parseDurationSeconds('00:42:30')).toBe(2550);
    expect(parseDurationSeconds('42:30')).toBe(2550);
    expect(parseDurationSeconds('3600')).toBe(3600);
    expect(parseDurationSeconds('00:00:00')).toBeUndefined();
  });

  it('uses episode metadata before the TMDB minute fallback', () => {
    expect(getMediaDurationSeconds({ info: { duration_secs: 2700 } }, 60)).toBe(
      2700,
    );
    expect(getMediaDurationSeconds({}, 45)).toBe(2700);
  });

  it('normalizes Xtream series runtime values expressed in minutes', () => {
    expect(parseRuntimeMinutes(45)).toBe(45);
    expect(parseRuntimeMinutes('45')).toBe(45);
    expect(parseRuntimeMinutes('00:45:00')).toBe(45);
    expect(parseRuntimeMinutes([0, '50'])).toBe(50);
    expect(parseRuntimeMinutes('0')).toBeUndefined();
  });

  it('maps taps across the whole seek bar and clamps its edges', () => {
    expect(getSeekTimeFromPosition(100, 200, 3600)).toBe(1800);
    expect(getSeekTimeFromPosition(-20, 200, 3600)).toBe(0);
    expect(getSeekTimeFromPosition(240, 200, 3600)).toBe(3600);
    expect(getSeekTimeFromPosition(10, 0, 3600)).toBeNull();
  });

  it('formats elapsed and remaining time safely', () => {
    expect(formatPlaybackTime(65)).toBe('1:05');
    expect(formatPlaybackTime(3661)).toBe('1:01:01');
    expect(formatPlaybackTime(Number.NaN)).toBe('0:00');
  });
});

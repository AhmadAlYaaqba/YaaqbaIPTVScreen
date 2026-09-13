/* eslint-env jest */

import {
  getSanitizedPlaybackError,
  sanitizePlaybackText,
} from '../src/utils/playbackDiagnostics';

describe('playback diagnostics', () => {
  it('removes URLs and known credentials from error messages', () => {
    const diagnostic = getSanitizedPlaybackError(
      {
        error: {
          errorCode: 'SOURCE_ERROR',
          errorString:
            'Failed https://example.com/series/test-user/test-pass/42.mkv for test-user',
        },
      },
      ['test-user', 'test-pass'],
    );

    expect(diagnostic).toEqual({
      code: 'SOURCE_ERROR',
      message: 'Failed [redacted-url] for [redacted]',
    });
  });

  it('redacts credential paths and query secrets without a full URL', () => {
    const message = sanitizePlaybackText(
      'Open /live/user/password/12.ts?token=secret failed',
    );

    expect(message).toBe(
      'Open /live/[redacted]/[redacted]/12.ts?token=[redacted] failed',
    );
  });

  it('redacts short credentials as well', () => {
    expect(sanitizePlaybackText('User ab failed', ['ab'])).toBe(
      'User [redacted] failed',
    );
  });
});

/* eslint-env jest */

import { deriveNetworkStatus } from '../src/hooks/useNetworkStatus';

describe('network status', () => {
  it('does not interrupt playback for a failed reachability probe on a connected link', () => {
    expect(deriveNetworkStatus(true, false)).toEqual({
      isOffline: false,
      isNetworkStatusKnown: true,
    });
  });

  it('reports a disconnected link as offline', () => {
    expect(deriveNetworkStatus(false, true).isOffline).toBe(true);
  });

  it('uses reachability only while the native link state is unknown', () => {
    expect(deriveNetworkStatus(null, false).isOffline).toBe(true);
    expect(deriveNetworkStatus(null, true).isOffline).toBe(false);
    expect(deriveNetworkStatus(null, null).isNetworkStatusKnown).toBe(false);
  });
});

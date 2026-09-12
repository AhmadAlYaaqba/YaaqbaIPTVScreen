/* eslint-env jest */

import reducer, {
  clearUserCredentials,
  setUserCredentials,
} from '../src/store/slices/userSlice';

describe('user session state', () => {
  it('clears the active playlist id on logout', () => {
    const signedIn = reducer(
      undefined,
      setUserCredentials({
        playlistId: 'playlist-a',
        username: 'user',
        password: 'pass',
      }),
    );

    expect(signedIn.playlistId).toBe('playlist-a');
    expect(reducer(signedIn, clearUserCredentials()).playlistId).toBeNull();
  });
});

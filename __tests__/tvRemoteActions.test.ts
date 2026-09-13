import { toRemoteAction } from '../src/tv/remoteActions';

describe('toRemoteAction', () => {
  it('maps key-down events to actions', () => {
    expect(toRemoteAction({ eventType: 'select', eventKeyAction: 0 })).toBe(
      'select',
    );
    expect(toRemoteAction({ eventType: 'playPause', eventKeyAction: 0 })).toBe(
      'playPause',
    );
    expect(
      toRemoteAction({ eventType: 'channelDown', eventKeyAction: 0 }),
    ).toBe('channelDown');
  });

  it('ignores key-up so a press fires once', () => {
    expect(toRemoteAction({ eventType: 'select', eventKeyAction: 1 })).toBeNull();
    expect(toRemoteAction({ eventType: 'left', eventKeyAction: 1 })).toBeNull();
  });

  it('accepts events without a key phase', () => {
    expect(toRemoteAction({ eventType: 'right' })).toBe('right');
    expect(toRemoteAction({ eventType: 'menu', eventKeyAction: -1 })).toBe(
      'menu',
    );
  });

  it('ignores focus, blur, pan and unknown events', () => {
    expect(toRemoteAction({ eventType: 'focus', eventKeyAction: -1 })).toBeNull();
    expect(toRemoteAction({ eventType: 'blur' })).toBeNull();
    expect(toRemoteAction({ eventType: 'pan' })).toBeNull();
    expect(toRemoteAction({ eventType: 'longSelect', eventKeyAction: 0 })).toBeNull();
    expect(toRemoteAction({ eventType: 'select', eventKeyAction: 7 })).toBeNull();
  });
});

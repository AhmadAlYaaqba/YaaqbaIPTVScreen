import { toRemoteAction } from '../src/tv/remoteActions';

describe('toRemoteAction', () => {
  it('maps key-up events to actions (what Android TV delivers to JS)', () => {
    expect(toRemoteAction({ eventType: 'up', eventKeyAction: 1 })).toBe('up');
    expect(toRemoteAction({ eventType: 'select', eventKeyAction: 1 })).toBe(
      'select',
    );
    expect(toRemoteAction({ eventType: 'playPause', eventKeyAction: 1 })).toBe(
      'playPause',
    );
    expect(
      toRemoteAction({ eventType: 'channelDown', eventKeyAction: 1 }),
    ).toBe('channelDown');
  });

  it('ignores key-down so a press never fires twice', () => {
    expect(toRemoteAction({ eventType: 'select', eventKeyAction: 0 })).toBeNull();
    expect(toRemoteAction({ eventType: 'left', eventKeyAction: 0 })).toBeNull();
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
    expect(toRemoteAction({ eventType: 'longSelect', eventKeyAction: 1 })).toBeNull();
    expect(toRemoteAction({ eventType: 'select', eventKeyAction: 7 })).toBeNull();
  });
});

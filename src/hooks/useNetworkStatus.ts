import { useNetInfo } from '@react-native-community/netinfo';

export function deriveNetworkStatus(
  isConnected: boolean | null | undefined,
  isInternetReachable: boolean | null | undefined,
) {
  // A positive link state is authoritative for playback. Reachability probes
  // can briefly fail (or be blocked by a provider) while the IPTV origin is
  // still reachable, so they must not pause a stream that is actively playing.
  const isOffline =
    isConnected === false ||
    (isConnected == null && isInternetReachable === false);

  return {
    isOffline,
    isNetworkStatusKnown: isConnected != null || isInternetReachable != null,
  };
}

export function useNetworkStatus() {
  const { isConnected, isInternetReachable } = useNetInfo();
  return deriveNetworkStatus(isConnected, isInternetReachable);
}

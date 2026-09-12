import { useNetInfo } from '@react-native-community/netinfo';

export function useNetworkStatus() {
  const { isConnected, isInternetReachable } = useNetInfo();
  const isOffline =
    isConnected === false || isInternetReachable === false;

  return {
    isOffline,
    isNetworkStatusKnown:
      isConnected !== null || isInternetReachable !== null,
  };
}

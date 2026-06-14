import * as Keychain from 'react-native-keychain';

const TMDB_API_KEY_SERVICE = 'tmdb-api-key';
const TMDB_API_KEY_USERNAME = 'tmdb-api-key';

let cachedApiKey: string | null | undefined;
let pendingApiKeyRead: Promise<string | null> | null = null;

function normalizeApiKey(apiKey: string | null | undefined): string | null {
  const trimmed = apiKey?.trim();
  return trimmed ? trimmed : null;
}

export async function getStoredTmdbApiKey(): Promise<string | null> {
  if (cachedApiKey !== undefined) {
    return cachedApiKey;
  }

  if (pendingApiKeyRead) {
    return pendingApiKeyRead;
  }

  pendingApiKeyRead = Keychain.getGenericPassword({
    service: TMDB_API_KEY_SERVICE,
  })
    .then(credentials => normalizeApiKey(credentials ? credentials.password : null))
    .catch(error => {
      if (__DEV__) console.error('Error loading TMDB API key:', error);
      return null;
    })
    .finally(() => {
      pendingApiKeyRead = null;
    });

  cachedApiKey = await pendingApiKeyRead;
  return cachedApiKey;
}

export async function saveStoredTmdbApiKey(apiKey: string): Promise<string | null> {
  const normalized = normalizeApiKey(apiKey);

  if (!normalized) {
    await clearStoredTmdbApiKey();
    return null;
  }

  await Keychain.setGenericPassword(TMDB_API_KEY_USERNAME, normalized, {
    service: TMDB_API_KEY_SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });

  cachedApiKey = normalized;
  return cachedApiKey;
}

export async function clearStoredTmdbApiKey(): Promise<void> {
  await Keychain.resetGenericPassword({ service: TMDB_API_KEY_SERVICE });
  cachedApiKey = null;
}

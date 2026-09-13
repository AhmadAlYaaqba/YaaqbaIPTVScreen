const URL_PATTERN = /\b(?:https?|rtsp):\/\/[^\s"'<>]+/gi;
const CREDENTIAL_PATH_PATTERN =
  /\/(live|movie|series)\/[^/\s]+\/[^/\s]+(?=\/)/gi;
const QUERY_SECRET_PATTERN =
  /([?&](?:username|password|token|auth)=)[^&\s]+/gi;
const MAX_DIAGNOSTIC_MESSAGE_LENGTH = 240;

function extractPlaybackErrorMessage(error: any): string {
  if (typeof error === 'string') {
    return error;
  }
  return (
    error?.error?.errorString ||
    error?.error?.message ||
    error?.message ||
    'Playback error occurred'
  );
}

function extractPlaybackErrorCode(error: any): string | undefined {
  const rawCode =
    error?.error?.errorCode ??
    error?.error?.code ??
    error?.code ??
    error?.status;
  if (typeof rawCode !== 'string' && typeof rawCode !== 'number') {
    return undefined;
  }
  const code = String(rawCode);
  return /^[a-z0-9._:-]{1,64}$/i.test(code) ? code : undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function sanitizePlaybackText(
  value: unknown,
  secrets: readonly string[] = [],
): string {
  let sanitized = String(value || 'Playback error occurred')
    .replace(URL_PATTERN, '[redacted-url]')
    .replace(CREDENTIAL_PATH_PATTERN, '/$1/[redacted]/[redacted]')
    .replace(QUERY_SECRET_PATTERN, '$1[redacted]');

  secrets
    .filter(Boolean)
    .flatMap(secret => [secret, encodeURIComponent(secret)])
    .forEach(secret => {
      sanitized = sanitized.replace(
        new RegExp(escapeRegExp(secret), 'g'),
        '[redacted]',
      );
    });

  return sanitized.slice(0, MAX_DIAGNOSTIC_MESSAGE_LENGTH);
}

export function getSanitizedPlaybackError(
  error: unknown,
  secrets: readonly string[] = [],
): { message: string; code?: string } {
  return {
    message: sanitizePlaybackText(extractPlaybackErrorMessage(error), secrets),
    code: extractPlaybackErrorCode(error),
  };
}

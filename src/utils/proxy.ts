const PROXY_HOST = 'https://v0-next-js-proxy-api.vercel.app';
export const PROXY_API_BASE = `${PROXY_HOST}/api/proxy`;
export const PROXY_STREAM_BASE = `${PROXY_HOST}/api/stream`;

export function proxyApiUrl(originalUrl: string, useProxy: boolean): string {
  if (!useProxy) return originalUrl;
  return `${PROXY_API_BASE}?url=${encodeURIComponent(originalUrl)}`;
}

export function proxyStreamUrl(
  originalUrl: string,
  useProxy: boolean,
): string {
  if (!useProxy) return originalUrl;
  return `${PROXY_STREAM_BASE}?url=${encodeURIComponent(originalUrl)}`;
}

export function unwrapProxyUrl(url: string): string {
  const streamPrefix = `${PROXY_STREAM_BASE}?url=`;
  const apiPrefix = `${PROXY_API_BASE}?url=`;
  if (url.startsWith(streamPrefix))
    return decodeURIComponent(url.substring(streamPrefix.length));
  if (url.startsWith(apiPrefix))
    return decodeURIComponent(url.substring(apiPrefix.length));
  return url;
}

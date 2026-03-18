const DEFAULT_PROTOCOL = 'http:';
const ABSOLUTE_URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;

type BaseArgs = {
  domain: string;
  port?: string;
};

type CredentialsArgs = BaseArgs & {
  username: string;
  password: string;
};

type PlayerApiArgs = CredentialsArgs & {
  action: string;
  extraParams?: Record<string, string | number | undefined | null>;
};

type StreamArgs = CredentialsArgs & {
  streamId: string | number;
  extension?: string;
};

type BaseUrlParts = {
  origin: string;
  basePath: string;
};

function normalizePort(port?: string) {
  return `${port ?? ''}`.trim().replace(/^:/, '');
}

function applyPort(host: string, port?: string) {
  const normalizedPort = normalizePort(port);

  if (!normalizedPort) {
    return host;
  }

  if (host.startsWith('[')) {
    const bracketIndex = host.indexOf(']');
    if (bracketIndex !== -1) {
      return `${host.slice(0, bracketIndex + 1)}:${normalizedPort}`;
    }
  }

  return `${host.replace(/:\d+$/, '')}:${normalizedPort}`;
}

function createBaseUrlParts({ domain, port }: BaseArgs): BaseUrlParts {
  const normalizedDomain = domain.trim().replace(/\/+$/, '');

  if (ABSOLUTE_URL_PATTERN.test(normalizedDomain)) {
    const match = normalizedDomain.match(
      /^([a-z][a-z0-9+.-]*:\/\/)([^/]+)(\/.*)?$/i,
    );

    if (match) {
      return {
        origin: `${match[1]}${applyPort(match[2], port)}`,
        basePath: match[3] ?? '',
      };
    }
  }

  const firstSlashIndex = normalizedDomain.indexOf('/');
  const host =
    firstSlashIndex === -1
      ? normalizedDomain
      : normalizedDomain.slice(0, firstSlashIndex);
  const basePath =
    firstSlashIndex === -1 ? '' : normalizedDomain.slice(firstSlashIndex);

  return {
    origin: `${DEFAULT_PROTOCOL}//${applyPort(host, port)}`,
    basePath,
  };
}

function createQueryString(
  params: Record<string, string | number | undefined | null>,
) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  return searchParams.toString();
}

function normalizeExtension(extension: string | undefined, fallback: string) {
  const normalized = `${extension ?? fallback}`.trim().replace(/^\./, '');
  return normalized || fallback;
}

function encodeSegment(value: string | number) {
  return encodeURIComponent(String(value).trim());
}

function joinPath(basePath: string, nextPath: string) {
  const trimmedBase = basePath.replace(/\/+$/, '');
  const trimmedNext = nextPath.replace(/^\/+/, '');

  if (!trimmedBase || trimmedBase === '') {
    return `/${trimmedNext}`;
  }

  if (trimmedBase === '/') {
    return `/${trimmedNext}`;
  }

  return `${trimmedBase}/${trimmedNext}`;
}

export function buildPlayerApiUrl({
  domain,
  port,
  username,
  password,
  action,
  extraParams,
}: PlayerApiArgs): string {
  const {origin, basePath} = createBaseUrlParts({ domain, port });
  const pathname = joinPath(basePath, 'player_api.php');
  const query = createQueryString({
    username,
    password,
    action,
    ...extraParams,
  });
  return `${origin}${pathname}?${query}`;
}

export function buildLiveStreamUrl({
  domain,
  port,
  username,
  password,
  streamId,
  extension = 'm3u8',
}: StreamArgs): string {
  const {origin, basePath} = createBaseUrlParts({ domain, port });
  const pathname = joinPath(
    basePath,
    `live/${encodeSegment(username)}/${encodeSegment(password)}/${encodeSegment(streamId)}.${normalizeExtension(extension, 'm3u8')}`,
  );
  return `${origin}${pathname}`;
}

export function buildMovieStreamUrl({
  domain,
  port,
  username,
  password,
  streamId,
  extension = 'mp4',
}: StreamArgs): string {
  const {origin, basePath} = createBaseUrlParts({ domain, port });
  const pathname = joinPath(
    basePath,
    `movie/${encodeSegment(username)}/${encodeSegment(password)}/${encodeSegment(streamId)}.${normalizeExtension(extension, 'mp4')}`,
  );
  return `${origin}${pathname}`;
}

export function buildSeriesStreamUrl({
  domain,
  port,
  username,
  password,
  streamId,
  extension = 'mp4',
}: StreamArgs): string {
  const {origin, basePath} = createBaseUrlParts({ domain, port });
  const pathname = joinPath(
    basePath,
    `series/${encodeSegment(username)}/${encodeSegment(password)}/${encodeSegment(streamId)}.${normalizeExtension(extension, 'mp4')}`,
  );
  return `${origin}${pathname}`;
}

export const XTREAM_REQUEST_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Encoding': 'identity',
  Connection: 'close',
  'User-Agent': 'okhttp/4.3.1',
};

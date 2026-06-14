export interface NormalizedTitle {
  query: string;
  year?: number;
}

const YEAR_PATTERN = /\b(19|20)\d{2}\b/g;
const YEAR_IN_PARENS = /\((19|20)\d{2}\)/g;

const STRIP_PATTERNS: RegExp[] = [
  /\b(720p|1080p|2160p|4k|uhd|hd|sd)\b/gi,
  /\b(bluray|blu-ray|web-?rip|webdl|web-dl|hdrip|dvdrip|cam|hdcam|ts|telesync)\b/gi,
  /\b(x264|x265|hevc|h\.?264|h\.?265|av1|10bit)\b/gi,
  /\b(hdr|dv|dolby\s*vision)\b/gi,
  /\b(aac|ac3|dts|ddp?5\.1|atmos)\b/gi,
  /\[[^\]]*\]/g,
  /\{[^}]*\}/g,
  /^\s*(en|ar|fr|de|es|it|pt|ru|tr|fa|ku)\s*[-|:|]\s*/i,
];

function extractYear(text: string): number | undefined {
  const parenMatch = text.match(/\((19|20)\d{2}\)/);
  if (parenMatch) {
    const year = parseInt(parenMatch[0].replace(/[()]/g, ''), 10);
    if (year >= 1900 && year <= 2099) {
      return year;
    }
  }

  const matches = text.match(YEAR_PATTERN);
  if (matches?.length) {
    const year = parseInt(matches[0], 10);
    if (year >= 1900 && year <= 2099) {
      return year;
    }
  }

  return undefined;
}

function stripReleaseGroup(text: string): string {
  const dashParts = text.split(/\s+-\s+/);
  if (dashParts.length > 1) {
    const last = dashParts[dashParts.length - 1].trim();
    if (
      last.length <= 20 &&
      /^[A-Za-z0-9._-]+$/.test(last) &&
      !/\s/.test(last)
    ) {
      return dashParts.slice(0, -1).join(' - ').trim();
    }
  }
  return text;
}

function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[._]/g, ' ')
    .replace(/[^\w\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strips common IPTV release tags and produces a clean TMDB search string.
 */
export function normalizeTitle(raw: string): NormalizedTitle {
  if (!raw?.trim()) {
    return { query: '' };
  }

  const year = extractYear(raw);
  let text = raw.trim();

  text = text.replace(YEAR_IN_PARENS, ' ');
  text = text.replace(YEAR_PATTERN, ' ');

  for (const pattern of STRIP_PATTERNS) {
    text = text.replace(pattern, ' ');
  }

  text = stripReleaseGroup(text);
  text = text.replace(/[._]/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();

  return {
    query: text,
    year,
  };
}

export function titlesMatch(a: string, b: string): boolean {
  const na = normalizeForCompare(a);
  const nb = normalizeForCompare(b);
  if (!na || !nb) {
    return false;
  }
  return na === nb;
}

export function extractYearFromDate(date?: string | null): number | undefined {
  if (!date) {
    return undefined;
  }
  const match = date.match(/^(19|20)\d{2}/);
  return match ? parseInt(match[0], 10) : undefined;
}

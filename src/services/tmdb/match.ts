import {
  extractYearFromDate,
  titlesMatch,
} from '../../utils/titleNormalize';

export interface TmdbSearchResult {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  popularity?: number;
}

function getResultTitle(result: TmdbSearchResult): string {
  return (
    result.title ||
    result.name ||
    result.original_title ||
    result.original_name ||
    ''
  );
}

function getResultYear(result: TmdbSearchResult): number | undefined {
  return extractYearFromDate(result.release_date || result.first_air_date);
}

/**
 * Matching priority:
 * 1. Exact title + year
 * 2. Exact title
 * 3. Closest TMDB result (highest popularity)
 */
export function pickBestMatch<T extends TmdbSearchResult>(
  results: T[],
  query: string,
  year?: number,
): T | null {
  if (!results.length || !query.trim()) {
    return null;
  }

  const withYear = year
    ? results.filter(result => getResultYear(result) === year)
    : [];

  if (withYear.length) {
    const exactYearTitle = withYear.find(result =>
      titlesMatch(getResultTitle(result), query),
    );
    if (exactYearTitle) {
      return exactYearTitle;
    }
    return withYear.sort(
      (a, b) => (b.popularity ?? 0) - (a.popularity ?? 0),
    )[0];
  }

  const exactTitle = results.find(result =>
    titlesMatch(getResultTitle(result), query),
  );
  if (exactTitle) {
    return exactTitle;
  }

  return [...results].sort(
    (a, b) => (b.popularity ?? 0) - (a.popularity ?? 0),
  )[0];
}

function parseRating(value: unknown): number | null {
  const parsed = parseFloat(String(value ?? ''));
  return !Number.isNaN(parsed) && parsed > 0 ? parsed : null;
}

export function getTenPointRating(
  rating?: unknown,
  rating5Based?: unknown,
): number | null {
  const tenPoint = parseRating(rating);
  if (tenPoint != null) {
    return Math.min(10, tenPoint);
  }

  const fivePoint = parseRating(rating5Based);
  if (fivePoint == null) {
    return null;
  }

  return Math.min(10, fivePoint * 2);
}

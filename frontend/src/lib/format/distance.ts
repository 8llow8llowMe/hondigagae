const EMPTY = '-'

/**
 * 거리를 표기한다. 1km 미만은 m, 이상은 소수 1자리 km.
 * 화면에 단위를 드러낸다 — docs/coding-conventions.md §7.
 */
export function formatDistance(meters: number | null | undefined): string {
  if (typeof meters !== 'number' || !Number.isFinite(meters) || meters < 0) return EMPTY

  if (meters < 1000) return `${Math.round(meters)}m`

  const km = meters / 1000
  return `${km.toFixed(1)}km`
}

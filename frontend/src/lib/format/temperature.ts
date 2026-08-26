const EMPTY = '-'

/** 기온을 ℃ 단위로 표기한다 */
export function formatTemperature(celsius: number | null | undefined): string {
  if (typeof celsius !== 'number' || !Number.isFinite(celsius)) return EMPTY
  return `${Math.round(celsius)}℃`
}

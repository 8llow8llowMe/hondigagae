const EMPTY = '-'

/** 소요 시간을 분/시간 단위로 표기한다 */
export function formatDuration(minutes: number | null | undefined): string {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes < 0) return EMPTY

  const total = Math.round(minutes)
  if (total < 60) return `${total}분`

  const hours = Math.floor(total / 60)
  const rest = total % 60

  return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`
}

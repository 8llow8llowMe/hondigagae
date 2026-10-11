/**
 * 기다릴 시간 · 남은 시간 표기 (#1309). 순수 함수다.
 *
 * 둘을 가른다 — **기다릴 시간**("n초 뒤 다시 시도")은 대략이면 되고, 길면(IP 상한 `AUTH_016` 은 최대
 * 약 1시간) 초로 쓰는 순간 "3540초" 처럼 읽을 수 없게 된다. **남은 시간**("4분 59초 뒤 만료")은 짧고
 * 눈앞에서 줄어드는 값이라 초까지 쓴다.
 */

/** 기다릴 시간. 1분 미만은 `n초`, 이상은 `m분`(올림 — 덜 기다리게 말하지 않는다) */
export function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds}초`
  return `${Math.ceil(seconds / 60)}분`
}

/** 남은 시간. `4분 59초` · `5분` · `59초` */
export function formatRemaining(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  if (minutes === 0) return `${rest}초`
  return rest === 0 ? `${minutes}분` : `${minutes}분 ${rest}초`
}

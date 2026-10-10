const EMPTY = '-'

/**
 * 거리를 표기한다. 1km 미만은 m, 이상은 km.
 * 화면에 단위를 드러낸다 — docs/coding-conventions.md §7.
 *
 * **정수 km 는 소수점을 뗀다** (#905 R8). `10.0km` · `20.0km` 처럼 의미 없는 `.0` 이
 * 반경·거리 요약 줄에 그대로 남아 있었다 — 소수가 있는 값(`1.3km`, `8.1km`)은 그대로
 * 소수 1자리를 유지한다.
 *
 * **먼저 소수 1자리로 반올림하고 그 값으로 판정한다.** 원값으로 `Number.isInteger` 를
 * 보면 `1001m` 가 `1.0km`, `1000m` 가 `1km` 로 갈려 같은 열에 두 표기가 섞인다 — 실측
 * 거리는 1000 의 배수인 일이 거의 없어 `.0` 이 거의 그대로 남았다.
 */
export function formatDistance(meters: number | null | undefined): string {
  if (typeof meters !== 'number' || !Number.isFinite(meters) || meters < 0) return EMPTY

  if (meters < 1000) return `${Math.round(meters)}m`

  const km = Number((meters / 1000).toFixed(1))
  return `${km}km`
}

/**
 * 산책 코스 거리 — **입력이 m 가 아니라 km 다** (#618).
 *
 * `formatDistance` 와 합치지 않는 이유가 그것이다. 백엔드가 `distanceKm` 을 `BigDecimal`
 * 로 갖고 JSON number 로 내리므로(`15.1` · `4.2` · `19.0`), 저 함수에 넣으면 `15.1` 이
 * `15m` 가 된다.
 *
 * **소수 1자리를 고정한다.** 실측에 `19.0` 이 있고 `19km` 로 줄이면 같은 열의 `19.1` 과
 * 자릿수가 어긋난다 (공통명세 S3).
 */
export function formatCourseDistance(km: number | null | undefined): string {
  if (typeof km !== 'number' || !Number.isFinite(km) || km < 0) return EMPTY

  return `${km.toFixed(1)}km`
}

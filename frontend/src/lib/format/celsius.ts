/**
 * 섭씨 값을 표시 문자열로 — **열로 늘어선 값**에 쓴다. **소수점 1자리를 유지한다.**
 *
 * `35` 와 `35.0` 이 섞이면 목록에서 자릿수가 흔들려 값을 비교할 수 없다
 * (DESIGN.md §3-3 — `tabular-nums` 와 같은 이유다). 골든타임 시간대 표
 * (`walk-times-curve.tsx`)가 그 자리다 — 칸마다 `31.5` 가 섞여 있어 `.0` 만 떼면 칸마다
 * 자릿수가 달라진다.
 *
 * **혼자 서는 값에는 `formatStandaloneCelsius` 를 쓴다** (#1067). 비교할 이웃이 없는 큰 숫자에
 * 남은 `33.0` 의 `.0` 은 자릿수를 맞춰 주지 않고 읽기만 방해한다.
 *
 * **단위를 붙이지 않는다.** 값과 단위를 분리해야 호출부가 단위만 작고 흐리게 그릴 수 있다
 * (DESIGN.md §3-3). `MetricValue` 의 `value` / `unit` 이 그 쌍이다.
 *
 * `null` 을 그대로 돌려준다 — **호출부가 줄을 숨긴다.** 여기서 "—" 로 채우면
 * 값이 없는 것과 0도인 것을 구분할 수 없다.
 */
export function formatCelsius(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null

  return value.toFixed(1)
}

/**
 * 섭씨 값을 표시 문자열로 — **혼자 서는 값**에 쓴다 (#1067). **정수면 소수점을 뗀다.**
 *
 * `33.0` → `33`, `27.5` → `27.5`. 소수가 의미 있는 값은 1자리를 그대로 둔다.
 *
 * **어디가 "혼자 서는" 자리인가.** 같은 축의 값이 칸·행으로 늘어서 자릿수를 맞대 비교하지
 * **않는** 자리다 — 판정 hero(장소 상세 체감온도 · 노면온도, 일정 일자 판정), 요약 한 줄
 * (장소 상세 `지금 산책` · 홈 판정), 일정 항목 캡션. 값이 열로 늘어서면 `formatCelsius` 다
 * (DESIGN.md §3-3).
 *
 * **먼저 1자리로 반올림하고 그 값으로 판정한다.** 원값으로 `Number.isInteger` 를 보면
 * `35.96` 이 `36.0` 으로 남는다 — 거리의 `formatDistance` 가 같은 이유로 같은 순서를 쓴다
 * (#905 R8). `Number(...)` 로 되돌리는 김에 `-0.0` 도 `0` 이 된다.
 *
 * `Math.round` 를 쓰는 `formatTemperature`(`lib/format/temperature.ts`)와 다르다 — 그쪽은
 * 정수로 **잘라** `27.5` 를 `28℃` 로 만들고 단위까지 붙인다. 여기는 값을 잃지 않고
 * 단위도 붙이지 않는다(`formatCelsius` 와 같은 계약).
 */
export function formatStandaloneCelsius(value: number | null | undefined): string | null {
  const fixed = formatCelsius(value)
  if (fixed === null) return null

  return String(Number(fixed))
}

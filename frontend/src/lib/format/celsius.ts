/**
 * 섭씨 값을 표시 문자열로. **소수점 1자리를 유지한다.**
 *
 * `35` 와 `35.0` 이 섞이면 목록에서 자릿수가 흔들려 값을 비교할 수 없다
 * (DESIGN.md §3-3 — `tabular-nums` 와 같은 이유다).
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

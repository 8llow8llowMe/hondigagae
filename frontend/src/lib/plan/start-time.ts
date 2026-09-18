/**
 * 항목 시작 시각 정규화 — 순수 함수 하나가 형식 흡수를 전담한다.
 *
 * 근거: `일정상세-세부명세.md` D14-3 · D14-8 미결 1.
 *
 * **`LocalTime` 직렬화가 `HH:mm` 인지 `HH:mm:ss` 인지 실호출로 확정하지 못했다.**
 * 백엔드 스키마 스냅샷(`docs/api/openapi/plan-service.json`, 2026-09-14)은 두 스키마의
 * `startTime` 에 `example: "10:30:00"` 을 주면서도 `format` 을 비워 뒀고, dev 게이트웨이는
 * `/v3/api-docs` 가 빈 스펙(`paths: {}`)만 돌려줘 실호출로 대조하지 못했다(이 이슈에서
 * 확인). Jackson 기본 `LocalTimeSerializer` 는 초가 0이어도 `HH:mm:ss` 로 쓰는 것이
 * 통상적이지만, `application/*.yml` 에 직렬화 포맷을 고정하는 설정이 없어 **초 단위가
 * 생략된 `"10:30"` 이 내려올 여지를 배제할 수 없다.**
 *
 * 그래서 이 함수는 앞 두 자리 시:분만 정규식으로 읽고 나머지(초·소수초)는 버린다 —
 * **두 모양을 모두 받아들이는 비용이 정규식 하나다.** 형식이 확정되면 `#67` 대조
 * 이슈에서 이 정규식을 좁힌다.
 */

/**
 * `HH:mm` 두 자리 시(00~23) · 두 자리 분(00~59) 만 허용한다.
 *
 * **`slice(0, 5)` 를 쓰지 않는다.** 모양이 어긋난 값(`"오전 10시"` · `""` · `"1:30"`)을
 * 조용히 잘라 없는 시각을 지어내는 대신, 형식에 맞지 않으면 `null` 을 돌려준다.
 */
const START_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)/

/**
 * 서버 원문 → 화면에 그릴 `HH:mm`. 24시간제, 초는 버린다.
 *
 * @param value `PlanItemDetail.startTime` — nullable
 * @returns 정규화된 `HH:mm`. 값이 없거나 형식이 어긋나면 `null` — 그 경우 호출부는
 *   시각 줄 자체를 그리지 않는다 (D14-3). 에러도 배지도 내지 않는다.
 */
export function formatStartTime(value: string | null): string | null {
  if (value === null) return null

  const match = START_TIME_PATTERN.exec(value)
  if (match === null) return null

  return `${match[1]}:${match[2]}`
}

/**
 * 서버 원문 → 편집 입력 초기값.
 *
 * `<input type="time">` 은 빈 문자열로 "값 없음" 을 표현하므로 `formatStartTime` 의
 * `null` 을 `''` 로 옮긴다 (일자편집-세부명세 G3).
 */
export function toInputStartTime(value: string | null): string {
  return formatStartTime(value) ?? ''
}

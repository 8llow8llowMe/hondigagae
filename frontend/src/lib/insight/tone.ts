import type { MetricTone } from '@/components/metric'

/**
 * 등급 code → 톤 매핑. **축마다 따로 둔다.**
 *
 * 홈-세부명세 D5-2 는 `HIGH`/`MEDIUM`/`LOW`/`UNKNOWN` 4단 하나로 적었지만, 백엔드 실측 결과
 * **세 축의 코드 체계가 서로 다르고 의미도 뒤집힌다.**
 *
 * | 축          | 코드                                   |
 * | ----------- | -------------------------------------- |
 * | 적합도      | `HIGH` `MEDIUM` `LOW` `INSUFFICIENT`   |
 * | 산책 위험도 | `SAFE` `CAUTION` `DANGER` `UNKNOWN`    |
 * | 혼잡도      | `LOW`(한산) `MODERATE` `HIGH`(혼잡) `UNKNOWN` |
 *
 * 공용 매퍼 하나를 쓰면 **"혼잡" 이 초록으로, "안전" 이 회색으로** 나간다.
 * 혼잡도의 `LOW` 는 좋은 것이고 적합도의 `LOW` 는 나쁜 것이다 — 같은 문자열이 반대를 뜻한다.
 *
 * 컴포넌트가 code 를 해석하지 않고 **호출부가 톤을 계산해 넘긴다** (홈-세부명세 D2-1).
 */

/** 여행 적합도 — shared-travel `SuitabilityLevel` */
export function suitabilityTone(code: string | null | undefined): MetricTone {
  switch (code) {
    case 'HIGH':
      return 'high'
    case 'MEDIUM':
      return 'mid'
    case 'LOW':
      return 'low'
    // INSUFFICIENT 는 "나쁨" 이 아니라 "모름" 이다. low 로 떨어뜨리지 않는다.
    default:
      return 'unknown'
  }
}

/**
 * 산책 위험도 — shared-travel `WalkSafetyLevel`.
 *
 * **`DANGER` 가 `--metric-critical-*` 을 쓰는 유일한 축이다.** 적합도가 낮은 것은 오류가
 * 아니지만(그래서 `low`), 산책 위험은 실제로 다치는 일이다.
 */
export function walkSafetyTone(code: string | null | undefined): MetricTone {
  switch (code) {
    case 'SAFE':
      return 'high'
    case 'CAUTION':
      return 'mid'
    case 'DANGER':
      return 'critical'
    default:
      return 'unknown'
  }
}

/**
 * 혼잡도 — tour-service `CongestionLevel`.
 *
 * **적합도와 뒤집혀 있다.** `LOW`(한산)가 좋은 쪽이다.
 * 혼잡을 `critical` 로 올리지 않는다 — 붐비는 것은 위험이 아니라 조건이다.
 */
export function congestionTone(code: string | null | undefined): MetricTone {
  switch (code) {
    case 'LOW':
      return 'high'
    case 'MODERATE':
      return 'mid'
    case 'HIGH':
      return 'low'
    default:
      return 'unknown'
  }
}

/**
 * 기상특보 단계 — shared-travel `WeatherWarningLevel`.
 *
 * **모르는 코드는 경보로 읽는다.** 백엔드 `WeatherWarningLevel.from` 이 "경보" 를 먼저 보고
 * 못 알아봤을 때 낮은 쪽으로 접지 않는 것과 같은 이유다 — 표기가 바뀌었을 뿐인데 태풍경보를
 * 주의보 색으로 그리면 그 화면이 위험을 축소해 말한다.
 *
 * **주의보에 `low`(회색)를 쓰지 않는다.** 그 톤은 "적합도 낮음 · 정보 없음" 쪽으로 읽혀
 * "조건이 나빠지고 있다" 는 뜻이 사라진다. `mid`(앰버)가 주의에 맞는 색이다.
 *
 * **`weather-warning-badge.tsx` 에서 이리로 옮겼다** (#709). 배지 혼자 쓰던 것을 스트립이
 * 함께 쓰게 되면서다 — 축별 code→톤 매퍼는 이 파일이 소유한다는 규칙이 원래 그렇다
 * (`token-usage.test.ts` 의 `OWNERS`).
 */
export function weatherWarningTone(levelCode: string | null | undefined): MetricTone {
  return levelCode === 'ADVISORY' ? 'mid' : 'critical'
}

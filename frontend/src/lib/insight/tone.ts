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

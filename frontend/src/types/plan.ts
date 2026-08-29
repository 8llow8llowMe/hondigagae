import type { CodeNameMetadata } from '@/types/api'
import type { ScoreMetricMetadata } from '@/types/insight'

/**
 * 여행 일정 — **홈이 쓰는 범위만** 담는다.
 * 일정 상세 화면을 만들 때 이 파일을 확장한다.
 *
 * 근거: backend plan-service `PlanWebController` / `PlanSummaryItem` /
 * `PlanWeatherResponse` **소스 실측**.
 *
 * **명세(공통명세 S3)와 다른 점**: 날씨 응답의 제목은 `title` 이 아니라 **`planTitle`**,
 * 일자별 배열은 `dailyBriefings` 가 아니라 **`days`** 다.
 */

/** `GET /plans` — `SliceResponse<PlanSummaryItem>` 로 온다 */
export type PlanSummaryItem = {
  planId: string
  petId: string
  areaCode: string
  title: string
  startDate: string
  endDate: string
  /** `DRAFT`(초안) / `CONFIRMED`(확정) 등. **등급 색을 쓰지 않는다** (DESIGN.md §2-3) */
  status: CodeNameMetadata
}

export type PlanWeatherReasonItem = {
  code: string
  name: string
  description: string
}

export type PlanAlternativePlaceItem = {
  placeId: string
  title: string
}

/**
 * 일자별 브리핑. **일정 일수만큼 항상 채워진다** — 배열 길이로 성공/실패를 판단하지 않는다.
 * 그날 브리핑을 못 낸 이유는 `unavailableReason` 에 문장으로 온다.
 */
export type PlanDayWeatherItem = {
  /** 1부터 */
  day: number
  date: string
  representativePlaceId: string | null
  representativePlaceTitle: string | null
  score: number | null
  suitabilityLevel: ScoreMetricMetadata | null
  reasons: PlanWeatherReasonItem[]
  weather: PlanDailyWeatherItem | null
  indoorAlternatives: PlanAlternativePlaceItem[]
  /** null 이면 정상. 값이 있으면 **화면에 그대로 안내한다** */
  unavailableReason: string | null
}

/** 일자별 날씨 요약. 일정 브리핑 전용이라 인사이트의 `DailyWeatherItem` 과 다르다 */
export type PlanDailyWeatherItem = {
  date: string
  minTemperature: number | null
  maxTemperature: number | null
  maxPrecipitationProbability: number | null
  skyState: CodeNameMetadata | null
  precipitationType: CodeNameMetadata | null
}

/** `GET /plans/{planId}/weather` */
export type PlanWeatherResponse = {
  planId: string
  planTitle: string
  startDate: string
  endDate: string
  /** false 면 특성 조회에 실패해 일반 조건으로 판정한 결과다 */
  petConditionApplied: boolean
  days: PlanDayWeatherItem[]
}

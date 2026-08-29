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

// ─── 목록 · 생성 (#75) ────────────────────────────────────────────────────────

/**
 * 일정 상태. 근거: backend `PlanStatus` (plan-service `domain/enums`).
 *
 * **서버가 이 셋 밖의 코드를 내려도 화면이 깨지지 않아야 한다** — 배지는 `status.name`
 * 을 그대로 쓰고 톤만 초안과 같이 그린다 (공통명세 S7).
 */
export const PLAN_STATUS_CODES = ['DRAFT', 'CONFIRMED', 'COMPLETED'] as const
export type PlanStatusCode = (typeof PLAN_STATUS_CODES)[number]

/** 상태 필터 축. `ALL` 은 서버 코드가 아니라 화면이 만든 값이다 */
export const PLAN_STATUS_FILTERS = ['ALL', ...PLAN_STATUS_CODES] as const
export type PlanStatusFilter = (typeof PLAN_STATUS_FILTERS)[number]

/**
 * 목록 좁히기. **URL `searchParams` 에 싣는다** (architecture-guide.md §10 — URL 이 기본).
 *
 * 장소 필터와 성격이 다르다는 점이 중요하다. 저쪽은 **서버 조회 파라미터**라 필터가
 * 바뀌면 query key 가 갈리고 재조회가 일어난다. 이쪽은 서버 파라미터가 아예 없어
 * **같은 조회 결과를 화면에서 거를 뿐이라 query key 에 넣지 않는다** (공통명세 S3).
 * 필터를 바꿔도 재조회가 없다.
 *
 * 그래도 URL 에 두는 이유는 새로고침·뒤로가기·만들기 후 복귀에서 보고 있던 조건이
 * 살아 있어야 하기 때문이다.
 */
export type PlanFilters = {
  status: PlanStatusFilter
  /** 비어 있으면 전체. 다중 축이다 */
  petIds: string[]
}

export const DEFAULT_PLAN_FILTERS: PlanFilters = { status: 'ALL', petIds: [] }

/**
 * `POST /plans` 요청 본문.
 *
 * **`petId` 만 서버가 `Long` 으로 읽는다.** 응답의 `petId`/`planId` 는 문자열인데
 * 생성 요청의 `petId` 는 `Long` 이다 — Snowflake 라 `Number()` 로 바꾸면 정밀도를
 * 잃는다. 문자열 그대로 실어 보내고 Jackson 이 `Long` 으로 읽게 한다 (공통명세 S1).
 *
 * `items` 는 보내지 않는다 — 빈 일정을 만들고 장소는 일자 편집 화면에서 담는다.
 */
export type PlanCreatePayload = {
  petId: string
  areaCode: string
  title: string
  startDate: string
  endDate: string
  /** 생략 가능. 0 이상 */
  budget?: number
}

/** `POST /plans` · `GET /plans/{planId}` 응답. 목록보다 필드가 많다 */
export type PlanDetail = {
  planId: string
  petId: string
  areaCode: string
  sigunguCode: string | null
  title: string
  startDate: string
  endDate: string
  budget: number | null
  status: CodeNameMetadata
  totalDays: number
  items: PlanItemDetail[]
}

/** 일정 항목. `targetId` 는 이동 항목처럼 대상이 없으면 null 이다 */
export type PlanItemDetail = {
  planItemId: string
  /** 1부터 */
  day: number
  sequence: number
  itemType: CodeNameMetadata
  targetId: string | null
  title: string
  memo: string | null
  /** `HH:mm:ss` */
  startTime: string | null
}

/**
 * 만들기 폼 값. **요청 본문이 아니다** — `budget` 이 폼에서는 문자열(`''` 허용)이고
 * 전송 직전에 숫자 또는 생략으로 바뀐다 (`src/lib/plan/form.ts`).
 *
 * `areaCode` 는 폼에 없다. 제주 전용이라 선택지가 하나뿐인 필드를 두지 않는다
 * (공통명세 S9).
 */
export type PlanFormValues = {
  petId: string
  title: string
  startDate: string
  endDate: string
  budget: string
}

export const EMPTY_PLAN_FORM_VALUES: PlanFormValues = {
  petId: '',
  title: '',
  startDate: '',
  endDate: '',
  budget: '',
}

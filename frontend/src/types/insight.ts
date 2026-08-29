import type { CodeNameMetadata } from '@/types/api'

/**
 * 장소 인사이트 (적합도 · 산책 위험도).
 *
 * 근거: backend tour-service `insight` 컨텍스트 **소스 실측** — `PlaceInsightWebController` /
 * `PlaceSuitabilityResponse` / `WalkSafetyResponse` 및 shared-travel 의 등급 enum.
 * 게이트웨이 기동 후 `/fe-api-check` 로 재대조한다.
 *
 * **명세(`docs/features/home/공통명세.md` S3)와 다른 점이 세 가지 있다** — 명세는 Swagger 를
 * 부르지 못한 상태로 작성됐다. 실측이 정본이다.
 *  1. 실내 대안 필드명은 `alternativePlaces` 가 아니라 **`indoorAlternatives`** 다.
 *  2. 적합도 등급에 **`INSUFFICIENT`** 가 있다 (명세의 4단 표에 없다).
 *  3. 산책 위험도 등급은 `HIGH/MEDIUM/LOW` 가 아니라 **`SAFE/CAUTION/DANGER/UNKNOWN`** 이다.
 */

/**
 * 점수 지표 metadata. `EnumMetadata` 와 **일부러 분리한다** (공통명세 S3-1).
 * `scoreDescription` 이 이 타입에만 있고, 앞으로 더 붙을 수 있다.
 */
export type ScoreMetricMetadata = {
  code: string
  name: string
  description: string | null
  /** 점수를 어떻게 읽어야 하는지에 대한 설명 */
  scoreDescription: string | null
}

/**
 * 적합도 등급 코드 — shared-travel `SuitabilityLevel`.
 *
 * **`INSUFFICIENT` 은 "나쁨" 이 아니라 "모름" 이다.** 예보가 닿지 않는 날짜이거나 날씨를
 * 가져오지 못하면 점수를 만들지 않는다. 0점으로 렌더하면 "여기는 별로다" 로 읽힌다.
 */
export const SUITABILITY_LEVEL_CODES = ['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT'] as const

/**
 * 산책 위험도 등급 코드 — shared-travel `WalkSafetyLevel`.
 * 적합도와 **코드 체계가 다르다.** 하나로 합치면 둘 중 하나가 희석된다.
 */
export const WALK_SAFETY_LEVEL_CODES = ['SAFE', 'CAUTION', 'DANGER', 'UNKNOWN'] as const

/**
 * 혼잡도 등급 코드 — tour-service `CongestionLevel`.
 *
 * **의미가 적합도와 반대다.** 여기서 `LOW` 는 "한산"(좋음)이고 `HIGH` 는 "혼잡"(나쁨)이다.
 * 그래서 톤 매핑을 축마다 따로 둔다 (`src/lib/insight/tone.ts`).
 */
export const CONGESTION_LEVEL_CODES = ['LOW', 'MODERATE', 'HIGH', 'UNKNOWN'] as const

/** 적합도 판정 근거. `scoreDelta` 가 음수면 감점, `0` 이면 정보성이다 */
export type SuitabilityReasonItem = {
  code: string
  name: string
  /** 데이터 근거를 담은 완성 문장. FE 가 조립하지 않는다 */
  description: string
  /** **화면에 숫자로 노출하지 않는다** — 산식이 공개되지 않았다 (홈-세부명세 D8-2) */
  scoreDelta: number
}

/** 산책 위험도 판정 근거. **적합도와 달리 `scoreDelta` 가 없다** */
export type WalkSafetyReasonItem = {
  code: string
  name: string
  description: string
}

export type DailyWeatherItem = {
  date: string
  /** `MID_TERM` 이면 오전/오후 단위라 습도·바람이 없다 */
  forecastSource: CodeNameMetadata
  minTemperature: number | null
  maxTemperature: number | null
  maxPrecipitationProbability: number | null
  precipitationType: CodeNameMetadata | null
  skyState: CodeNameMetadata | null
  /** 중기예보에는 없어 null 이다 */
  maxWindSpeed: number | null
  /** 중기예보에는 없어 null 이다 */
  maxHumidity: number | null
  totalPrecipitationMm: number
}

export type CongestionItem = {
  level: CodeNameMetadata
  /**
   * 관광지 집중률(0~100). 등급이 `UNKNOWN` 이면 null 이다.
   * **null 은 "한산" 이 아니라 "데이터 없음" 이다.**
   */
  concentrationRate: number | null
}

/** 실내 대안 장소. 장소명 필드가 `title` 이다 (`placeTitle` 이 아니다) */
export type AlternativePlaceItem = {
  placeId: string
  title: string
  lat: number
  lng: number
  distanceMeters: number
  petAllowanceType: CodeNameMetadata
  allowedPetSize: CodeNameMetadata
}

/** `GET /places/{placeId}/suitability` */
export type PlaceSuitabilityResponse = {
  placeId: string
  placeTitle: string
  targetDate: string
  /** **null 은 0점이 아니라 "점수를 내지 않았다" 는 뜻이다.** 등급이 `INSUFFICIENT` 로 온다 */
  score: number | null
  suitabilityLevel: ScoreMetricMetadata
  /** 점수 영향이 큰 순서다. **재정렬하지 않는다** */
  reasons: SuitabilityReasonItem[]
  /** 예보 범위 밖이면 null → 섹션을 숨긴다 */
  weather: DailyWeatherItem | null
  congestion: CongestionItem | null
  /** 비 예보일 때만 채워진다. 아니면 빈 배열 → 섹션을 숨긴다 */
  indoorAlternatives: AlternativePlaceItem[]
  petConditionApplied: boolean
  weatherApplied: boolean
  /** false 면 그 장소에 연결된 혼잡도 예측 데이터가 없다 */
  congestionApplied: boolean
  weatherProviderName: string | null
}

/** `GET /places/{placeId}/walk-safety` */
export type WalkSafetyResponse = {
  placeId: string
  placeTitle: string
  /** 적합도는 **일자**(`targetDate`), 이쪽은 **시각** 기준이다 (공통명세 S3-2) */
  targetDateTime: string
  walkSafetyLevel: ScoreMetricMetadata
  reasons: WalkSafetyReasonItem[]
  /** 실측이 아니라 추정치다. 단정하는 문구를 붙이지 않는다 */
  estimatedPavementCelsius: number | null
  heatIndexCelsius: number | null
  /** 같은 날 안에 안전 구간이 없으면 null → 줄을 숨긴다 */
  saferWindowStart: string | null
  saferWindowEnd: string | null
  temperature: number | null
  humidity: number | null
  skyState: CodeNameMetadata | null
  precipitationType: CodeNameMetadata | null
  petConditionApplied: boolean
  weatherProviderName: string | null
}

/**
 * 판정에 반영할 반려견 조건.
 *
 * **`petId` 를 보내는 것이 아니다.** 백엔드가 속성을 개별 쿼리 파라미터로 받는다
 * (`PlaceInsightWebController`). 공개 API 라 서버가 반려견을 조회할 수 없기 때문이다.
 */
export type PetCondition = {
  petSizeType: string | null
  heatSensitive: boolean
  coldSensitive: boolean
  noiseSensitive: boolean
  activityLevel: string | null
  breed: string | null
}

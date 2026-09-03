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

/**
 * 발효 중인 기상특보 (#158).
 *
 * **없으면 `null` 이다.** 여러 특보가 동시에 떠 있으면 서버가 **가장 무거운 것 하나만** 담는다 —
 * 판정이 그것으로 이뤄지고, 목록을 통째로 내리면 화면이 무엇을 강조할지 알 수 없다.
 *
 * **지역 단위다.** 같은 시각이면 제주의 모든 장소에 같은 특보가 뜬다. 장소별로 다를 것이라고
 * 가정하는 화면을 만들면 안 된다.
 */
export type WeatherWarningItem = {
  /**
   * 특보 종류. `TYPHOON`·`HEAVY_RAIN`·`STRONG_WIND`·`HEAT_WAVE`·`COLD_WAVE`·`HEAVY_SNOW`·
   * `TROPICAL_NIGHT`·`WIND_WAVE`·`DRY`, 그리고 못 알아본 문구는 `OTHER`("기타 특보") 다.
   *
   * **`OTHER` 를 감추지 않는다.** 원천이 코드가 아니라 문구로 주기 때문에 표기가 조금만
   * 바뀌어도 `OTHER` 가 된다 — 그때 배지를 숨기면 태풍이 떠 있는데 없다고 말하게 된다.
   */
  type: CodeNameMetadata
  /**
   * `ADVISORY`(주의보) · `WARNING`(경보) 둘뿐이다.
   *
   * **경보는 감점이 아니라 점수 0 이다** — 기상청이 위험을 경고한 단계라, 다른 조건이
   * 아무리 좋아도 점수가 남지 않는다 (`SuitabilityEvaluator`). 산책은 `DANGER` 로 끊긴다.
   */
  level: CodeNameMetadata
  /** 발효 시각. 원천이 주지 않으면 null */
  effectiveAt: string | null
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
  /** 발효 중인 기상특보 (#158). 없으면 null */
  weatherWarning: WeatherWarningItem | null
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
  /** 발효 중인 기상특보 (#158). 없으면 null */
  weatherWarning: WeatherWarningItem | null
}

/**
 * 한 시각의 산책 안전 등급 (#158).
 *
 * **등급만으로 색 막대를 그리면 "왜 그 색인지" 를 말하지 못한다.** 서버가 기온과 추정
 * 노면온도를 함께 주는 이유가 그것이고, 화면도 색 옆에 숫자를 둔다 (DESIGN.md §2-3 —
 * 색만으로 정보를 전달하지 않는다).
 */
export type HourlyWalkSafetyItem = {
  /** 예보 시각. `2026-09-02T15:00:00` */
  at: string
  walkSafetyLevel: ScoreMetricMetadata
  temperature: number
  /**
   * **추정치다.** 기온에 일사와 시간대를 더해 계산한 값이고 실측이 아니다 —
   * 단정하는 문구를 붙이지 않는다 (장소 상세의 `estimatedPavementCelsius` 와 같은 규칙).
   */
  estimatedPavementCelsius: number
  /** 원천에 없는 시각은 null */
  precipitationProbability: number | null
}

/**
 * `GET /insights/walk-times` — 오늘의 산책 골든타임 (#158).
 *
 * **장소 산책 위험도와 답하는 질문이 다르다.** 저쪽은 "지금 나가도 되나"(`targetDateTime`
 * 한 시점)이고 이쪽은 "오늘 언제 나가야 하나"다. 판정 규칙은 같다.
 *
 * **`goldenStart` 가 null 인 날이 정상 응답이다.** 남은 시간이 전부 위험 등급이거나 특보
 * 경보가 발효 중이면 서버가 추천을 내지 않는다 — 아무 구간이나 골라 주면 사용자가 그것을
 * **허락으로 읽기** 때문이다. 화면도 같은 태도를 지켜 대체 구간을 지어내지 않는다.
 */
export type WalkTimesResponse = {
  /** 기준 시각. 이 시각 이후만 담긴다 */
  from: string
  /** 오늘 남은 예보 시각만. **비어 있을 수 있다** (늦은 밤) */
  hourly: HourlyWalkSafetyItem[]
  /** 추천할 구간이 없으면 null. `goldenEnd`·`goldenLevel` 과 항상 함께 움직인다 */
  goldenStart: string | null
  goldenEnd: string | null
  goldenLevel: ScoreMetricMetadata | null
  /** 경보면 골든타임을 주지 않는다 */
  weatherWarning: WeatherWarningItem | null
  petConditionApplied: boolean
}

/**
 * 한 권역의 날씨와 점수 (#158).
 *
 * **예보를 못 받은 권역도 목록에 남는다.** 그때 `weatherScore` 가 null 이고 `reasons` 에
 * 그 사실이 담긴다 — 목록에서 지우면 사용자는 그 권역이 조회되지 않았다는 것조차 모른 채
 * "비교 대상이 넷" 이라고 읽는다. **0 점이 아니라 판단 근거가 없는 것이다.**
 */
export type RegionWeatherItem = {
  /** `NORTH`(제주시권) · `SOUTH`(서귀포권) · `EAST`(동부권) · `WEST`(서부권) · `HALLA`(한라산권) */
  region: CodeNameMetadata
  /**
   * 날씨만으로 매긴 점수(0~100). null 이면 예보를 못 받아 판정하지 않았다.
   *
   * **장소 적합도 점수가 아니다.** 같은 날씨 규칙을 쓰지만 장소·혼잡도 항목이 없어
   * "이 권역이 나가기 좋은가" 이지 "이 장소가 갈 만한가" 가 아니다.
   */
  weatherScore: number | null
  /** 예보가 없으면 null */
  skyState: CodeNameMetadata | null
  precipitationType: CodeNameMetadata | null
  maxPrecipitationProbability: number | null
  minTemperature: number | null
  maxTemperature: number | null
  /** 중기예보 기반 날짜는 null */
  maxWindSpeed: number | null
  /** 판정 근거. 데이터 사실만 담는다 */
  reasons: SuitabilityReasonItem[]
}

/**
 * `GET /insights/regional-weather` — 제주 권역 날씨 비교 (#158).
 *
 * **한라산이 섬을 기후로 갈라 놓는다는 것이 이 기능의 전제다.** 같은 시각에 북부는 비가 오고
 * 남부는 개어 있는 일이 흔해, "제주 날씨" 를 한 값으로 말하면 그 차이가 통째로 사라진다.
 *
 * **`recommendedRegion` 이 null 인 경우가 둘이다.** ① 어느 권역도 예보를 못 받았다
 * ② **특보 경보가 발효 중이다** — 적합도는 0점, 산책은 위험이라고 말하는 같은 서비스가
 * 여기서만 "여기 가세요" 라고 하면 안 된다. 그때도 **비교표는 그대로 보여 준다**(여전히 정보다).
 */
export type RegionalWeatherResponse = {
  date: string
  /** 다섯 권역. 예보를 못 받은 권역도 점수 없이 남는다 */
  regions: RegionWeatherItem[]
  /** 판정할 수 있는 권역이 없으면 null */
  recommendedRegion: CodeNameMetadata | null
  /** 추천 이유. 그 권역의 판정 근거를 그대로 옮긴 **문장 배열**이다 (객체가 아니다) */
  recommendationReasons: string[]
  weatherWarning: WeatherWarningItem | null
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

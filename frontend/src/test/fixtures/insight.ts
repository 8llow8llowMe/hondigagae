import type { CodeNameMetadata } from '@/types/api'
import type {
  PlaceCongestionResponse,
  PlaceSuitabilityResponse,
  WalkSafetyResponse,
} from '@/types/insight'
import type { PlanSummaryItem } from '@/types/plan'

/**
 * 인사이트 fixture.
 *
 * **Swagger `@Schema(example = ...)` 값을 그대로 쓴다.** 문장을 창작하지 않는다
 * (홈-세부명세 D7). 실제 응답과 다른 문장으로 테스트하면 길이·줄바꿈 문제를 못 잡는다.
 *
 * 근거: backend tour-service `PlaceSuitabilityResponse` / `WalkSafetyResponse` /
 * `SuitabilityReasonItem` / `WalkSafetyReasonItem` 의 example.
 */
export const walkSafety: WalkSafetyResponse = {
  placeId: '212481712381923328',
  placeTitle: '협재해수욕장',
  targetDateTime: '2026-08-27T14:00:00',
  walkSafetyLevel: {
    code: 'DANGER',
    name: '위험',
    description: '이 시간대 야외 산책은 피하는 편이 좋습니다.',
    scoreDescription: '발바닥 화상이나 열 스트레스 위험이 큰 조건입니다.',
  },
  reasons: [
    {
      code: 'PAVEMENT_HEAT',
      name: '노면 고온',
      description:
        '기온 31도에 일사가 더해져 아스팔트 표면은 약 58도로 추정됩니다. 발바닥 화상 위험 구간입니다.',
    },
    {
      // #292 — BE `WalkSafetyReasonCode` 가 `HEAT_INDEX_HIGH` 를 이 코드로 교체했다
      code: 'FEELS_LIKE_HIGH',
      name: '체감온도 높음',
      description: '기상청 여름철 체감온도 기준으로 더위 부담이 큰 조건입니다.',
    },
    {
      code: 'HEAT_SENSITIVE',
      name: '더위 민감',
      description: '더위에 약한 아이라 같은 기온에도 부담이 큽니다.',
    },
    {
      code: 'SAFE_WINDOW',
      name: '안전 시간대',
      description: '같은 날 안에 더 안전한 산책 시간대가 있습니다.',
    },
  ],
  estimatedPavementCelsius: 58.0,
  /*
    **기온 31℃ · 습도 78% 를 두 산식에 실제로 넣은 값이다** (#292 · BE `46f35e4`).
    판정값은 기상청 체감온도 `33.0`, 참고 열지수는 NOAA `40.2` — **열지수가 7℃ 높다.**
    두 숫자가 다르지 않으면 "화면이 어느 필드를 읽는지" 를 테스트가 가릴 수 없다.

    근거 문장 둘은 서버 상수(`WalkSafetyPresenter.FEELS_LIKE_BASIS`/`HEAT_INDEX_BASIS`)를
    그대로 옮겼다 — 문장을 창작하지 않는다 (홈-세부명세 D7).
  */
  feelsLikeCelsius: 33.0,
  feelsLikeBasis:
    '기상청 여름철 체감온도 산식으로 계산했습니다. 판정 시각의 기온과 상대습도로 습구온도(Stull, 2011 근사식)를 구해 산출하며, 폭염특보 기준(주의보 33℃·경보 35℃)과 같은 척도입니다. 습도가 없는 시각은 기온을 그대로 씁니다.',
  heatIndexCelsius: 40.2,
  heatIndexBasis:
    '미국 NOAA 열지수(Rothfusz 회귀식 섭씨판)로 계산한 참고값입니다. 판정에는 쓰지 않으며, 고온다습에서 기상청 체감온도보다 높게 나오는 별도 지표입니다.',
  saferWindowStart: '18:00:00',
  saferWindowEnd: '21:00:00',
  temperature: 31.0,
  humidity: 78,
  skyState: { code: 'CLEAR', name: '맑음', description: '구름이 거의 없습니다.' },
  precipitationType: { code: 'NONE', name: '없음', description: '강수가 없습니다.' },
  petConditionApplied: true,
  weatherProviderName: '기상청 단기예보',
  // 기본은 특보 없음이다 — 흔한 경우를 기본값으로 둔다. 배지 테스트는 개별로 얹는다
  weatherWarning: null,
}

export const suitability: PlaceSuitabilityResponse = {
  placeId: '212481712381923328',
  placeTitle: '천지연폭포',
  targetDate: '2026-08-27',
  score: 82,
  suitabilityLevel: {
    code: 'HIGH',
    name: '여행 적합',
    description: '반려견과 방문하기 좋은 조건입니다.',
    scoreDescription: '점수가 높을수록 날씨/동반 조건이 반려견에게 유리합니다.',
  },
  reasons: [
    {
      code: 'HEAT_RISK',
      name: '고온 주의',
      description: '최고기온 31도 로, 더위에 약한 아이에게는 부담이 큽니다.',
      scoreDelta: -27,
    },
    {
      code: 'CONGESTION_UNKNOWN',
      name: '혼잡도 정보 없음',
      description: '이 장소에 연결된 혼잡도 예측 데이터가 없습니다.',
      scoreDelta: 0,
    },
  ],
  weather: {
    date: '2026-08-27',
    forecastSource: {
      code: 'SHORT_TERM',
      name: '단기예보',
      description: '오늘부터 약 5일까지의 시간 단위 예보입니다. 가장 정확합니다.',
    },
    minTemperature: 24.0,
    maxTemperature: 31.0,
    maxFeelsLikeTemperature: 33.4,
    maxPrecipitationProbability: 80,
    precipitationType: { code: 'RAIN', name: '비', description: '비가 예보되었습니다.' },
    skyState: { code: 'OVERCAST', name: '흐림', description: '하늘이 구름으로 덮인 상태입니다.' },
    maxWindSpeed: 4.2,
    maxHumidity: 85,
    totalPrecipitationMm: 12.5,
  },
  congestion: {
    level: {
      code: 'UNKNOWN',
      name: '정보 없음',
      description: '이 장소에 연결된 혼잡도 예측 데이터가 없습니다.',
    },
    concentrationRate: null,
  },
  indoorAlternatives: [],
  petConditionApplied: true,
  weatherApplied: true,
  congestionApplied: false,
  weatherProviderName: '기상청 단기예보',
  weatherWarning: null,
}

/** 점수를 내지 못한 경우 — **0점이 아니라 "모름" 이다** */
export const suitabilityInsufficient: PlaceSuitabilityResponse = {
  ...suitability,
  score: null,
  suitabilityLevel: {
    code: 'INSUFFICIENT',
    name: '판단 근거 부족',
    description: '점수를 낼 만한 데이터가 없습니다.',
    scoreDescription: '예보 범위 밖이거나 날씨 정보를 가져오지 못해 점수를 내지 않았습니다.',
  },
  weather: null,
  reasons: [
    {
      code: 'FORECAST_OUT_OF_RANGE',
      name: '예보 범위 밖',
      description: '예보가 닿지 않는 날짜라 점수를 내지 않았습니다.',
      scoreDelta: 0,
    },
  ],
}

/** 비 예보 → 실내 대안이 채워진다 */
export const suitabilityWithIndoor: PlaceSuitabilityResponse = {
  ...suitability,
  indoorAlternatives: [
    {
      placeId: '212481712381923329',
      title: '제주현대미술관',
      lat: 33.3608276172,
      lng: 126.7818122232,
      distanceMeters: 2340,
      petAllowanceType: {
        code: 'PARTIALLY_ALLOWED',
        name: '부분 동반 가능',
        description: '일부 구역 또는 조건부로 반려동물 동반이 가능한 장소입니다.',
      },
      allowedPetSize: { code: 'SMALL', name: '소형견', description: '소형견만 동반 가능합니다.' },
    },
  ],
}

/** `CongestionLevel` 의 `displayName` / `description` 그대로 — 문구를 창작하지 않는다 */
const CONGESTION_LOW: CodeNameMetadata = {
  code: 'LOW',
  name: '한산',
  description: '관광객 집중도가 낮아 여유로울 것으로 예상됩니다.',
}

const CONGESTION_MODERATE: CodeNameMetadata = {
  code: 'MODERATE',
  name: '보통',
  description: '관광객 집중도가 평소 수준입니다.',
}

const CONGESTION_HIGH: CodeNameMetadata = {
  code: 'HIGH',
  name: '혼잡',
  description: '관광객 집중도가 높아 붐빌 것으로 예상됩니다.',
}

/** **`UNKNOWN` 은 "한산" 이 아니라 "모름" 이다.** 집중률이 `null` 인 유일한 등급이다 */
const CONGESTION_UNKNOWN: CodeNameMetadata = {
  code: 'UNKNOWN',
  name: '정보 없음',
  description: '이 장소에 연결된 혼잡도 예측 데이터가 없습니다.',
}

/**
 * 기간 혼잡도 (#430). 날짜·집중률은 Swagger `@Schema(example)`(`2026-09-01`~`2026-09-07`,
 * `37.2`)의 기간을 그대로 쓰고, 등급 문구는 `CongestionLevel` 의 `displayName` /
 * `description` 이다.
 *
 * **중간(`2026-09-04`)을 `UNKNOWN` 으로 둔다.** 데이터 없는 날짜가 목록에서 빠지지 않는
 * 것이 이 계약의 핵심이고, 끝이 아니라 가운데에 둬야 "구멍" 이 화면에서 보인다.
 *
 * `leastCrowded` 는 **서버가 고른 값**이다 — `UNKNOWN` 을 제외한 최저(`21.4`). 테스트가
 * 이 값을 다시 계산하지 않는다.
 */
export const congestion: PlaceCongestionResponse = {
  placeId: '212481712381923328',
  fromDate: '2026-09-01',
  toDate: '2026-09-07',
  dailyCongestions: [
    { date: '2026-09-01', level: CONGESTION_HIGH, concentrationRate: 71.8 },
    { date: '2026-09-02', level: CONGESTION_MODERATE, concentrationRate: 37.2 },
    { date: '2026-09-03', level: CONGESTION_LOW, concentrationRate: 28.6 },
    { date: '2026-09-04', level: CONGESTION_UNKNOWN, concentrationRate: null },
    { date: '2026-09-05', level: CONGESTION_LOW, concentrationRate: 21.4 },
    { date: '2026-09-06', level: CONGESTION_MODERATE, concentrationRate: 44.9 },
    { date: '2026-09-07', level: CONGESTION_HIGH, concentrationRate: 68.3 },
  ],
  leastCrowded: { date: '2026-09-05', level: CONGESTION_LOW, concentrationRate: 21.4 },
}

/**
 * 아는 날이 하나도 없는 장소 — **`leastCrowded` 가 `null` 인 갈래**.
 *
 * 이 장소에 연결된 관광지 통계가 없다는 뜻이지 한산하다는 뜻이 아니다. 화면이 그 둘을
 * 섞으면 "가장 덜 붐비는 날" 자리가 비어 "한산한 날이 없다" 로 읽힌다.
 */
export const congestionAllUnknown: PlaceCongestionResponse = {
  placeId: '212481712381923329',
  fromDate: '2026-09-01',
  toDate: '2026-09-07',
  dailyCongestions: congestion.dailyCongestions.map((item) => ({
    date: item.date,
    level: CONGESTION_UNKNOWN,
    concentrationRate: null,
  })),
  leastCrowded: null,
}

export const upcomingPlan: PlanSummaryItem = {
  planId: '1234567890123456789',
  petId: '1234567890123456789',
  petIds: ['1234567890123456789'],
  areaCode: '39',
  title: '몽실이와 제주 2박 3일',
  startDate: '2026-09-12',
  endDate: '2026-09-14',
  status: {
    code: 'DRAFT',
    name: '초안',
    description: 'AI 또는 사용자가 작성 중인 일정입니다.',
  },
}

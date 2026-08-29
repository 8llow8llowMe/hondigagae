import type { PlaceSuitabilityResponse, WalkSafetyResponse } from '@/types/insight'
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
      code: 'HEAT_INDEX_HIGH',
      name: '열지수 높음',
      description: '기온과 습도를 함께 보면 체감 부담이 큽니다.',
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
  heatIndexCelsius: 35.0,
  saferWindowStart: '18:00:00',
  saferWindowEnd: '21:00:00',
  temperature: 31.0,
  humidity: 78,
  skyState: { code: 'CLEAR', name: '맑음', description: '구름이 거의 없습니다.' },
  precipitationType: { code: 'NONE', name: '없음', description: '강수가 없습니다.' },
  petConditionApplied: true,
  weatherProviderName: '기상청 단기예보',
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
    maxPrecipitationProbability: 80,
    precipitationType: { code: 'RAIN', name: '비', description: '비가 예보되었습니다.' },
    skyState: { code: 'CLOUDY', name: '흐림', description: '구름이 많습니다.' },
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

export const upcomingPlan: PlanSummaryItem = {
  planId: '1234567890123456789',
  petId: '1234567890123456789',
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

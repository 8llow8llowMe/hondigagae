import { MOCK_PLACES } from '@/lib/api/mock/place-data'
import type {
  CongestionItem,
  PlaceSuitabilityResponse,
  ScoreMetricMetadata,
  WalkSafetyResponse,
  WeatherWarningItem,
} from '@/types/insight'

/**
 * 개발용 인사이트 데이터.
 *
 * **없는 API 를 상상해서 만드는 것이 아니다.** 계약 근거는 tour-service `insight` 컨텍스트의
 * `PlaceInsightWebController` / `PlaceSuitabilityResponse` / `WalkSafetyResponse` 와
 * shared-travel 의 `SuitabilityLevel` / `WalkSafetyLevel` / `CongestionLevel` 실측이다.
 *
 * 문구는 백엔드 enum 의 `displayName` / `description` 을 **그대로** 쓴다. 창작하지 않는다.
 *
 * 데이터를 만들 때 지킨 것:
 *  - `placeId` 로 결과를 갈라 **매번 같은 값**이 나오게 한다 (판정이 새로고침마다 바뀌면 못 믿는다)
 *  - `score: null` + `INSUFFICIENT` 인 장소를 하나 둔다 — 0점과 구분되는지 화면에서 봐야 한다
 *  - 혼잡도 `UNKNOWN` 을 기본으로 둔다 — 실제로 명칭 매칭 실패가 흔하다
 *  - 비 예보 장소에 `indoorAlternatives` 를 채운다
 */

const SUITABILITY_LEVELS: Record<string, ScoreMetricMetadata> = {
  HIGH: {
    code: 'HIGH',
    name: '여행 적합',
    description: '반려견과 방문하기 좋은 조건입니다.',
    scoreDescription: '점수가 높을수록 날씨/동반 조건이 반려견에게 유리합니다.',
  },
  MEDIUM: {
    code: 'MEDIUM',
    name: '보통',
    description: '일부 조건을 확인하고 가면 무난합니다.',
    scoreDescription: '점수가 중간이면 주의할 조건이 한둘 있다는 뜻입니다.',
  },
  LOW: {
    code: 'LOW',
    name: '주의 필요',
    description: '반려견과 방문하기에 불리한 조건이 있습니다.',
    scoreDescription: '점수가 낮을수록 피하거나 시간대를 옮기는 편이 좋습니다.',
  },
  INSUFFICIENT: {
    code: 'INSUFFICIENT',
    name: '판단 근거 부족',
    description: '점수를 낼 만한 데이터가 없습니다.',
    scoreDescription: '예보 범위 밖이거나 날씨 정보를 가져오지 못해 점수를 내지 않았습니다.',
  },
}

const WALK_LEVELS: Record<string, ScoreMetricMetadata> = {
  SAFE: {
    code: 'SAFE',
    name: '안전',
    description: '산책하기에 무리가 없는 조건입니다.',
    scoreDescription: '위험 요인이 확인되지 않았습니다.',
  },
  CAUTION: {
    code: 'CAUTION',
    name: '주의',
    description: '짧게 걷고 물과 그늘을 챙기는 편이 좋습니다.',
    scoreDescription: '위험 요인이 하나 이상 확인되었습니다.',
  },
  DANGER: {
    code: 'DANGER',
    name: '위험',
    description: '이 시간대 야외 산책은 피하는 편이 좋습니다.',
    scoreDescription: '발바닥 화상이나 열 스트레스 위험이 큰 조건입니다.',
  },
}

const CONGESTION_UNKNOWN: CongestionItem = {
  level: {
    code: 'UNKNOWN',
    name: '정보 없음',
    description: '이 장소에 연결된 혼잡도 예측 데이터가 없습니다.',
  },
  concentrationRate: null,
}

const CONGESTION_HIGH: CongestionItem = {
  level: {
    code: 'HIGH',
    name: '혼잡',
    description: '관광객 집중도가 높아 붐빌 것으로 예상됩니다.',
  },
  concentrationRate: 72.4,
}

/** placeId 끝자리로 결과를 고정한다 — 새로고침마다 판정이 바뀌면 사용자가 못 믿는다 */
/**
 * 기상특보 (#158). 문구는 `WeatherWarningType` · `WeatherWarningLevel` 의
 * `displayName` / `description` 을 **그대로** 쓴다.
 *
 * **실제로는 지역 단위다** — 같은 시각이면 제주의 모든 장소에 같은 특보가 뜬다. mock 이
 * 갈래마다 다르게 주는 것은 주의보·경보·없음 세 경우를 함께 보기 위한 것이고,
 * **화면은 이 차이에 기대면 안 된다.**
 */
const HEAT_WAVE_ADVISORY: WeatherWarningItem = {
  type: {
    code: 'HEAT_WAVE',
    name: '폭염',
    description: '더위가 심합니다. 노면이 뜨거워 발바닥 화상 위험이 큽니다.',
  },
  level: {
    code: 'ADVISORY',
    name: '주의보',
    description: '기상 조건이 나빠지고 있습니다. 일정을 조정하는 편이 좋습니다.',
  },
  effectiveAt: '2026-08-29T06:00:00',
}

const HEAT_WAVE_WARNING: WeatherWarningItem = {
  type: HEAT_WAVE_ADVISORY.type,
  level: {
    code: 'WARNING',
    name: '경보',
    description: '기상청이 위험을 경고한 단계입니다. 야외 일정은 취소하는 것이 좋습니다.',
  },
  effectiveAt: '2026-08-29T11:00:00',
}

function bucketOf(placeId: string): number {
  const last = placeId.at(-1) ?? '0'
  return Number.parseInt(last, 10) % 3
}

function titleOf(placeId: string): string {
  return MOCK_PLACES.find((place) => place.placeId === placeId)?.title ?? '제주 장소'
}

export function mockSuitability(placeId: string): PlaceSuitabilityResponse {
  const bucket = bucketOf(placeId)
  const base = {
    placeId,
    placeTitle: titleOf(placeId),
    targetDate: '2026-08-29',
    petConditionApplied: true,
    weatherProviderName: '기상청 단기예보',
  }

  // 점수를 못 내는 경우. **0점이 아니다**
  if (bucket === 2) {
    return {
      ...base,
      score: null,
      suitabilityLevel: SUITABILITY_LEVELS.INSUFFICIENT as ScoreMetricMetadata,
      reasons: [
        {
          code: 'FORECAST_OUT_OF_RANGE',
          name: '예보 범위 밖',
          description: '예보가 닿지 않는 날짜라 점수를 내지 않았습니다.',
          scoreDelta: 0,
        },
      ],
      weather: null,
      congestion: CONGESTION_UNKNOWN,
      indoorAlternatives: [],
      weatherApplied: false,
      congestionApplied: false,
      weatherWarning: null,
    }
  }

  const high = bucket === 0

  return {
    ...base,
    score: high ? 82 : 61,
    suitabilityLevel: (high
      ? SUITABILITY_LEVELS.HIGH
      : SUITABILITY_LEVELS.MEDIUM) as ScoreMetricMetadata,
    reasons: high
      ? [
          {
            code: 'PET_ALLOWED',
            name: '반려견 동반 가능',
            description: '반려견과 함께 입장할 수 있는 장소입니다.',
            scoreDelta: 0,
          },
          {
            code: 'HEAT_RISK',
            name: '고온 주의',
            description: '최고기온 31도 로, 더위에 약한 아이에게는 부담이 큽니다.',
            scoreDelta: -12,
          },
        ]
      : [
          /*
            **특보 근거가 맨 앞이다.** 서버는 `reasons` 를 점수 영향이 큰 순서로 보내고
            주의보 감점이 다른 항목보다 크다 (`SuitabilityEvaluator.PENALTY_WARNING_ADVISORY`).
            문장 형식도 서버와 같다 — "{종류} {단계} 발효 중입니다. {종류 설명}".
          */
          {
            code: 'WEATHER_WARNING_ACTIVE',
            name: '기상특보 발효',
            description:
              '폭염 주의보 발효 중입니다. 더위가 심합니다. 노면이 뜨거워 발바닥 화상 위험이 큽니다.',
            scoreDelta: -30,
          },
          {
            code: 'HEAT_RISK',
            name: '고온 주의',
            description: '최고기온 31도 로, 더위에 약한 아이에게는 부담이 큽니다.',
            scoreDelta: -27,
          },
          {
            code: 'RAIN_EXPECTED',
            name: '강수 예보',
            description: '강수확률 80% 로, 야외 동선은 젖을 수 있습니다.',
            scoreDelta: -9,
          },
          {
            code: 'CONGESTION_UNKNOWN',
            name: '혼잡도 정보 없음',
            description: '이 장소에 연결된 혼잡도 예측 데이터가 없습니다.',
            scoreDelta: 0,
          },
        ],
    weather: {
      date: '2026-08-29',
      forecastSource: {
        code: 'SHORT_TERM',
        name: '단기예보',
        description: '오늘부터 약 5일까지의 시간 단위 예보입니다. 가장 정확합니다.',
      },
      minTemperature: 24.0,
      maxTemperature: 31.0,
      maxPrecipitationProbability: high ? 10 : 80,
      precipitationType: high
        ? { code: 'NONE', name: '없음', description: '강수가 없습니다.' }
        : { code: 'RAIN', name: '비', description: '비가 예보되었습니다.' },
      skyState: { code: 'CLOUDY', name: '흐림', description: '구름이 많습니다.' },
      maxWindSpeed: 4.2,
      maxHumidity: 85,
      totalPrecipitationMm: high ? 0 : 12.5,
    },
    congestion: high ? CONGESTION_HIGH : CONGESTION_UNKNOWN,
    // 특보가 없는 갈래(high)와 있는 갈래를 함께 둔다 — 배지 유무를 로컬에서 둘 다 본다
    weatherWarning: high ? null : HEAT_WAVE_ADVISORY,
    // 비 예보일 때만 채워진다
    indoorAlternatives: high
      ? []
      : [
          {
            placeId: '212481712381923330',
            title: '제주현대미술관',
            lat: 33.3608276172,
            lng: 126.7818122232,
            distanceMeters: 2340,
            petAllowanceType: {
              code: 'PARTIALLY_ALLOWED',
              name: '부분 동반 가능',
              description: '일부 구역 또는 조건부로 반려동물 동반이 가능한 장소입니다.',
            },
            allowedPetSize: {
              code: 'SMALL',
              name: '소형견',
              description: '소형견만 동반 가능합니다.',
            },
          },
        ],
    weatherApplied: true,
    congestionApplied: high,
  }
}

export function mockWalkSafety(placeId: string, heatSensitive: boolean): WalkSafetyResponse {
  // 더위에 민감한 아이면 같은 조건에서 한 단계 위험해진다 — 조건이 실제로 반영되는지 보이게 한다
  const level = heatSensitive ? 'DANGER' : 'CAUTION'

  return {
    placeId,
    placeTitle: titleOf(placeId),
    targetDateTime: '2026-08-29T14:00:00',
    walkSafetyLevel: WALK_LEVELS[level] as ScoreMetricMetadata,
    reasons: [
      /*
        **경보 갈래에서만 특보 근거가 맨 앞에 온다.** `WalkSafetyEvaluator` 는 경보를 만나면
        다른 판정을 보기 전에 DANGER 로 끊고, 그 사실을 근거 첫 줄로 남긴다.
      */
      ...(heatSensitive
        ? [
            {
              code: 'WEATHER_WARNING_ACTIVE',
              name: '기상특보 발효',
              description:
                '폭염 경보 발효 중입니다. 더위가 심합니다. 노면이 뜨거워 발바닥 화상 위험이 큽니다.',
            },
          ]
        : []),
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
      ...(heatSensitive
        ? [
            {
              code: 'HEAT_SENSITIVE',
              name: '더위 민감',
              description: '더위에 약한 아이라 같은 기온에도 부담이 큽니다.',
            },
          ]
        : []),
      {
        code: 'SAFE_WINDOW',
        name: '안전 시간대',
        description: '같은 날 안에 더 안전한 산책 시간대가 있습니다.',
      },
    ],
    estimatedPavementCelsius: 58.0,
    heatIndexCelsius: heatSensitive ? 35.0 : 32.4,
    saferWindowStart: '18:00:00',
    saferWindowEnd: '21:00:00',
    temperature: 31.0,
    humidity: 78,
    skyState: { code: 'CLEAR', name: '맑음', description: '구름이 거의 없습니다.' },
    precipitationType: { code: 'NONE', name: '없음', description: '강수가 없습니다.' },
    petConditionApplied: true,
    weatherProviderName: '기상청 단기예보',
    /*
      경보는 산책을 DANGER 로 끊는다 — mock 의 `heatSensitive` 갈래가 이미 DANGER 라
      여기에 얹으면 두 사실이 어긋나지 않는다. 반대 갈래는 특보 없음이다.
    */
    weatherWarning: heatSensitive ? HEAT_WAVE_WARNING : null,
  }
}

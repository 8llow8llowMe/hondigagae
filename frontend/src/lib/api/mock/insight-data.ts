import { MOCK_PLACES } from '@/lib/api/mock/place-data'
import type { CodeNameMetadata } from '@/types/api'
import type {
  CongestionItem,
  DailyCongestionItem,
  PlaceCongestionResponse,
  PlaceSuitabilityResponse,
  RegionalWeatherResponse,
  ScoreMetricMetadata,
  WalkSafetyResponse,
  WalkTimesResponse,
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

const CONGESTION_LEVELS: Record<string, CodeNameMetadata> = {
  LOW: {
    code: 'LOW',
    name: '한산',
    description: '관광객 집중도가 낮아 여유로울 것으로 예상됩니다.',
  },
  MODERATE: {
    code: 'MODERATE',
    name: '보통',
    description: '관광객 집중도가 평소 수준입니다.',
  },
  HIGH: CONGESTION_HIGH.level,
  UNKNOWN: CONGESTION_UNKNOWN.level,
}

/**
 * 기간 혼잡도 (#430). `fromDate` 는 서버가 오늘로 잡지만 **mock 은 고정 날짜를 쓴다** —
 * 실행한 날에 따라 스냅샷이 흔들리면 e2e 가 날짜마다 다른 화면을 본다.
 *
 * 갈래를 셋으로 둔다 (`bucketOf`):
 *  - 0 · 1 — 값이 있는 주. **중간에 `UNKNOWN` 날짜를 섞는다** (점선 트랙을 화면에서 봐야 한다)
 *  - 2 — **전부 `UNKNOWN` · `leastCrowded: null`.** 적합도가 `INSUFFICIENT` 인 장소와 같은
 *    버킷이라, 판정도 혼잡도도 답하지 못하는 장소가 어떻게 보이는지 한 화면에서 확인된다
 *
 * 집중률은 **서버가 고르는 규칙과 같은 답이 나오게** 둔다 — `UNKNOWN` 제외 최저,
 * 동률이면 이른 날짜. mock 이 다른 날을 고르면 화면이 아니라 mock 이 틀린 것이다.
 */
const CONGESTION_FROM_DATE = '2026-08-29'

/** 버킷별 집중률 패턴. `null` 은 데이터 없는 날짜다 — **목록에서 빼지 않는다** */
const CONGESTION_RATES: Record<number, (number | null)[]> = {
  0: [68.4, 41.2, 28.9, 24.5, null, 52.1, 77.3],
  1: [35.0, 62.8, null, 44.6, 31.7, 29.4, 58.2],
  2: [null, null, null, null, null, null, null],
}

function congestionLevelOf(rate: number | null): CodeNameMetadata {
  if (rate === null) return CONGESTION_LEVELS.UNKNOWN as CodeNameMetadata
  if (rate < 35) return CONGESTION_LEVELS.LOW as CodeNameMetadata
  if (rate < 60) return CONGESTION_LEVELS.MODERATE as CodeNameMetadata
  return CONGESTION_LEVELS.HIGH as CodeNameMetadata
}

export function mockCongestions(placeId: string, days: number): PlaceCongestionResponse {
  const pattern = CONGESTION_RATES[bucketOf(placeId)] ?? []
  const from = Date.parse(`${CONGESTION_FROM_DATE}T00:00:00Z`)

  const dailyCongestions: DailyCongestionItem[] = Array.from({ length: days }, (_, offset) => {
    // 패턴을 주 단위로 되풀이한다 — 30일도 같은 리듬으로 채워 레일을 실제로 굴려 본다
    const rate = pattern[offset % pattern.length] ?? null

    return {
      date: new Date(from + offset * 86_400_000).toISOString().slice(0, 10),
      level: congestionLevelOf(rate),
      concentrationRate: rate,
    }
  })

  /*
    **서버 규칙을 그대로 흉내낸다** — `UNKNOWN` 제외 최저 집중률, 동률이면 가장 이른 날짜.
    아는 날이 하나도 없으면 `null` 이다. FE 는 이 값을 그대로 쓰므로, mock 이 다른 날을
    고르면 화면에서 티가 나지 않고 조용히 틀린다.
  */
  const known = dailyCongestions.filter((item) => item.concentrationRate !== null)
  const leastCrowded =
    known.reduce<DailyCongestionItem | null>(
      (best, item) =>
        best === null || (item.concentrationRate ?? 0) < (best.concentrationRate ?? 0)
          ? item
          : best,
      null,
    ) ?? null

  return {
    placeId,
    fromDate: CONGESTION_FROM_DATE,
    toDate: dailyCongestions[dailyCongestions.length - 1]?.date ?? CONGESTION_FROM_DATE,
    dailyCongestions,
    leastCrowded,
  }
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
      // 열지수는 최고기온과 다른 시각에서 나온다 — 습도 85% 라 체감이 더 높다 (#253)
      maxFeelsLikeTemperature: 33.4,
      maxPrecipitationProbability: high ? 10 : 80,
      precipitationType: high
        ? { code: 'NONE', name: '없음', description: '강수가 없습니다.' }
        : { code: 'RAIN', name: '비', description: '비가 예보되었습니다.' },
      skyState: { code: 'OVERCAST', name: '흐림', description: '하늘이 구름으로 덮인 상태입니다.' },
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
        // #292 — BE `WalkSafetyReasonCode` 가 `HEAT_INDEX_HIGH` 를 이 코드로 교체했다
        code: 'FEELS_LIKE_HIGH',
        name: '체감온도 높음',
        description: '기상청 여름철 체감온도 기준으로 더위 부담이 큰 조건입니다.',
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
    /*
      **기온 31℃ · 습도 78% 를 두 산식에 실제로 넣은 값이다** (#292). 판정값은 기상청
      체감온도 `33.0`, 참고 열지수는 NOAA `40.2` 다 — **열지수가 7℃ 높다.**

      이 갈래를 일부러 고온다습으로 둔다. 그 차이가 이 변경의 이유이고, 두 값이 붙어 있는
      mock 이 없으면 "참고값이 판정값보다 크게 나오는" 화면(위계가 뒤집혀 보이는 유일한
      경우)을 로컬에서 볼 수 없다. 서늘한 날은 반대로 체감온도가 더 높다 (21℃/85% → 23.2 vs 21.0).

      **`heatSensitive` 로 갈리지 않는다.** 두 갈래가 같은 기온·습도를 쓰므로 온도값이
      갈리면 거짓이다 — 갈리는 것은 등급이고, 그것이 반려견 특성이 반영된다는 증거다.
      (예전 mock 은 열지수만 갈래별로 달라 같은 조건에서 다른 숫자를 냈다.)
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
    /*
      경보는 산책을 DANGER 로 끊는다 — mock 의 `heatSensitive` 갈래가 이미 DANGER 라
      여기에 얹으면 두 사실이 어긋나지 않는다. 반대 갈래는 특보 없음이다.
    */
    weatherWarning: heatSensitive ? HEAT_WAVE_WARNING : null,
  }
}

/** 서버 `ForecastCoverage` 의 metadata 를 그대로 옮긴다 — 화면이 이 문구를 렌더한다 (#262) */
const COVERAGE = {
  AVAILABLE: {
    code: 'AVAILABLE',
    name: '예보 있음',
    description: '그 날짜의 예보가 있어 날씨를 근거로 씁니다.',
  },
  DAY_ENDED: {
    code: 'DAY_ENDED',
    name: '남은 예보 없음',
    description:
      '그 날짜의 예보 시간대가 이미 지났습니다. 기상청 23시 발표부터는 다음 날 예보만 제공됩니다.',
  },
  UNAVAILABLE: {
    code: 'UNAVAILABLE',
    name: '날씨 정보 없음',
    description: '날씨 정보를 가져오지 못했습니다.',
  },
} as const

/** 서버 `GoldenWindowStatus` 의 metadata 를 그대로 옮긴다 (#270) */
const GOLDEN_STATUS = {
  AVAILABLE: {
    code: 'AVAILABLE',
    name: '추천 구간 있음',
    description: '오늘 남은 시간 중 산책하기 좋은 구간이 있습니다.',
  },
  SUPPRESSED_BY_WARNING: {
    code: 'SUPPRESSED_BY_WARNING',
    name: '특보로 추천 보류',
    description:
      '기상특보 경보가 발효 중이라 시간대가 좋아도 추천하지 않습니다. 시간대 곡선은 근거로 그대로 제공됩니다.',
  },
  ALL_HOURS_RISKY: {
    code: 'ALL_HOURS_RISKY',
    name: '남은 시간 모두 위험',
    description: '오늘 남은 시각이 전부 위험 등급이라 추천할 구간이 없습니다.',
  },
  NO_FORECAST: {
    code: 'NO_FORECAST',
    name: '판정할 예보 없음',
    description: '오늘 남은 시각의 예보가 없어 추천 여부를 판정하지 않았습니다.',
  },
} as const

/**
 * 오늘의 산책 골든타임 (#158 · [#262](https://github.com/8llow8llowMe/hondigagae/issues/262)).
 *
 * **반려견 조건 셋으로 다섯 날을 가른다** (#262 · [#270](https://github.com/8llow8llowMe/hondigagae/issues/270)).
 * 이 mock 에는 자유 입력이 없어(AI 일정의 요청 메모 같은 것) 시나리오를 고를 축이 반려견
 * 조건뿐이다. 판정 자리의 상태가 넷이고 그중 `NO_FORECAST` 는 이유가 둘이라
 * (`forecastCoverage`), 불린 하나로는 어림도 없다.
 *
 * | 더위 | 추위 | 소리 | 화면 | 로컬에서 여는 법 |
 * | --- | --- | --- | --- | --- |
 * | — | — | — | `AVAILABLE` — 골든타임 있음 | **반려견 없음**(게스트·미등록) |
 * | `true` | `false` | `true` | **`SUPPRESSED_BY_WARNING`** — 경보라 보류, 곡선은 남는다 | **몽실이** (기본) |
 * | `true` | `false` | `false` | **`ALL_HOURS_RISKY`** — 경보 없이 전부 위험 | 몽실이의 `소리 민감` 해제 |
 * | `false` | `true` | — | `AVAILABLE` — 골든타임 있음 | **초코** (기본) |
 * | `false` | `false` | — | `NO_FORECAST` + **`DAY_ENDED`** (정상) | 초코의 `추위 민감` 해제 |
 * | `true` | `true` | — | `NO_FORECAST` + **`UNAVAILABLE`** (+ 재시도) | 몽실이에 `추위 민감` 추가 |
 *
 * **넷 다 실데이터로 만들기 어렵다.** `DAY_ENDED` 는 밤 늦게만, `UNAVAILABLE` 은 날씨
 * 원천이 죽어야, `SUPPRESSED_BY_WARNING` 은 경보가 떠야, `ALL_HOURS_RISKY` 는 경보 없이
 * 하루가 전부 위험이어야 나온다 — mock 이 유일한 확인 경로다. 조합 자체는 임의지만
 * **전부 반려견 편집 화면에서 체크 한 번으로 열린다.**
 *
 * **`heatSensitive` 가 경보까지 겹쳐 오던 것을 갈랐다.** 예전에는 그 한 값이 "전부 위험"
 * 과 "경보" 를 함께 켜서, 서버 규칙상 실제로는 `SUPPRESSED_BY_WARNING` 인 날을 화면이
 * `ALL_HOURS_RISKY` 로 보고 있었다 — 이 이슈가 고친 바로 그 어긋남이다.
 *
 * 시각은 `mockWalkSafety` 와 같은 2026-08-29 오후다. 두 섹션이 같은 홈에 나란히 서므로
 * 날짜가 갈리면 "지금" 과 "오늘 언제" 가 다른 날 이야기가 된다.
 */
/**
 * 조회에 실린 반려견 조건. **`null` 은 조건이 아예 없다는 뜻이다** — 게스트이거나 반려견을
 * 등록하지 않은 사용자다 (`toInsightQuery` 가 그때 파라미터를 싣지 않는다).
 */
export type MockWalkCondition = {
  heatSensitive: boolean
  coldSensitive: boolean
  noiseSensitive: boolean
}

export function mockWalkTimes(condition: MockWalkCondition | null): WalkTimesResponse {
  /*
    **조건이 없으면 기본 갈래(골든타임 있음)다.** 게스트 홈에서 판정 자리가 "예보 없음" 이
    되면 이 섹션이 무엇을 하는 화면인지 로컬에서 볼 수 없다 — 아래 조합은 시나리오를 고르는
    장치이지 "조건이 없다" 를 뜻하지 않는다.
  */
  const { heatSensitive, coldSensitive, noiseSensitive } = condition ?? {
    heatSensitive: false,
    coldSensitive: true,
    noiseSensitive: false,
  }

  /*
    **곡선이 비는 두 날.** `hourly` 를 비우면서 이유를 함께 준다 — 화면은 그 이유로 문구와
    재시도 유무를 가른다. 비운 곡선에 골든타임을 남기면 근거 없는 추천이 된다.
  */
  if (heatSensitive === coldSensitive) {
    return {
      from: '2026-08-29T23:20:00',
      hourly: [],
      forecastCoverage: heatSensitive ? COVERAGE.UNAVAILABLE : COVERAGE.DAY_ENDED,
      goldenStart: null,
      goldenEnd: null,
      goldenLevel: null,
      goldenWindowStatus: GOLDEN_STATUS.NO_FORECAST,
      weatherWarning: null,
      petConditionApplied: true,
    }
  }

  /*
    기온 곡선은 실제 여름 제주의 모양을 따른다 — 오후에 정점이고 해가 지며 떨어진다.
    노면온도는 기온보다 크게 높고 **해가 진 뒤 격차가 줄어든다**(일사가 빠지므로).
    숫자를 아무렇게나 두면 화면이 "왜 이 시간이 좋은지" 를 설명하지 못한다.
  */
  const curve: [string, number, number, number | null][] = [
    ['14:00:00', 31.0, 58.0, 20],
    ['15:00:00', 31.5, 59.0, 20],
    ['16:00:00', 30.0, 54.0, 10],
    ['17:00:00', 28.5, 45.0, 10],
    ['18:00:00', 27.0, 33.0, 0],
    ['19:00:00', 26.0, 29.0, 0],
    ['20:00:00', 25.0, 27.0, null],
    ['21:00:00', 24.5, 26.0, null],
  ]

  const hourly = curve.map(([time, temperature, pavement, precipitation]) => ({
    at: `2026-08-29T${time}`,
    // 더위에 민감한 아이는 남은 시각이 전부 위험이다 (경보 유무와 별개다 — #270)
    walkSafetyLevel: (heatSensitive
      ? WALK_LEVELS.DANGER
      : pavement >= 50
        ? WALK_LEVELS.DANGER
        : pavement >= 40
          ? WALK_LEVELS.CAUTION
          : WALK_LEVELS.SAFE) as ScoreMetricMetadata,
    temperature,
    estimatedPavementCelsius: pavement,
    precipitationProbability: precipitation,
  }))

  /*
    추천이 없는 두 날 (#270). **곡선은 그대로 준다** — 근거는 감추지 않는다.

    **경보 유무로 갈린다.** 서버 `GoldenWindowStatus.of` 가 예보 → **경보** → 구간 순으로
    보므로, 경보가 떠 있으면 곡선이 전부 위험이든 아니든 `SUPPRESSED_BY_WARNING` 이다.
    예전 mock 은 이 둘을 한 갈래로 묶어 두어 화면이 어긋난 것을 로컬에서 볼 수 없었다.
  */
  if (heatSensitive) {
    return {
      from: '2026-08-29T13:20:00',
      hourly,
      forecastCoverage: COVERAGE.AVAILABLE,
      goldenStart: null,
      goldenEnd: null,
      goldenLevel: null,
      goldenWindowStatus: noiseSensitive
        ? GOLDEN_STATUS.SUPPRESSED_BY_WARNING
        : GOLDEN_STATUS.ALL_HOURS_RISKY,
      ...(noiseSensitive
        ? { weatherWarning: HEAT_WAVE_WARNING }
        : // 경보가 없으니 배지도 없다 — 배지만 남으면 보류인지 판정인지 화면이 흐려진다
          { weatherWarning: null }),
      petConditionApplied: true,
    }
  }

  return {
    from: '2026-08-29T13:20:00',
    hourly,
    forecastCoverage: COVERAGE.AVAILABLE,
    goldenWindowStatus: GOLDEN_STATUS.AVAILABLE,
    // 18:00~21:00 이 SAFE 연속 구간이다 (노면 40도 미만) — 위 곡선과 어긋나면 안 된다
    goldenStart: '2026-08-29T18:00:00',
    goldenEnd: '2026-08-29T21:00:00',
    goldenLevel: WALK_LEVELS.SAFE as ScoreMetricMetadata,
    weatherWarning: null,
    petConditionApplied: true,
  }
}

/** 제주 다섯 권역. 문구는 `JejuRegion` 의 `displayName` / `description` 을 그대로 쓴다 */
const JEJU_REGIONS: CodeNameMetadata[] = [
  {
    code: 'NORTH',
    name: '제주시권',
    description:
      '제주공항과 시내를 포함한 북부입니다. 한라산 북쪽이라 겨울 북서풍의 영향을 먼저 받습니다.',
  },
  {
    code: 'SOUTH',
    name: '서귀포권',
    description:
      '서귀포 시내와 중문을 포함한 남부입니다. 한라산이 북풍을 막아 겨울에도 북부보다 따뜻합니다.',
  },
  {
    code: 'EAST',
    name: '동부권',
    description: '성산과 우도 방면입니다. 탁 트인 해안이라 바람이 강하게 부는 날이 많습니다.',
  },
  {
    code: 'WEST',
    name: '서부권',
    description: '한림과 협재 방면입니다. 해안 산책로가 많아 노면 온도와 바람을 함께 봐야 합니다.',
  },
  {
    code: 'HALLA',
    name: '한라산권',
    description: '1100고지 등 산간입니다. 해발이 높아 해안보다 기온이 낮고 날씨가 빨리 바뀝니다.',
  },
]

/**
 * 제주 권역 날씨 비교 (#158).
 *
 * **한라산권을 일부러 "예보 없음" 으로 둔다.** 산간은 실제로 격자 결측이 잦고, 점수 없는 권역이
 * 목록에 남는지(0점으로 접히지 않는지)가 이 화면의 핵심 분기다 — mock 이 그 경우를 못 내면
 * 화면이 조용히 네 권역만 비교하게 돼도 아무도 모른다.
 *
 * `heatSensitive` 로 추천이 있는 날과 **특보 경보로 추천이 없는 날**을 가른다. 경보면 서버가
 * `recommendedRegion` 을 null 로 주는데, 적합도 0점·산책 위험이라고 말하는 같은 서비스가
 * 여기서만 "여기 가세요" 라고 하면 안 되기 때문이다.
 */
export function mockRegionalWeather(heatSensitive: boolean): RegionalWeatherResponse {
  const regions = JEJU_REGIONS.map((region, order) => {
    // 한라산권(마지막)은 예보를 못 받은 권역이다
    if (region.code === 'HALLA') {
      return {
        region,
        weatherScore: null,
        skyState: null,
        precipitationType: null,
        maxPrecipitationProbability: null,
        minTemperature: null,
        maxTemperature: null,
        maxWindSpeed: null,
        reasons: [
          {
            code: 'FORECAST_UNAVAILABLE',
            name: '예보 없음',
            description: '이 권역의 예보를 가져오지 못해 점수를 내지 않았습니다.',
            scoreDelta: 0,
          },
        ],
      }
    }

    /*
      남부가 가장 좋고 북쪽으로 갈수록 나빠지는 모양이다 — 한라산이 북풍을 막는다는
      `JejuRegion` 의 설명과 어긋나지 않게 둔다. 값이 설명과 반대면 화면이 거짓말을 한다.
    */
    const score = [72, 86, 64, 78][order] as number
    const rainy = score < 70

    return {
      region,
      weatherScore: heatSensitive ? Math.max(0, score - 30) : score,
      skyState: rainy
        ? { code: 'OVERCAST', name: '흐림', description: '하늘이 구름으로 덮인 상태입니다.' }
        : { code: 'CLEAR', name: '맑음', description: '구름이 거의 없습니다.' },
      precipitationType: rainy
        ? { code: 'RAIN', name: '비', description: '비가 예보되었습니다.' }
        : { code: 'NONE', name: '없음', description: '강수가 없습니다.' },
      maxPrecipitationProbability: rainy ? 70 : 10,
      minTemperature: 24.0,
      maxTemperature: rainy ? 29.0 : 31.0,
      maxWindSpeed: region.code === 'EAST' ? 8.4 : 4.2,
      reasons: [
        {
          code: rainy ? 'RAIN_EXPECTED' : 'PRECIPITATION_LOW',
          name: rainy ? '강수 예보' : '강수 적음',
          description: rainy
            ? '강수확률 70% 로, 야외 동선은 젖을 수 있습니다.'
            : '강수확률 10%로 야외 일정에 무리가 없습니다.',
          scoreDelta: rainy ? -20 : 0,
        },
      ],
    }
  })

  if (heatSensitive) {
    return {
      date: '2026-08-29',
      regions,
      // 경보면 추천을 내지 않는다. 비교표는 그대로 준다 — 여전히 정보다
      recommendedRegion: null,
      recommendationReasons: [],
      weatherWarning: HEAT_WAVE_WARNING,
    }
  }

  return {
    date: '2026-08-29',
    regions,
    // 위 점수 배열에서 가장 높은 권역과 같아야 한다 — 어긋나면 화면이 표와 다른 말을 한다
    recommendedRegion: JEJU_REGIONS[1] as CodeNameMetadata,
    recommendationReasons: ['강수확률 10%로 야외 일정에 무리가 없습니다.'],
    weatherWarning: null,
  }
}

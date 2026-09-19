import type { PlanDayAdd, PlanDayVisit, PlanDayWalkSafety } from '@/features/plan/plan-day-section'
import type { Pet } from '@/types/pet'
import type {
  PlanAlternativePlaceItem,
  PlanBriefingItemSummary,
  PlanBriefingResponse,
  PlanBriefingSchedule,
  PlanBriefingWalkTimes,
  PlanBriefingWeatherWarning,
  PlanDayWeatherItem,
  PlanDetail,
  PlanItemDetail,
  PlanItemPlace,
  PlanItemWalkCourse,
  PlanItemWalkSafetyItem,
} from '@/types/plan'

/**
 * 일정 상세 fixture.
 *
 * **mock fixture(`src/lib/api/mock/plan-data.ts`)를 재사용하지 않는다.** 저쪽은 개발
 * 서버가 화면을 띄우기 위한 것이라 값이 바뀌면 테스트가 함께 흔들린다. 테스트는
 * 자기가 검증하는 조건을 스스로 들고 있어야 한다.
 */

function typeMeta(code: string, name: string) {
  return { code, name, description: null }
}

/**
 * 항목의 장소 요약 (#86). `placeDetail` fixture 와 **같은 장소**를 쓴다 — 두 화면이
 * 같은 주소를 다르게 말하면 어느 쪽이 맞는지 테스트가 알려주지 못한다.
 */
export function planItemPlace(overrides: Partial<PlanItemPlace> = {}): PlanItemPlace {
  return {
    addr1: '제주특별자치도 제주시 한림읍 용금로 906-107',
    indoor: true,
    firstImage: null,
    lat: 33.3608276172,
    lng: 126.7818122232,
    ...overrides,
  }
}

/**
 * 항목의 산책 코스 요약 (#620). `planItem` 의 기본값은 `null` 이다 — 기본 fixture 가
 * `PLACE` 항목이라 `walkCourse` 는 항상 비어 있는 것이 맞다. `WALK` 항목을 만들 때
 * `planItem({ ..., itemType: ..., walkCourse: planItemWalkCourse() })` 로 채운다.
 */
export function planItemWalkCourse(
  overrides: Partial<PlanItemWalkCourse> = {},
): PlanItemWalkCourse {
  return {
    name: '시흥-광치기',
    courseLabel: '1코스',
    distanceKm: 15.1,
    durationText: '4~5시간',
    durationMaxMinutes: 300,
    lat: null,
    lng: null,
    firstImage: null,
    fitsActivityLevels: [],
    ...overrides,
  }
}

/**
 * **`place` 의 기본값은 요약이 온 상태다.** 오지 않은 상태(`null`)를 검증하려면
 * `planItem({ ..., place: null })` 로 덮어쓴다 — `WALK`·`MOVE`, delisting,
 * tour-service 장애가 전부 그 모양이다.
 *
 * **`walkCourse` 의 기본값은 `null` 이다** — 기본 `itemType` 이 `PLACE` 라 코스 요약이
 * 있을 자리가 아니다. `WALK` 항목을 만들 때 `planItemWalkCourse()` 로 채운다.
 */
export function planItem(
  overrides: Partial<PlanItemDetail> & { planItemId: string; day: number; sequence: number },
): PlanItemDetail {
  return {
    itemType: typeMeta('PLACE', '장소'),
    targetId: '212481712381923328',
    title: '제주현대미술관',
    memo: null,
    startTime: null,
    /**
     * **기본값은 꺼진 상태다** (#124). 백엔드가 primitive `boolean` 이라 nullable 이
     * 아니고, 체크된 행을 검증하려면 `planItem({ ..., visited: true })` 로 덮어쓴다.
     */
    visited: false,
    place: planItemPlace(),
    walkCourse: null,
    ...overrides,
  }
}

export const planDetail: PlanDetail = {
  planId: '223456789012000001',
  petId: '123456789012000001',
  petIds: ['123456789012000001'],
  areaCode: '39',
  sigunguCode: '4',
  title: '몽실이와 제주 2박 3일',
  startDate: '2026-09-12',
  endDate: '2026-09-14',
  budget: 400_000,
  status: { code: 'DRAFT', name: '초안', description: '작성 중인 일정입니다.' },
  totalDays: 3,
  items: [
    planItem({ planItemId: 'i-1-0', day: 1, sequence: 0, title: '김창열미술관' }),
    planItem({
      planItemId: 'i-1-1',
      day: 1,
      sequence: 1,
      title: '애월 펜션',
      itemType: typeMeta('LODGING', '숙박'),
      targetId: '212481712381923331',
    }),
  ],
}

/** 판정이 정상으로 온 일자 */
export const planVerdict: PlanDayWeatherItem = {
  day: 1,
  date: '2026-09-12',
  representativePlaceId: '212481712381923328',
  representativePlaceTitle: '김창열미술관',
  // 한 마리 일정이라 기준 반려견이 대표와 같다. 갈리는 경우는 mock fixture 가 덮는다 (#152)
  basisPetId: '123456789012000001',
  score: 84,
  suitabilityLevel: {
    code: 'HIGH',
    name: '여행 적합',
    description: '반려견과 방문하기 좋은 조건입니다.',
    scoreDescription: null,
  },
  petSuitabilities: [
    {
      petId: '123456789012000001',
      score: 84,
      suitabilityLevel: {
        code: 'HIGH',
        name: '여행 적합',
        description: '반려견과 방문하기 좋은 조건입니다.',
        scoreDescription: null,
      },
    },
  ],
  reasons: [
    {
      code: 'PET_ALLOWED',
      name: '반려견 동반 가능',
      description: '반려견과 함께 입장할 수 있는 장소입니다.',
      scoreDelta: 0,
    },
  ],
  weather: {
    date: '2026-09-12',
    forecastSourceCode: 'SHORT_TERM',
    forecastSourceName: '단기예보',
    minTemperature: 21,
    maxTemperature: 26,
    maxFeelsLikeTemperature: 27.5,
    maxPrecipitationProbability: 10,
    precipitationTypeName: '없음',
    skyStateName: '맑음',
    maxWindSpeed: 3.1,
    maxHumidity: 60,
  },
  indoorAlternatives: [],
  unavailableReason: null,
  unavailableReasonCode: null,
}

export const pet: Pet = {
  petId: '123456789012000001',
  name: '몽실이',
  breed: '푸들',
  birthYm: '2020-03',
  age: 6,
  sizeType: { code: 'SMALL', name: '소형견', description: '체중 10kg 미만' },
  weightKg: null,
  profileImageUrl: null,
  representative: false,
  heatSensitive: true,
  coldSensitive: false,
  noiseSensitive: false,
  activityLevel: { code: 'MEDIUM', name: '보통', description: null },
  walkPreferred: true,
  sociality: { code: 'MEDIUM', name: '보통', description: null },
}

/** 동행 두 마리 갈래(#218)용 두 번째 아이. 대표가 아니고 특성도 몽실이와 갈린다 */
export const secondPet: Pet = {
  ...pet,
  petId: '123456789012000002',
  name: '초코',
  breed: '리트리버',
  sizeType: { code: 'LARGE', name: '대형견', description: '체중 25kg 이상' },
  heatSensitive: false,
  coldSensitive: true,
}

/**
 * `PlanDaySection` 의 담기 묶음 기본값 (#82).
 *
 * 테스트마다 7개 필드를 다시 적으면 **무엇을 검증하는지가 잡음에 묻힌다.**
 * 검증할 필드만 덮어쓴다.
 */
export const planDayAdd: PlanDayAdd = {
  href: '/plans/312481712381923328/days/1/add',
  addedPlaceIds: new Set<string>(),
  pendingPlaceId: null,
  busy: false,
  error: null,
  onAdd: () => undefined,
}

/**
 * 방문 체크 배선 — 아무 항목도 진행·실패 상태가 아닌 기본값 (#124).
 *
 * 진행/실패 행을 보려면 `visitOf` 를 덮어쓴다:
 * `{ visitOf: () => ({ pending: false, error: {...}, onToggle: () => undefined }) }`
 */
export const planDayVisit: PlanDayVisit = {
  // `compact: false` 가 기본이다 — 출발 전 갈래는 테스트가 따로 켠다 (#732)
  visitOf: () => ({ pending: false, error: null, onToggle: () => undefined, compact: false }),
}

/**
 * 항목 산책 위험도 배선 기본값 (#625) — 아무 판정도 도착하지 않은 상태다.
 *
 * `of` 가 항상 `undefined` 를 돌려주므로 배지·문장 없이 시각 줄만 서고, `failed`·
 * `hasLookupFailed` 가 모두 꺼져 있어 일자 카드에 오류·재시도 자리도 없다 — "조회 중"과
 * "조용히 숨김" 이 화면에서 같은 모양인 것과 일치한다 (D15-7).
 */
export const planDayWalkSafety: PlanDayWalkSafety = {
  of: () => undefined,
  beyondForecastReason: null,
  failed: false,
  hasLookupFailed: false,
  onRetry: () => undefined,
}

/**
 * 항목 산책 위험도 fixture (#625). **기본값은 정상 판정(`SAFE`)이다** — 못 낸 사유를
 * 검증하려면 `unavailableReasonCode`·`unavailableReason`·`walkSafetyLevel` 을 함께 덮어쓴다
 * (셋은 짝이다, D15-1).
 */
export function planItemWalkSafety(
  overrides: Partial<PlanItemWalkSafetyItem> & { planItemId: string },
): PlanItemWalkSafetyItem {
  return {
    day: 1,
    sequence: 0,
    date: '2026-09-12',
    startTime: '10:30',
    title: '김창열미술관',
    placeId: '212481712381923328',
    placeTitle: '제주현대미술관',
    targetDateTime: '2026-09-12T10:30:00',
    basisPetId: '123456789012000001',
    /*
      기본은 `true` — 정상 판정의 가장 흔한 모양이다 (#717). `false`(물어봤지만 반려견
      특성 없이 판정) 와 `null`(판정 자체가 없어 묻지 않았다) 은 뜻이 달라 쓰는 쪽이
      명시한다.
    */
    petConditionApplied: true,
    walkSafetyLevel: {
      code: 'SAFE',
      name: '안전',
      description: '지금 산책하기 좋은 조건이에요.',
      /* #717 이 Feign 경계 배선을 이어 실제로 채워진다 — 행은 쓰지 않지만 계약은 이 모양이다 */
      scoreDescription: '체감온도와 노면 온도가 모두 안전 범위예요.',
    },
    estimatedPavementCelsius: 30.2,
    feelsLikeCelsius: 27.5,
    temperature: 25.4,
    saferWindowStart: null,
    saferWindowEnd: null,
    unavailableReasonCode: null,
    unavailableReason: null,
    ...overrides,
  }
}

/**
 * 실내 대안 하나. **서버가 좌표와 거리까지 준다** — `{placeId, title}` 두 필드가 아니다.
 * `distanceMeters` 는 그날 기준 장소로부터의 **직선거리(m)** 다.
 */
export function planAlternative(
  overrides: Partial<PlanAlternativePlaceItem> = {},
): PlanAlternativePlaceItem {
  return {
    placeId: '212481712381923328',
    title: '제주특별자치도립김창열미술관',
    lat: 33.3608276172,
    lng: 126.7818122232,
    distanceMeters: 12_400,
    ...overrides,
  }
}

// ─── 출발 전 여행 브리핑 (#626) ──────────────────────────────────────────────

/**
 * 브리핑 하루치 — **여행 중(`today: true`) 이고 특보가 없는 날**이 기본값이다.
 *
 * 세 갈래(특보 없음 / 확인 못 함 / 특보 있음)는 `planBriefing({...})` 로 덮어써 만든다 —
 * 이 이슈의 회귀 감시가 바로 그 갈래이므로 fixture 가 한 갈래를 기본으로 못박아 둔다.
 */
export function planBriefing(overrides: Partial<PlanBriefingResponse> = {}): PlanBriefingResponse {
  return {
    planId: planDetail.planId,
    planTitle: planDetail.title,
    day: 2,
    date: '2026-09-13',
    today: true,
    petIds: [...planDetail.petIds],
    basisPetId: planDetail.petId,
    petConditionApplied: true,
    schedule: planBriefingSchedule(),
    weather: planVerdict,
    weatherWarning: null,
    weatherWarningUnavailableReason: null,
    walkTimes: planBriefingWalkTimes(),
    walkTimesUnavailableReason: null,
    ...overrides,
  }
}

export function planBriefingSchedule(
  overrides: Partial<PlanBriefingSchedule> = {},
): PlanBriefingSchedule {
  return {
    itemCount: 4,
    visitedCount: 1,
    firstItem: planBriefingItem(),
    lastItem: planBriefingItem({
      planItemId: 'i-2-3',
      sequence: 3,
      itemType: 'LODGING',
      title: '동문재래시장',
      startTime: '19:00:00',
    }),
    representativePlaceId: '212481712381923328',
    representativePlaceTitle: '협재해수욕장',
    ...overrides,
  }
}

/**
 * **`itemType` 이 metadata 가 아니라 enum 문자열이다** — 같은 도메인의 `PlanItemDetail`
 * 과 모양이 다르다 (명세 D9-1). 화면이 이 값을 그대로 새지 않는지 테스트가 감시한다.
 */
export function planBriefingItem(
  overrides: Partial<PlanBriefingItemSummary> = {},
): PlanBriefingItemSummary {
  return {
    planItemId: 'i-2-0',
    sequence: 0,
    itemType: 'PLACE',
    title: '협재해수욕장',
    startTime: '10:30:00',
    visited: false,
    ...overrides,
  }
}

/** 골든타임이 나온 날. 좌표는 **이 객체 안에만** 온다 (`schedule` 에는 없다) */
export function planBriefingWalkTimes(
  overrides: Partial<PlanBriefingWalkTimes> = {},
): PlanBriefingWalkTimes {
  return {
    lat: 33.3941,
    lng: 126.2396,
    from: '2026-09-13T09:00:00',
    forecastCoverage: { code: 'AVAILABLE', name: '예보 있음', description: null },
    goldenStart: '2026-09-13T18:00:00',
    goldenEnd: '2026-09-13T21:00:00',
    goldenLevel: {
      code: 'SAFE',
      name: '안전',
      description: '산책하기 좋은 조건입니다.',
      scoreDescription: null,
    },
    goldenWindowStatus: {
      code: 'AVAILABLE',
      name: '추천 구간 있음',
      description: '이 시간대에 산책하기 좋습니다.',
    },
    petConditionApplied: true,
    ...overrides,
  }
}

/** 발효 중인 특보 하나 — 배지에 낱말이 들어가는지 보는 갈래다 */
export function planBriefingWarning(
  overrides: Partial<PlanBriefingWeatherWarning> = {},
): PlanBriefingWeatherWarning {
  return {
    type: { code: 'TYPHOON', name: '태풍', description: '태풍 특보입니다.' },
    level: { code: 'WARNING', name: '경보', description: '외출을 미루는 것이 좋습니다.' },
    recommendationSuppressed: true,
    effectiveAt: '2026-09-13T07:00:00',
    ...overrides,
  }
}

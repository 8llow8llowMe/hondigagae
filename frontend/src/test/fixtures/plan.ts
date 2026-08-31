import type { PlanDayAdd } from '@/features/plan/plan-day-section'
import type { Pet } from '@/types/pet'
import type {
  PlanAlternativePlaceItem,
  PlanDayWeatherItem,
  PlanDetail,
  PlanItemDetail,
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

export function planItem(
  overrides: Partial<PlanItemDetail> & { planItemId: string; day: number; sequence: number },
): PlanItemDetail {
  return {
    itemType: typeMeta('PLACE', '장소'),
    targetId: '212481712381923328',
    title: '제주현대미술관',
    memo: null,
    startTime: null,
    ...overrides,
  }
}

export const planDetail: PlanDetail = {
  planId: '223456789012000001',
  petId: '123456789012000001',
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
  score: 84,
  suitabilityLevel: {
    code: 'HIGH',
    name: '여행 적합',
    description: '반려견과 방문하기 좋은 조건입니다.',
    scoreDescription: null,
  },
  reasons: [
    {
      code: 'PET_ALLOWED',
      name: '반려견 동반 가능',
      description: '반려견과 함께 입장할 수 있는 장소입니다.',
    },
  ],
  weather: {
    date: '2026-09-12',
    forecastSourceCode: 'SHORT_TERM',
    forecastSourceName: '단기예보',
    minTemperature: 21,
    maxTemperature: 26,
    maxPrecipitationProbability: 10,
    precipitationTypeName: '없음',
    skyStateName: '맑음',
    maxWindSpeed: 3.1,
    maxHumidity: 60,
  },
  indoorAlternatives: [],
  unavailableReason: null,
}

export const pet: Pet = {
  petId: '123456789012000001',
  name: '몽실이',
  breed: '푸들',
  birthYm: '2020-03',
  age: 6,
  sizeType: { code: 'SMALL', name: '소형견', description: '체중 10kg 미만' },
  heatSensitive: true,
  coldSensitive: false,
  noiseSensitive: false,
  activityLevel: { code: 'MEDIUM', name: '보통', description: null },
  walkPreferred: true,
  sociality: { code: 'MEDIUM', name: '보통', description: null },
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

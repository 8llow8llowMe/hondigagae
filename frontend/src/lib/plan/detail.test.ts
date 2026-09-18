import { describe, expect, it } from 'vitest'

import type { LatLng } from '@/lib/geo/coord'
import { haversineMeters, isLongTrip, LONG_TRIP_THRESHOLD_M } from '@/lib/geo/distance'
import {
  alternativePlaceIds,
  groupItemsByDay,
  hasUnresolvedPlace,
  isPlaceTarget,
  lodgingBasisFor,
  toItemRows,
} from '@/lib/plan/detail'
import { planAlternative } from '@/test/fixtures/plan'
import type { PlanItemDetail, PlanItemPlace } from '@/types/plan'

const JEJU_AIRPORT: LatLng = { lat: 33.507, lng: 126.493 }
const SEONGSAN: LatLng = { lat: 33.458, lng: 126.9425 }

/**
 * **`place` 의 기본값은 `null` 이다.** 거리를 보는 테스트만 좌표를 실어 준다 —
 * 그래야 어느 항목이 좌표를 갖는지가 케이스마다 눈에 보인다.
 */
function item(overrides: Partial<PlanItemDetail> & { day: number; sequence: number }) {
  const type = overrides.itemType?.code ?? 'PLACE'
  return {
    planItemId: `item-${overrides.day}-${overrides.sequence}`,
    targetId: '212481712381923328',
    title: '어딘가',
    memo: null,
    startTime: null,
    visited: false,
    place: null,
    walkCourse: null,
    ...overrides,
    itemType: overrides.itemType ?? { code: type, name: type, description: '' },
  } satisfies PlanItemDetail
}

/** 좌표만 있는 장소 요약. 거리 계산에 필요한 것은 lat/lng 뿐이다 */
function placeAt(coord: LatLng): PlanItemPlace {
  return { addr1: null, indoor: null, firstImage: null, lat: coord.lat, lng: coord.lng }
}

describe('haversineMeters', () => {
  it('알려진 두 좌표의 거리를 낸다 — 제주공항 ↔ 성산일출봉 약 42km', () => {
    const meters = haversineMeters(JEJU_AIRPORT, SEONGSAN)

    expect(meters).not.toBeNull()
    expect(meters as number).toBeGreaterThan(41_000)
    expect(meters as number).toBeLessThan(43_000)
  })

  it('같은 좌표는 0 이다', () => {
    expect(haversineMeters(JEJU_AIRPORT, JEJU_AIRPORT)).toBeCloseTo(0, 6)
  })

  it('방향이 바뀌어도 같은 값이다', () => {
    expect(haversineMeters(JEJU_AIRPORT, SEONGSAN)).toBeCloseTo(
      haversineMeters(SEONGSAN, JEJU_AIRPORT) as number,
      6,
    )
  })

  it('한쪽이라도 좌표가 없으면 null 이다 — 0 이 아니다', () => {
    expect(haversineMeters(null, SEONGSAN)).toBeNull()
    expect(haversineMeters(JEJU_AIRPORT, null)).toBeNull()
    expect(haversineMeters(null, null)).toBeNull()
  })
})

describe('isLongTrip — 30km 임계값', () => {
  it('경계는 포함이다 (29.9 / 30.0 / 30.1)', () => {
    expect(isLongTrip(LONG_TRIP_THRESHOLD_M - 100)).toBe(false)
    expect(isLongTrip(LONG_TRIP_THRESHOLD_M)).toBe(true)
    expect(isLongTrip(LONG_TRIP_THRESHOLD_M + 100)).toBe(true)
  })

  it('거리를 모르면 긴 이동이 아니다 — 모름을 경고로 만들지 않는다', () => {
    expect(isLongTrip(null)).toBe(false)
  })
})

describe('isPlaceTarget — 장소를 가리키는 항목', () => {
  it('PLACE · MEAL · LODGING 만 장소다', () => {
    for (const code of ['PLACE', 'MEAL', 'LODGING']) {
      expect(isPlaceTarget(item({ day: 1, sequence: 0, itemType: meta(code) }))).toBe(true)
    }
  })

  it('WALK 는 walk_course.id 라 부르지 않는다 — 남의 id 로 404 를 만든다', () => {
    expect(isPlaceTarget(item({ day: 1, sequence: 0, itemType: meta('WALK') }))).toBe(false)
  })

  it('MOVE 는 대상이 없다', () => {
    expect(isPlaceTarget(item({ day: 1, sequence: 0, itemType: meta('MOVE') }))).toBe(false)
  })

  it('targetId 가 null 이면 장소가 아니다', () => {
    expect(isPlaceTarget(item({ day: 1, sequence: 0, targetId: null }))).toBe(false)
  })
})

describe('hasUnresolvedPlace — 장소 요약이 오지 않은 항목 (#115)', () => {
  it('장소를 가리키는데 place 가 비면 결손이다 — PLAN_004 후보다', () => {
    expect(hasUnresolvedPlace(item({ day: 1, sequence: 0, place: null }))).toBe(true)
  })

  it('요약이 왔으면 결손이 아니다', () => {
    const resolved = item({ day: 1, sequence: 0, place: placeAt(SEONGSAN) })

    expect(hasUnresolvedPlace(resolved)).toBe(false)
  })

  it('WALK · MOVE 의 null 은 결손이 아니다 — 애초에 물어볼 장소가 없다', () => {
    for (const code of ['WALK', 'MOVE']) {
      expect(hasUnresolvedPlace(item({ day: 1, sequence: 0, itemType: meta(code) }))).toBe(false)
    }
  })

  it('targetId 가 없으면 결손이 아니다', () => {
    expect(hasUnresolvedPlace(item({ day: 1, sequence: 0, targetId: null }))).toBe(false)
  })
})

describe('alternativePlaceIds — 실내 대안만 보강한다 (#115)', () => {
  it('중복 placeId 는 한 번만 조회한다 — 같은 장소가 두 일자의 대안일 수 있다', () => {
    const ids = alternativePlaceIds([
      planAlternative({ placeId: 'a' }),
      planAlternative({ placeId: 'b' }),
      planAlternative({ placeId: 'a' }),
    ])

    expect(ids).toEqual(['a', 'b'])
  })

  it('대안이 없으면 요청도 없다', () => {
    expect(alternativePlaceIds([])).toEqual([])
  })
})

describe('groupItemsByDay', () => {
  it('totalDays 만큼 섹션이 생긴다 — 항목이 없는 일자도 자리를 갖는다', () => {
    const { days } = groupItemsByDay([item({ day: 1, sequence: 0 })], 3)

    expect(days).toHaveLength(3)
    expect(days.map((group) => group.day)).toEqual([1, 2, 3])
    expect(days[1]?.items).toEqual([])
  })

  it('같은 일자 안은 sequence 오름차순이다', () => {
    const { days } = groupItemsByDay(
      [
        item({ day: 1, sequence: 2, title: '셋' }),
        item({ day: 1, sequence: 0, title: '하나' }),
        item({ day: 1, sequence: 1, title: '둘' }),
      ],
      1,
    )

    expect(days[0]?.items.map((entry) => entry.title)).toEqual(['하나', '둘', '셋'])
  })

  it('totalDays 를 넘는 항목은 기간 밖으로 분리한다 — 숨기지 않는다', () => {
    const { days, outOfRange } = groupItemsByDay(
      [item({ day: 1, sequence: 0, title: '안' }), item({ day: 3, sequence: 0, title: '밖' })],
      2,
    )

    expect(days).toHaveLength(2)
    expect(outOfRange.map((entry) => entry.title)).toEqual(['밖'])
  })

  it('day 가 0 이하인 항목도 기간 밖이다', () => {
    const { outOfRange } = groupItemsByDay([item({ day: 0, sequence: 0, title: '이상' })], 2)

    expect(outOfRange.map((entry) => entry.title)).toEqual(['이상'])
  })

  it('기간 밖 항목은 일자 → 순번 순으로 정렬한다', () => {
    const { outOfRange } = groupItemsByDay(
      [
        item({ day: 5, sequence: 1, title: 'b' }),
        item({ day: 4, sequence: 0, title: 'a' }),
        item({ day: 5, sequence: 0, title: 'c' }),
      ],
      1,
    )

    expect(outOfRange.map((entry) => entry.title)).toEqual(['a', 'c', 'b'])
  })
})

describe('lodgingBasisFor — 숙소 기준점', () => {
  const days = groupItemsByDay(
    [
      item({ day: 1, sequence: 0, title: '1일 관광' }),
      item({ day: 1, sequence: 1, title: '1일 숙소', itemType: meta('LODGING') }),
      item({ day: 2, sequence: 0, title: '2일 관광' }),
      item({ day: 3, sequence: 0, title: '3일 관광' }),
    ],
    3,
  ).days

  it('앞선 날의 숙소를 쓴다 — 그날 밤을 보낸 곳이 아침의 출발점이다', () => {
    expect(lodgingBasisFor(2, days)?.title).toBe('1일 숙소')
  })

  it('여러 날 전이어도 가장 가까운 앞선 숙소를 찾는다', () => {
    expect(lodgingBasisFor(3, days)?.title).toBe('1일 숙소')
  })

  it('그날의 숙소는 기준이 아니다 — 아직 가지 않은 곳에서 출발할 수 없다', () => {
    // 1일차 숙소는 그날 **저녁에** 체크인한다. 아침 첫 항목의 출발점이 될 수 없다
    expect(lodgingBasisFor(1, days)).toBeNull()
  })

  it('숙소가 그날 첫 항목이어도 기준이 되지 않는다 — 자기와의 거리는 0 이라 잡음이다', () => {
    const own = groupItemsByDay(
      [item({ day: 1, sequence: 0, title: '숙소', itemType: meta('LODGING') })],
      1,
    ).days

    expect(lodgingBasisFor(1, own)).toBeNull()
  })

  it('숙소가 아예 없으면 null 이다', () => {
    const none = groupItemsByDay([item({ day: 1, sequence: 0 })], 1).days

    expect(lodgingBasisFor(1, none)).toBeNull()
  })
})

describe('toItemRows — 거리는 항목이 들고 온 좌표로 잰다 (#115)', () => {
  const airport = item({ day: 1, sequence: 0, title: '공항', place: placeAt(JEJU_AIRPORT) })
  const seongsan = item({ day: 1, sequence: 1, title: '성산', place: placeAt(SEONGSAN) })
  const lodging = item({
    day: 1,
    sequence: 2,
    title: '숙소',
    itemType: meta('LODGING'),
    place: placeAt(JEJU_AIRPORT),
  })

  it('첫 항목은 숙소 기준이다', () => {
    const [first] = toItemRows([seongsan], lodging)

    expect(first?.distanceKind).toBe('lodging')
    expect(first?.distanceMeters as number).toBeGreaterThan(41_000)
  })

  it('숙소가 없으면 첫 항목에 거리를 붙이지 않는다', () => {
    const [first] = toItemRows([seongsan], null)

    expect(first?.distanceKind).toBeNull()
    expect(first?.distanceMeters).toBeNull()
  })

  it('2번째부터는 직전 항목 기준이다', () => {
    const rows = toItemRows([airport, seongsan], null)

    expect(rows[1]?.distanceKind).toBe('previous')
    expect(rows[1]?.distanceMeters as number).toBeGreaterThan(41_000)
  })

  it('place 가 비면 거리도 기준도 말하지 않는다 — 행은 살아남는다', () => {
    const unknown = item({ day: 1, sequence: 1, title: '모름', place: null })
    const rows = toItemRows([airport, unknown], null)

    expect(rows).toHaveLength(2)
    expect(rows[1]?.distanceMeters).toBeNull()
    expect(rows[1]?.distanceKind).toBeNull()
  })

  it('place 는 왔는데 좌표가 없으면 거리를 만들지 않는다 — 원천에 좌표가 없는 장소다', () => {
    const noCoord = item({
      day: 1,
      sequence: 1,
      title: '좌표 없음',
      place: { addr1: '제주시 어딘가', indoor: null, firstImage: null, lat: null, lng: null },
    })
    const rows = toItemRows([airport, noCoord], null)

    expect(rows[1]?.distanceMeters).toBeNull()
    expect(rows[1]?.distanceKind).toBeNull()
  })
})

function meta(code: string) {
  return { code, name: code, description: '' }
}

import { describe, expect, it } from 'vitest'

import type { LatLng } from '@/lib/geo/coord'
import { messages } from '@/lib/messages'
import {
  addPlaceFocus,
  addPlaceFocusBasis,
  addPlaceListBasis,
  addPlaceListOrigin,
  addPlaceNearbyCaption,
} from '@/lib/plan/add-place-focus'
import { groupItemsByDay } from '@/lib/plan/detail'
import { planItem, planItemPlace, planItemWalkCourse } from '@/test/fixtures/plan'
import type { PlanItemDetail } from '@/types/plan'

/*
  담기 지도의 **기준점** — 이슈 #1177.

  지도 첫 화면이 그날 장소와 무관하게 제주시(`JEJU_MAP_ANCHOR`)로 열렸다 (2026-10-06 dev
  사용성 점검 — 중문·서귀포를 도는 날인데 패널 첫 항목이 한경면). 새 항목이 들어갈 자리
  (`itemInsertIndex`, #1175) 바로 앞에서 출발해 "그 다음 갈 곳" 을 고르는 화면으로 연다.
*/

const JUNGMUN: LatLng = { lat: 33.2539, lng: 126.4123 }
const SEOGWIPO: LatLng = { lat: 33.2465, lng: 126.5636 }
const AEWOL: LatLng = { lat: 33.4635, lng: 126.3105 }
const SEONGSAN: LatLng = { lat: 33.458, lng: 126.9425 }

const PLACE = { code: 'PLACE', name: '장소', description: null }
const LODGING = { code: 'LODGING', name: '숙박', description: null }
const MOVE = { code: 'MOVE', name: '이동', description: null }
const WALK = { code: 'WALK', name: '산책', description: null }

function at(
  day: number,
  sequence: number,
  coord: LatLng | null,
  itemType: PlanItemDetail['itemType'] = PLACE,
): PlanItemDetail {
  return planItem({
    planItemId: `i-${String(day)}-${String(sequence)}`,
    day,
    sequence,
    itemType,
    place: coord === null ? null : planItemPlace({ lat: coord.lat, lng: coord.lng }),
  })
}

function daysOf(items: PlanItemDetail[], totalDays = 3) {
  return groupItemsByDay(items, totalDays).days
}

describe('addPlaceFocus — 담기 지도의 기준점 (#1177)', () => {
  it('들어갈 자리 바로 앞 항목의 좌표다 — 그날 끝 숙소보다 앞선다', () => {
    const days = daysOf([
      at(2, 0, SEOGWIPO),
      at(2, 1, JUNGMUN),
      // 끝에 붙은 숙소 — 새 항목은 이 앞에 들어간다 (#1175)
      at(2, 2, AEWOL, LODGING),
    ])

    expect(addPlaceFocus(2, days)).toEqual(JUNGMUN)
  })

  it('자리 앞에 좌표가 없으면 더 앞으로 거슬러 올라간다', () => {
    const days = daysOf([at(2, 0, SEOGWIPO), at(2, 1, null)])

    expect(addPlaceFocus(2, days)).toEqual(SEOGWIPO)
  })

  /* `MOVE` 는 대상이 없어 좌표도 없다 — 건너뛰고 그 앞을 본다 */
  it('이동 항목은 건너뛴다', () => {
    const days = daysOf([at(2, 0, JUNGMUN), at(2, 1, null, MOVE)])

    expect(addPlaceFocus(2, days)).toEqual(JUNGMUN)
  })

  /* `WALK` 의 `place` 는 늘 null 이다 — 지도는 코스 시작점을 찍는다 (`planItemMapCoord`, #743) */
  it('올레 항목은 코스 시작점 좌표를 쓴다', () => {
    const walk = planItem({
      planItemId: 'w',
      day: 2,
      sequence: 0,
      itemType: WALK,
      place: null,
      walkCourse: planItemWalkCourse({ lat: SEONGSAN.lat, lng: SEONGSAN.lng }),
    })

    expect(addPlaceFocus(2, daysOf([walk]))).toEqual(SEONGSAN)
  })

  it('자리 앞에 좌표가 하나도 없으면 그날 숙소의 좌표다', () => {
    const days = daysOf([at(2, 0, null), at(2, 1, AEWOL, LODGING)])

    expect(addPlaceFocus(2, days)).toEqual(AEWOL)
  })

  it('숙박만 있는 날은 그 숙소다 — 들어갈 자리가 맨 앞이다', () => {
    expect(addPlaceFocus(2, daysOf([at(2, 0, AEWOL, LODGING)]))).toEqual(AEWOL)
  })

  it('그날에 좌표가 없으면 전날까지의 마지막 숙소다', () => {
    const days = daysOf([at(1, 0, SEONGSAN), at(1, 1, JUNGMUN, LODGING), at(2, 0, null)])

    expect(addPlaceFocus(2, days)).toEqual(JUNGMUN)
  })

  it('빈 날도 전날 숙소에서 연다', () => {
    const days = daysOf([at(1, 0, SEOGWIPO, LODGING)])

    expect(addPlaceFocus(2, days)).toEqual(SEOGWIPO)
  })

  /* 전날의 숙박이 아닌 장소는 출발점이 아니다 — `lodgingBasisFor` 와 같은 판단이다 */
  it('전날 숙소가 없으면 전날 장소로 가지 않고 null 이다', () => {
    const days = daysOf([at(1, 0, SEONGSAN)])

    expect(addPlaceFocus(2, days)).toBeNull()
  })

  it('아무 좌표도 없으면 null — 지금처럼 제주 기본 화면으로 연다', () => {
    expect(addPlaceFocus(1, daysOf([]))).toBeNull()
    expect(addPlaceFocus(1, daysOf([at(1, 0, null), at(1, 1, null, MOVE)]))).toBeNull()
  })

  it('기간 밖 일자는 null 이다', () => {
    expect(addPlaceFocus(9, daysOf([at(1, 0, JUNGMUN, LODGING)]))).toBeNull()
  })
})

/*
  **목록 보기도 같은 기준점이다** (#1217). 서버 프리페치와 클라이언트가 같은 함수를 봐야 캐시 키가
  맞는다 — 어긋나면 하이드레이션이 빗나가 첫 화면에서 목록을 한 번 더 받는다.
*/
describe('addPlaceListOrigin (#1217)', () => {
  it('상세를 아직 못 받았으면 undefined — 조회를 미룬다', () => {
    expect(addPlaceListOrigin(undefined, 1)).toBeUndefined()
  })

  it('받았으면 지도와 같은 기준점이다', () => {
    const items = [at(1, 1, JUNGMUN), at(1, 2, SEOGWIPO)]

    expect(addPlaceListOrigin({ items, totalDays: 2 }, 1)).toEqual(SEOGWIPO)
    expect(addPlaceListOrigin({ items, totalDays: 2 }, 1)).toEqual(
      addPlaceFocus(1, groupItemsByDay(items, 2).days),
    )
  })

  it('기준점이 없으면 null — 좌표 없이 placeId 순으로 연다', () => {
    expect(addPlaceListOrigin({ items: [], totalDays: 2 }, 1)).toBeNull()
  })
})

/*
  **기준점이 어디서 왔는지와 그 이름** (#1221). 목록 위 한 줄이 "어느 장소에서 잰 거리인가" 를 말한다 —
  `1.2km` 가 무엇으로부터인지 모르면 숫자가 판단에 쓰이지 않는다.
*/
describe('addPlaceFocusBasis — 기준점의 출처 (#1221)', () => {
  function named(
    day: number,
    sequence: number,
    coord: LatLng | null,
    title: string,
    itemType = PLACE,
  ) {
    return { ...at(day, sequence, coord, itemType), title }
  }

  it('자리 앞 항목이면 previous 와 그 항목이다', () => {
    const days = daysOf([
      named(2, 0, JUNGMUN, '카멜리아힐'),
      named(2, 1, AEWOL, '중문 펜션', LODGING),
    ])

    expect(addPlaceFocusBasis(2, days)).toMatchObject({
      kind: 'previous',
      coord: JUNGMUN,
      item: { title: '카멜리아힐' },
    })
  })

  it('자리 뒤(그날 끝 숙소)면 lodging 이다', () => {
    const days = daysOf([named(2, 0, null, '이름만'), named(2, 1, AEWOL, '중문 펜션', LODGING)])

    expect(addPlaceFocusBasis(2, days)).toMatchObject({
      kind: 'lodging',
      item: { title: '중문 펜션' },
    })
  })

  it('그날에 좌표가 없으면 전날 숙소 — previous-lodging 이다', () => {
    const days = daysOf([named(1, 0, SEOGWIPO, '애월 호텔', LODGING)])

    expect(addPlaceFocusBasis(2, days)).toMatchObject({
      kind: 'previous-lodging',
      coord: SEOGWIPO,
      item: { title: '애월 호텔' },
    })
  })

  it('없으면 null — addPlaceFocus 와 같은 점을 낸다', () => {
    const days = daysOf([named(2, 0, JUNGMUN, '카멜리아힐')])

    expect(addPlaceFocusBasis(3, days)).toBeNull()
    expect(addPlaceFocusBasis(2, days)?.coord).toEqual(addPlaceFocus(2, days))
  })

  it('목록용 진입도 같은 값이다 — 상세 없으면 undefined, 좌표는 addPlaceListOrigin 과 같다', () => {
    const items = [named(1, 0, JUNGMUN, '카멜리아힐')]

    expect(addPlaceListBasis(undefined, 1)).toBeUndefined()
    expect(addPlaceListBasis({ items, totalDays: 2 }, 1)?.coord).toEqual(
      addPlaceListOrigin({ items, totalDays: 2 }, 1),
    )
  })
})

describe('addPlaceNearbyCaption — 목록 위 한 줄 (#1221)', () => {
  function basis(
    kind: 'previous' | 'lodging' | 'previous-lodging',
    title: string,
    itemType = PLACE,
  ) {
    return { kind, coord: JUNGMUN, item: { ...at(2, 0, JUNGMUN, itemType), title } }
  }

  it('직전 장소는 이름만', () => {
    expect(addPlaceNearbyCaption(basis('previous', '카멜리아힐'))).toBe(
      '‘카멜리아힐’에서 가까운 순이에요.',
    )
  })

  it('그날 숙소 · 전날 숙소는 출처를 붙인다', () => {
    expect(addPlaceNearbyCaption(basis('lodging', '중문 펜션', LODGING))).toBe(
      '숙소 ‘중문 펜션’에서 가까운 순이에요.',
    )
    expect(addPlaceNearbyCaption(basis('previous-lodging', '애월 호텔', LODGING))).toBe(
      '전날 숙소 ‘애월 호텔’에서 가까운 순이에요.',
    )
  })

  /* 올레는 코스 전체가 아니라 시작점에서 잰다 (`planItemMapCoord`) — 그렇게 말한다 */
  it('올레는 시작점이라고 말한다', () => {
    expect(addPlaceNearbyCaption(basis('previous', '올레 7코스', WALK))).toBe(
      '‘올레 7코스’ 시작점에서 가까운 순이에요.',
    )
  })

  /*
    **긴 이름은 이름 안에서 줄인다.** 줄 끝을 말줄임하면 "가까운 순이에요" 가 잘려 문장이 무엇을
    말하는지 사라진다 — 이름만 줄이고 문장은 끝까지 남긴다.
  */
  it('긴 이름은 이름만 줄이고 문장은 끝까지 남긴다', () => {
    const caption = addPlaceNearbyCaption(
      basis('previous', '제주특별자치도립김창열미술관부속카페테리아'),
    )

    expect(caption).toBe('‘제주특별자치도립김창열미술관부속…’에서 가까운 순이에요.')
  })

  it('기준점이 없으면 null — 줄 자체가 없다', () => {
    expect(addPlaceNearbyCaption(null)).toBeNull()
  })

  it('문구는 메시지 모듈의 것이다', () => {
    expect(addPlaceNearbyCaption(basis('previous', 'A'))).toBe(
      messages.plan.addPlaceNearbyCaptionPrevious.replace('{name}', 'A'),
    )
  })
})

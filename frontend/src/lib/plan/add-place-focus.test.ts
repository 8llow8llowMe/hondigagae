import { describe, expect, it } from 'vitest'

import type { LatLng } from '@/lib/geo/coord'
import { addPlaceFocus, addPlaceListOrigin } from '@/lib/plan/add-place-focus'
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

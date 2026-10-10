import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  WALK_COURSE_NEARBY_LIMIT,
  WalkCourseNearbyPlaces,
} from '@/features/walk-course/walk-course-nearby-places'
import { messages } from '@/lib/messages'
import { placeSummary } from '@/test/fixtures/place'
import type { NearbyPlaceItem } from '@/types/place'

function item(id: string, title: string, distanceMeters = 500): NearbyPlaceItem {
  return { place: { ...placeSummary, placeId: id, title }, distanceMeters }
}

function render(places: NearbyPlaceItem[], loading = false): string {
  return renderToStaticMarkup(createElement(WalkCourseNearbyPlaces, { places, loading }))
}

describe('WalkCourseNearbyPlaces — 코스에서 나가는 길 (#826)', () => {
  it('받은 장소를 제목과 함께 그린다', () => {
    const markup = render([item('1', '김창열미술관'), item('2', '협재해수욕장')])

    expect(markup).toContain(messages.walkCourse.nearbyPlacesHeading)
    expect(markup).toContain('김창열미술관')
    expect(markup).toContain('협재해수욕장')
  })

  it('각 행이 장소 상세로 간다', () => {
    expect(render([item('212481712381923328', '김창열미술관')])).toContain(
      'href="/places/212481712381923328"',
    )
  })

  /**
   * **곁다리는 분량으로도 곁다리여야 한다.** 상세의 주된 행동은 `일정에 담기` 이고,
   * 이 섹션이 길어지면 코스 상세가 장소 목록 화면처럼 읽힌다. 서버는 최대 50건을
   * 내려 주므로(`NEARBY_MAX_SIZE`) 자르는 자리는 화면 쪽이다.
   */
  it(`${WALK_COURSE_NEARBY_LIMIT}개까지만 그린다`, () => {
    const many = Array.from({ length: WALK_COURSE_NEARBY_LIMIT + 3 }, (_, index) =>
      item(String(index), `장소${index}`),
    )
    const markup = render(many)

    expect(markup).toContain('장소0')
    expect(markup).toContain(`장소${WALK_COURSE_NEARBY_LIMIT - 1}`)
    expect(markup).not.toContain(`장소${WALK_COURSE_NEARBY_LIMIT}`)
  })

  /**
   * **0건·좌표 없음·조회 실패가 모두 같은 자리로 온다.** 호출부가 빈 배열을 넘기고,
   * 여기서는 섹션 자체를 만들지 않는다 — 곁다리에 `다시 시도` 를 달면 상세 화면의
   * 주된 행동이 흐려진다 (`indoor-alternatives-section` 과 같은 판단).
   */
  it('장소가 없으면 아무것도 그리지 않는다', () => {
    expect(render([])).toBe('')
  })

  /**
   * 비어 있을 때 사라지는 섹션이라 **로딩 골격도 사라질 수 있다.** 그 점프를 받아들이는
   * 이유는 반대쪽이 더 나쁘기 때문이다 — 골격이 없으면 스크롤을 내린 사람 아래로 섹션이
   * 뒤늦게 끼어들어 읽던 자리가 밀린다. 0건은 예외적인 경우다.
   */
  it('로딩 중에는 골격을 그린다', () => {
    const markup = render([], true)

    expect(markup).toContain(messages.walkCourse.nearbyPlacesHeading)
    expect(markup).toContain('animate-pulse')
  })

  /** 전체 보기 링크를 달지 않는다 — `/places` 는 URL 로 지도 중심을 받지 못한다 */
  it('목록 화면으로 보내는 링크를 달지 않는다', () => {
    const markup = render([item('1', '김창열미술관')])

    expect(markup).not.toContain('href="/places"')
  })
})

/*
  올레 코스는 장소 DB 에도 등록돼 있어 시작점 좌표 조회에 **자기 자신이 0m 로 잡힌다**
  (2026-09-22 dev 실측 29/29). 세 자리뿐인 섹션에서 한 자리를 언제나 잃던 자리다.
*/
describe('WalkCourseNearbyPlaces — 코스 자신을 빼다 (#826)', () => {
  it('0m 인 항목을 그리지 않는다 — 그것이 코스 자신이다', () => {
    const markup = render([
      item('self', '[제주올레 1코스] 시흥-광치기 올레', 0),
      item('near', '슌식당', 352),
    ])

    expect(markup).not.toContain('[제주올레 1코스]')
    expect(markup).toContain('슌식당')
  })

  it('자신을 뺀 자리를 다음 장소가 채운다 — 세 자리를 잃지 않는다', () => {
    const markup = render([
      item('self', '[제주올레 1코스] 시흥-광치기 올레', 0),
      item('a', '슌식당', 352),
      item('b', '목화휴게소', 626),
      item('c', '종달리 해안도로', 687),
    ])

    expect(markup).toContain('슌식당')
    expect(markup).toContain('목화휴게소')
    expect(markup).toContain('종달리 해안도로')
  })

  it('0m 뿐이면 섹션을 만들지 않는다', () => {
    expect(render([item('self', '[제주올레 1코스] 시흥-광치기 올레', 0)])).toBe('')
  })
})

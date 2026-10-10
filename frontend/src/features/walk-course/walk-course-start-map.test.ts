import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { WalkCourseStartMap } from '@/features/walk-course/walk-course-start-map'
import { levelForSpanMeters } from '@/lib/map/viewport'
import { messages } from '@/lib/messages'
import {
  WALK_COURSE_PLAIN,
  WALK_COURSE_WITH_COORDS,
  walkCourseDetail,
} from '@/test/fixtures/walk-course'
import { readSourceWithoutComments } from '@/test/source'

/**
 * 시작점 지도 — 이슈 [#782](https://github.com/8llow8llowMe/hondigagae/issues/782).
 *
 * 지도 캔버스 자체는 `dynamic(..., { ssr: false })` 라 **서버 렌더에 나오지 않는다**
 * (`place-mini-map.test.ts` 와 같은 전제). 여기서 고정하는 것은 **무엇을 그리고 무엇을
 * 그리지 않는가**의 판단이고, SDK 수명주기는 `MapCanvas` 의 몫이다.
 */
function render(course = walkCourseDetail(WALK_COURSE_WITH_COORDS)) {
  return renderToStaticMarkup(createElement(WalkCourseStartMap, { course }))
}

describe('WalkCourseStartMap — 좌표가 있을 때', () => {
  it('카카오맵 길찾기 링크를 함께 그린다', () => {
    const markup = render()

    expect(markup).toContain(messages.map.directions)
    expect(markup).toContain('map.kakao.com/link/to')
    // 링크 규격은 위도가 먼저다 (`lib/geo/map-link.ts`)
    expect(markup).toContain(`${WALK_COURSE_WITH_COORDS.lat},${WALK_COURSE_WITH_COORDS.lng}`)
  })

  it('외부 링크는 새 탭이고 opener 를 넘기지 않는다', () => {
    const markup = render()

    expect(markup).toContain('target="_blank"')
    expect(markup).toContain('rel="noopener noreferrer"')
  })

  /**
   * **목적지 이름은 코스 이름이다.** `startEndPoint` 는 `시흥리정류장-광치기해변` 처럼
   * 시점과 종점이 하이픈으로 붙어 있고 **갈라 쓰지 않기로 이미 정했다** (`코스상세-세부명세.md`
   * D4-2) — 그대로 넘기면 딥링크가 *종점까지 포함한 이름*으로 시작점을 가리킨다.
   */
  it('목적지 이름에 시종점 원문을 쓰지 않는다', () => {
    const markup = render()

    expect(markup).toContain(encodeURIComponent(`${WALK_COURSE_WITH_COORDS.courseLabel} 시작점`))
    expect(markup).not.toContain(encodeURIComponent(WALK_COURSE_WITH_COORDS.startEndPoint))
  })

  it('제목을 세운다 — 카드가 무엇인지 말한다', () => {
    expect(render()).toContain(messages.walkCourse.startMapHeading)
  })

  /**
   * #782 검토. SDK 실패는 `MapCanvas` 만 걷어내는데, 이 카드는 `PlaceMiniMap` 과 달리
   * **제목을 갖고 있어** 지도만 사라지면 제목이 약속한 것이 화면에 없다. 실패 문구가
   * 그 자리를 메운다 — 서버 렌더에서는 아직 실패 전이라 나오지 않는 것이 맞다.
   */
  it('실패 문구는 서버 렌더에 나오지 않는다 — 아직 실패하지 않았다', () => {
    expect(render()).not.toContain(messages.walkCourse.startMapUnavailable)
  })
})

describe('WalkCourseStartMap — 좌표가 없을 때', () => {
  /** 25/29 가 이 갈래다. 찍을 자리도 길찾기 링크도 없으므로 **절 전체가 사라진다** */
  it('아무것도 그리지 않는다', () => {
    expect(render(walkCourseDetail(WALK_COURSE_PLAIN))).toBe('')
  })
})

/*
  **경로 폴리라인을 그리지 않는다.** 응답에 코스 경로 좌표열이 없고 공개 원천에도 없다
  (`코스목록-세부명세.md` D9-3 · 커밋 `7df9d300`). 시작점 마커 하나만 찍는다 — 없는 데이터를
  이어 그리면 화면이 코스 경로를 아는 척한다.
*/
describe('WalkCourseStartMap — 그리지 않는 것', () => {
  const source = readSourceWithoutComments('src/features/walk-course/walk-course-start-map.tsx')

  it('경로 선을 넘기지 않는다 — 좌표열이 계약에 없다', () => {
    expect(source).not.toContain('routes')
    expect(source).not.toContain('Polyline')
  })

  it('SSR 을 끈다 — SDK 가 window 를 읽는다', () => {
    expect(source).toContain('ssr: false')
  })
})

/*
  **확대 단계가 중단점에서 튀지 않아야 한다** (`fe-map-reviewer` 검토, #782).

  `framedCamera` 는 `Math.min(width, height)` 로 단계를 역산하는데, 이 카드는 `h-44`(176)
  / `md:h-52`(208) 라 **짧은 변이 언제나 높이**다. 그래서 span 값이 두 높이 사이의 경계에
  걸리면 768px 을 한 칸 넘는 순간 확대가 한 단계 바뀌어 **보이는 면적이 4배로 점프한다.**

  첫 판의 3000 이 정확히 그 자리였다 — `16m/px × 176 = 2816 < 3000 ≤ 3328 = 16 × 208`.
  숫자를 주석으로만 지키면 다음 사람이 같은 자리를 다시 밟으므로 여기서 못박는다.
*/
describe('WalkCourseStartMap — 확대 단계 (#782)', () => {
  /** `h-44` · `md:h-52` — 카드가 쓰는 두 높이. 바꾸면 이 값도 같이 바꾼다 */
  const CARD_HEIGHTS_PX = [176, 208]

  function spanMetersInSource(): number {
    const source = readSourceWithoutComments('src/features/walk-course/walk-course-start-map.tsx')
    const match = /START_MAP_SPAN_METERS = (\d+)/.exec(source)

    expect(match).not.toBeNull()

    return Number(match?.[1])
  }

  it('두 카드 높이가 같은 확대 단계로 떨어진다', () => {
    const span = spanMetersInSource()
    const levels = CARD_HEIGHTS_PX.map((height) => levelForSpanMeters(span, height))

    expect(new Set(levels).size).toBe(1)
  })

  /**
   * 경계에 **붙어** 있으면 카드 높이를 몇 px 만 건드려도 다시 갈린다. 양쪽으로 여유를
   * 확인한다 — 같은 단계를 유지하는 span 범위 안에서 가운데에 가까운지.
   */
  it('경계에 붙어 있지 않다 — 높이를 조금 바꿔도 갈리지 않는다', () => {
    const span = spanMetersInSource()

    for (const height of CARD_HEIGHTS_PX) {
      expect(levelForSpanMeters(span, height - 16)).toBe(levelForSpanMeters(span, height))
      expect(levelForSpanMeters(span, height + 16)).toBe(levelForSpanMeters(span, height))
    }
  })
})

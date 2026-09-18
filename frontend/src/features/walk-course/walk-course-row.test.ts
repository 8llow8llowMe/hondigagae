import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { WalkCourseRow } from '@/features/walk-course/walk-course-row'
import {
  WALK_COURSE_MIXED_START_END,
  WALK_COURSE_PLAIN,
  WALK_COURSE_ROUND_DISTANCE,
  WALK_COURSE_WITH_COORDS,
} from '@/test/fixtures/walk-course'
import type { WalkCourseSummary } from '@/types/walk-course'

function render(course: WalkCourseSummary): string {
  return renderToStaticMarkup(createElement(WalkCourseRow, { course }))
}

describe('WalkCourseRow — 코스를 고르는 데 쓰는 값 셋', () => {
  it('이름표 · 구간명 · 거리 · 소요시간 · 시종점을 그린다', () => {
    const markup = render(WALK_COURSE_PLAIN)

    expect(markup).toContain('1코스')
    expect(markup).toContain('시흥-광치기')
    expect(markup).toContain('15.1km')
    expect(markup).toContain('4~5시간')
    expect(markup).toContain('시흥리정류장-광치기해변')
  })

  it('상세로 가는 링크다 — id 를 문자열 그대로 쓴다', () => {
    expect(render(WALK_COURSE_PLAIN)).toContain('/walk-courses/6911167100216303301')
  })

  /** `19` 를 `19km` 로 줄이면 같은 열의 `19.1` 과 자릿수가 어긋난다 (공통명세 S3) */
  it('정수 거리도 소수 1자리로 그린다', () => {
    expect(render(WALK_COURSE_ROUND_DISTANCE)).toContain('19.0km')
  })

  /**
   * **원문 그대로다** (D4-4). `제주민속촌주차장 입구-남원포구` 는 공백과 하이픈이 섞여
   * 있어 갈라 재조립하면 잘못 갈린다 — 화살표로 바꾸지도 않는다.
   */
  it('시종점을 원문 그대로 그린다 — 갈라 재조립하지 않는다', () => {
    const markup = render(WALK_COURSE_MIXED_START_END)

    expect(markup).toContain('제주민속촌주차장 입구-남원포구')
    expect(markup).not.toContain('제주민속촌주차장 입구 →')
  })
})

describe('WalkCourseRow — 이미지 (D1-1)', () => {
  /** 실측 29개 중 25개가 이 모양이다. 회색 타일 25개는 정보가 아니라 잡음이다 */
  it('firstImage 가 null 이면 썸네일 자리를 만들지 않는다', () => {
    expect(render(WALK_COURSE_PLAIN)).not.toContain('<img')
  })

  it('firstImage 가 있으면 썸네일을 그린다', () => {
    expect(render(WALK_COURSE_WITH_COORDS)).toContain('<img')
  })

  /** 바로 옆에 이름표가 글자로 있다 (D6) */
  it('썸네일의 alt 는 빈 문자열이다', () => {
    expect(render(WALK_COURSE_WITH_COORDS)).toContain('alt=""')
  })
})

describe('WalkCourseRow — 목록은 좌표 유무를 말하지 않는다 (D5-1)', () => {
  /**
   * 좌표는 *골든타임을 이어 볼 수 있는가*만 정한다. 25행에 그 사실을 적으면 코스를 고르는
   * 축과 무관한 정보가 화면의 4/5를 덮는다 — 그 말은 코스 상세가 한 줄로 한다.
   */
  it('좌표가 없는 행에 골든타임·날씨 낱말이 없다', () => {
    const markup = render(WALK_COURSE_PLAIN)

    expect(markup).not.toContain('골든타임')
    expect(markup).not.toContain('날씨')
  })

  it('좌표가 있는 행에도 그 사실을 적지 않는다 — 두 행이 같은 모양이다', () => {
    const markup = render(WALK_COURSE_WITH_COORDS)

    expect(markup).not.toContain('골든타임')
    expect(markup).not.toContain('날씨')
  })
})

describe('WalkCourseRow — 접근성 계약 (D6)', () => {
  /** 이름표만이면 `1코스` 가 29개라 구분되지 않고, 구간명만이면 사용자가 아는 번호가 사라진다 */
  it('링크의 접근 이름에 이름표와 구간명이 둘 다 들어 있다', () => {
    expect(render(WALK_COURSE_PLAIN)).toContain('aria-label="1코스 시흥-광치기"')
  })

  /** 이름에는 없지만 행 안의 텍스트로는 읽혀야 한다 */
  it('거리·소요시간을 aria-hidden 으로 감추지 않는다', () => {
    const markup = render(WALK_COURSE_PLAIN)

    expect(markup).not.toMatch(/aria-hidden[^>]*>[^<]*15\.1km/)
  })

  /** 44px — 모바일 최소 터치 영역 (DESIGN.md §7) */
  it('행 링크가 최소 터치 높이를 갖는다', () => {
    expect(render(WALK_COURSE_PLAIN)).toContain('min-h-11')
  })
})

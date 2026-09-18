import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it, vi } from 'vitest'

import {
  WalkCourseDetailInvalidId,
  WalkCourseDetailSection,
  type WalkCourseDetailSectionProps,
} from '@/features/walk-course/walk-course-detail-section'
import { mockWalkTimes } from '@/lib/api/mock/insight-data'
import { messages } from '@/lib/messages'
import {
  WALK_COURSE_MIXED_START_END,
  WALK_COURSE_PLAIN,
  WALK_COURSE_PROVIDER,
  WALK_COURSE_ROUND_DISTANCE,
  WALK_COURSE_WITH_COORDS,
  walkCourseDetail,
} from '@/test/fixtures/walk-course'

const WALK_TIMES = mockWalkTimes(null)

function render(overrides: Partial<WalkCourseDetailSectionProps> = {}): string {
  const props: WalkCourseDetailSectionProps = {
    course: walkCourseDetail(),
    loading: false,
    errorStatus: null,
    onRetry: vi.fn(),
    walkTimes: WALK_TIMES,
    walkTimesLoading: false,
    onWalkTimesRetry: vi.fn(),
    ...overrides,
  }

  return renderToStaticMarkup(createElement(WalkCourseDetailSection, props))
}

describe('WalkCourseDetailSection — 성공', () => {
  it('머리 · 출처 · 돌아가기를 그린다', () => {
    const markup = render()

    expect(markup).toContain('1코스')
    expect(markup).toContain('시흥-광치기')
    expect(markup).toContain(WALK_COURSE_PROVIDER)
    expect(markup).toContain(messages.walkCourse.backToList)
    expect(markup).toContain('/walk-courses')
  })

  /**
   * **좌표 없는 코스가 기본 모양이다** (실측 25/29). 골든타임 자리를 만들지 않고 한 줄만 남긴다.
   */
  it('좌표가 없으면 골든타임 자리가 없고 안내 한 줄이 선다', () => {
    const markup = render({ course: walkCourseDetail(WALK_COURSE_PLAIN) })

    expect(markup).not.toContain(messages.home.goldenHeading)
    expect(markup).toContain(messages.walkCourse.noCoordinates)
  })

  it('좌표가 있으면 골든타임 자리가 선다', () => {
    const markup = render({ course: walkCourseDetail(WALK_COURSE_WITH_COORDS) })

    expect(markup).toContain(messages.home.goldenHeading)
    expect(markup).not.toContain(messages.walkCourse.noCoordinates)
  })

  it('이미지가 없으면 전폭 미디어 자리를 만들지 않는다', () => {
    expect(render({ course: walkCourseDetail(WALK_COURSE_PLAIN) })).not.toContain('<img')
  })

  /** `19` 를 `19km` 로 줄이지 않는다 (공통명세 S3) */
  it('정수 거리도 소수 1자리로 그린다', () => {
    expect(render({ course: walkCourseDetail(WALK_COURSE_ROUND_DISTANCE) })).toContain('19.0km')
  })

  /** `제주민속촌주차장 입구-남원포구` 를 갈라 재조립하지 않는다 (D4-2) */
  it('시종점을 원문 그대로 그린다', () => {
    expect(render({ course: walkCourseDetail(WALK_COURSE_MIXED_START_END) })).toContain(
      '제주민속촌주차장 입구-남원포구',
    )
  })
})

describe('WalkCourseDetailSection — 404 (공통명세 S5)', () => {
  const NOT_FOUND = { errorStatus: 404, errorMessage: '존재하지 않는 산책 코스입니다.' }

  /**
   * **근거가 세 겹이다**: 규칙(`frontend/CLAUDE.md`) · 계약(`WalkCourseErrorCode` 가
   * `HttpStatus.NOT_FOUND` 로 못박혀 있다) · 실측(같은 id 로 두 번 물어 같은 404).
   */
  it('재시도 버튼이 없다', () => {
    expect(render(NOT_FOUND)).not.toContain(messages.common.retry)
  })

  it('서버 resultMessage 를 그대로 노출한다', () => {
    expect(render(NOT_FOUND)).toContain('존재하지 않는 산책 코스입니다.')
  })

  it('다음 행동으로 코스 목록을 준다', () => {
    expect(render(NOT_FOUND)).toContain(messages.walkCourse.backToList)
  })

  /** 코스를 못 받았으니 골든타임 요청도 자리도 없다 */
  it('골든타임 자리를 만들지 않는다', () => {
    expect(render(NOT_FOUND)).not.toContain(messages.home.goldenHeading)
  })

  /** 서버 문구가 비었을 때만 우리 문구로 떨어진다 */
  it('resultMessage 가 문자열이 아니면 대체 문구를 쓴다', () => {
    const markup = render({ errorStatus: 404, errorMessage: { message: '…' } })

    expect(markup).toContain(messages.walkCourse.detailNotFoundTitle)
  })
})

describe('WalkCourseDetailSection — 400 은 404 가 아니다 (D0-1)', () => {
  const INVALID = { errorStatus: 400, errorMessage: '요청 파라미터 형식이 올바르지 않습니다.' }

  it('재시도 버튼이 없다', () => {
    expect(render(INVALID)).not.toContain(messages.common.retry)
  })

  it('서버 resultMessage 와 코스 목록으로를 준다', () => {
    const markup = render(INVALID)

    expect(markup).toContain('요청 파라미터 형식이 올바르지 않습니다.')
    expect(markup).toContain(messages.walkCourse.backToList)
  })

  /** 주소를 보내기 전에 갈랐을 때(서버 컴포넌트)와 **같은 말**을 해야 한다 */
  it('보내기 전에 가른 화면도 같은 제목을 쓴다', () => {
    const markup = renderToStaticMarkup(createElement(WalkCourseDetailInvalidId, {}))

    expect(markup).toContain(messages.common.validationErrorTitle)
    expect(markup).toContain(messages.walkCourse.backToList)
    expect(markup).not.toContain(messages.common.retry)
  })
})

describe('WalkCourseDetailSection — 5xx·무응답에는 재시도가 있다', () => {
  it('503', () => {
    const markup = render({ errorStatus: 503 })

    expect(markup).toContain(messages.walkCourse.errorTitle)
    expect(markup).toContain(messages.common.retry)
  })

  it('무응답', () => {
    expect(render({ errorStatus: 0 })).toContain(messages.common.retry)
  })
})

describe('WalkCourseDetailSection — 접근성 계약 (D6)', () => {
  it('h1 이 하나이고 그 내용이 courseLabel 이다', () => {
    const markup = render()

    expect(markup.match(/<h1/g)).toHaveLength(1)
    expect(markup).toMatch(/<h1[^>]*>1코스<\/h1>/)
  })

  it('dl 안에 거리·소요시간 라벨이 글자로 있다', () => {
    const markup = render()

    expect(markup).toContain('<dl')
    expect(markup).toContain(messages.walkCourse.distanceLabel)
    expect(markup).toContain(messages.walkCourse.durationLabel)
  })

  /** `2025-04-28` 은 `Date` 로 읽으면 KST 기준 하루 밀린다 — 문자열 그대로 쓴다 (D4-3) */
  it('baseDate 를 원문 그대로 time 으로 감싼다', () => {
    // HTML 속성명은 대소문자를 가리지 않는다 — React 가 내는 그대로 단언한다
    expect(render()).toContain('<time dateTime="2025-04-28">2025-04-28</time>')
  })

  /** 상태 화면에도 제목은 있어야 한다 — 없는 코스 이름을 지어내지는 않는다 */
  it('404 화면에도 h1 이 하나 있다', () => {
    expect(render({ errorStatus: 404 }).match(/<h1/g)).toHaveLength(1)
  })

  /** 보조기기에서 목적지가 둘로 들리지 않게 한다 */
  it('404 화면에 코스 목록 링크가 하나뿐이다', () => {
    expect(render({ errorStatus: 404 }).match(/href="\/walk-courses"/g)).toHaveLength(1)
  })
})

describe('WalkCourseDetailSection — 로딩', () => {
  it('스켈레톤을 그리고 오류·빈 문구를 쓰지 않는다', () => {
    const markup = render({ course: null, loading: true })

    expect(markup).toContain('aria-busy')
    expect(markup).not.toContain(messages.walkCourse.errorTitle)
    expect(markup).not.toContain(messages.walkCourse.noCoordinates)
  })
})

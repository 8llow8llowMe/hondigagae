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
    authed: false,
    // 미로그인이 이 fixture 의 기본이다 — 그러면 반려견도 없다 (#777)
    petRegistered: false,
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
    expect(markup).toContain('/olle')
  })

  /*
    #783. 필터로 29개를 좁혀 놓고 상세에 들어갔다가 이 링크로 돌아오면 29개로 리셋됐다.
    브라우저 뒤로가기는 필터를 살려 돌아오므로 **화면 안 링크만 사용자를 배신했다.**
  */
  it('돌아가기가 들어온 필터를 그대로 돌려준다', () => {
    const markup = render({ backHref: '/olle?activity=LOW&sort=DISTANCE_ASC' })

    expect(markup).toContain('href="/olle?activity=LOW&amp;sort=DISTANCE_ASC"')
  })

  it('필터 없이 들어왔으면 목록 주소 그대로다', () => {
    expect(render()).toContain('href="/olle"')
  })

  /**
   * **좌표 없는 코스가 기본 모양이다** (실측 25/29). 그래서 자리를 걷지 않고 **제목을
   * 유지한 채** 안내 상자를 넣는다 ([#730](https://github.com/8llow8llowMe/hondigagae/issues/730)).
   */
  it('좌표가 없어도 골든타임 자리와 제목이 남고 안내 상자가 선다', () => {
    const markup = render({ course: walkCourseDetail(WALK_COURSE_PLAIN) })

    expect(markup).toContain(messages.home.goldenHeading)
    expect(markup).toContain(messages.walkCourse.noCoordinates)
    expect(markup).toContain(messages.walkCourse.noCoordinatesCommon)
  })

  it('좌표가 있으면 골든타임 자리가 선다', () => {
    const markup = render({ course: walkCourseDetail(WALK_COURSE_WITH_COORDS) })

    expect(markup).toContain(messages.home.goldenHeading)
    expect(markup).not.toContain(messages.walkCourse.noCoordinates)
  })

  it('이미지가 없으면 전폭 미디어 자리를 만들지 않는다', () => {
    expect(render({ course: walkCourseDetail(WALK_COURSE_PLAIN) })).not.toContain('<img')
  })

  /**
   * **히어로가 없으면 두 열로 가르지 않는다** (#730). 25/29 가 그 갈래라, 빈 좌측 열을
   * 만들면 이 이슈가 고치려는 증상(절반이 빈 화면)을 데스크톱에서 다시 만든다.
   */
  it('히어로가 없으면 1024 이상에서도 1열이다', () => {
    expect(render({ course: walkCourseDetail(WALK_COURSE_PLAIN) })).not.toContain('lg:grid-cols-2')
  })

  /** 히어로가 있는 4개는 좌표가 있는 바로 그 4개다 — 우측에 세울 것이 실제로 있다 */
  it('히어로가 있으면 1024 이상에서 2열로 가른다', () => {
    const markup = render({ course: walkCourseDetail(WALK_COURSE_WITH_COORDS) })

    expect(markup).toContain('<img')
    expect(markup).toContain('lg:grid-cols-2')
  })

  /** 16:9 상한 — 390 에서 ≈220px 이라 머리와 함께 접힘선 안에 든다 (#730) */
  it('히어로가 16:9 를 넘지 않는다', () => {
    expect(render({ course: walkCourseDetail(WALK_COURSE_WITH_COORDS) })).toContain('aspect-video')
  })

  /**
   * **출처는 CTA 아래다** (#730). 위에 있으면 버튼의 설명처럼 읽힌다 — 이것은 페이지
   * 데이터의 각주이지 그 버튼이 무엇을 하는지에 대한 말이 아니다.
   */
  it('출처 줄이 담기 버튼보다 뒤에 온다', () => {
    const markup = render({ authed: true })

    expect(markup.indexOf(WALK_COURSE_PROVIDER)).toBeGreaterThan(
      markup.indexOf(messages.plan.addToPlanAction),
    )
  })

  /**
   * **거리·소요시간은 고정 2열이다** (#730). `flex-wrap` 이던 동안에는 열 폭이 값의
   * 길이를 따라가 `19.0km` 옆에 `소요시간` 라벨이 바로 붙어 섰다.
   */
  it('지표 두 칸이 고정 2열 그리드다', () => {
    const markup = render()
    const at = markup.indexOf('<dl')

    expect(at).toBeGreaterThan(-1)
    expect(markup.slice(at, markup.indexOf('>', at))).toContain('grid-cols-2')
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

  /**
   * 담기 진입 (#620). **목록 행이 아니라 상세에만 둔다**
   * (`올레담기-세부명세.md` D8-1).
   */
  it('일정에 담기 버튼이 있다', () => {
    expect(render({ authed: true })).toContain(messages.plan.addToPlanAction)
  })

  /** 미로그인은 시트를 열지 않고 로그인으로 보낸다 (D4-1) — 버튼은 그대로 보인다 */
  it('미로그인이면 담기 버튼이 로그인으로 보낸다', () => {
    const markup = render({ authed: false })

    expect(markup).toContain(messages.plan.addToPlanAction)
    expect(markup).toContain('/login?returnTo=')
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

  /*
    #783. **오류 화면은 필터를 복원하지 않는다.** 코스를 못 받은 자리라 사용자가 어느
    목록에서 왔는지 화면이 주장할 근거가 없고, 잘못 주장하면 좁혀진 목록으로 보내 놓고
    "여기서 왔다" 고 말하는 셈이 된다.
  */
  it('오류 화면의 돌아가기는 필터를 싣지 않는다', () => {
    const markup = render({ ...NOT_FOUND, backHref: '/olle?activity=LOW' })

    expect(markup).toContain('href="/olle"')
    expect(markup).not.toContain('activity=LOW')
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
    expect(render({ errorStatus: 404 }).match(/href="\/olle"/g)).toHaveLength(1)
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

/*
  [#777](https://github.com/8llow8llowMe/hondigagae/issues/777) 의 **배선**만 본다. 안내의
  갈래와 문구는 `walk-course-golden-slot.test.ts` 가 본다 — 여기서 잠그는 것은 이 섹션이
  `petRegistered` 를 골든타임 자리로 **실제로 흘리는가** 다. 상수로 굳으면 안내가 로그인한
  사용자에게도 붙거나 아무에게도 안 붙는다.
*/
describe('WalkCourseDetailSection — 반려견 등록 안내 배선 (#777)', () => {
  const WITH_COORDS = { course: walkCourseDetail(WALK_COURSE_WITH_COORDS) }

  it('반려견이 없으면 골든타임 자리에 안내가 선다', () => {
    expect(render({ ...WITH_COORDS, petRegistered: false })).toContain(
      messages.home.guestVerdictNotice,
    )
  })

  it('반려견이 있으면 서지 않는다', () => {
    expect(render({ ...WITH_COORDS, authed: true, petRegistered: true })).not.toContain(
      messages.home.guestVerdictNotice,
    )
  })
})

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it, vi } from 'vitest'

import {
  WalkCourseDetailSection,
  type WalkCourseDetailSectionProps,
} from '@/features/walk-course/walk-course-detail-section'
import { WalkCourseSummaryHeader } from '@/features/walk-course/walk-course-summary-header'
import { mockWalkTimes } from '@/lib/api/mock/insight-data'
import { messages } from '@/lib/messages'
import {
  ACTIVITY_LEVELS_ALL,
  WALK_COURSE_PLAIN,
  WALK_COURSE_UNKNOWN_DURATION,
  walkCourseDetail,
} from '@/test/fixtures/walk-course'
import type { WalkCourseDetail } from '@/types/walk-course'

/**
 * 걸을 만한 활동량 한 줄 — `코스상세-세부명세.md` D5-3 · D6 · D7
 * ([#748](https://github.com/8llow8llowMe/hondigagae/issues/748)).
 *
 * `WalkCourseSummaryHeader` 는 훅을 쓰지 않아 node 환경에서 그대로 렌더된다
 * (`docs/testing-guide.md` §1).
 */
function render(course: WalkCourseDetail = walkCourseDetail()): string {
  return renderToStaticMarkup(createElement(WalkCourseSummaryHeader, { course }))
}

/** 소요시간을 아는 코스 (1코스 300분) — `보통`·`높음` 이 걸을 만하다 */
const KNOWN = walkCourseDetail()

/** **필수 회귀** — 소요시간을 아는데(120분) 세 값을 다 받는 코스 (10-1코스 모양) */
const KNOWN_ALL_THREE = walkCourseDetail(
  { ...WALK_COURSE_PLAIN, durationMaxMinutes: 120, durationText: '1~2시간' },
  ACTIVITY_LEVELS_ALL,
)

/** 소요시간을 모르는 코스 (20코스) — 어느 활동량에서도 걸러지지 않아 세 값이 담긴다 */
const UNKNOWN = walkCourseDetail(WALK_COURSE_UNKNOWN_DURATION, ACTIVITY_LEVELS_ALL)

const KNOWN_LINE = messages.walkCourse.activityFit.replace('{levels}', '보통 · 높음')
const ALL_THREE_LINE = messages.walkCourse.activityFit.replace('{levels}', '낮음 · 보통 · 높음')

describe('WalkCourseSummaryHeader — 활동량 한 줄 (아는 갈래)', () => {
  it('서버 name 을 이어 한 문장으로 그린다', () => {
    expect(render(KNOWN)).toContain(KNOWN_LINE)
  })

  /** 담기지 않은 값이 새지 않는다 — 300분 코스는 `낮음` 이 걸을 만하지 않다 */
  it('응답에 없는 활동량 이름이 나오지 않는다', () => {
    expect(render(KNOWN)).not.toContain('낮음')
  })

  it('아는 갈래에는 모르는 갈래 문구가 없다', () => {
    expect(render(KNOWN)).not.toContain(messages.walkCourse.activityFitUnknown)
  })

  /**
   * **필수 회귀** — `fitsActivityLevels.length === 3` 으로 갈래를 가르면 여기서 깨진다.
   * 서버 `fits` 가 `LOW ≤ 240분` 이라 **120분짜리 코스도 세 값을 받는다.**
   */
  it('세 값인데 소요시간을 아는 코스는 세 이름이 다 나온다', () => {
    const markup = render(KNOWN_ALL_THREE)

    expect(markup).toContain(ALL_THREE_LINE)
    expect(markup).not.toContain(messages.walkCourse.activityFitUnknown)
  })
})

describe('WalkCourseSummaryHeader — 활동량 한 줄 (모르는 갈래)', () => {
  /** **이 이슈의 본체** — 침묵도 배지 셋도 아니다 (D5-3 ①) */
  it('durationMaxMinutes 가 null 이면 부재를 한 줄로 설명한다', () => {
    expect(render(UNKNOWN)).toContain(messages.walkCourse.activityFitUnknown)
  })

  /** 세 값이 담겼다고 "아무 아이나 걷는다" 로 그리지 않는다 */
  it('활동량 이름이 셋 다 마크업에 없다', () => {
    const markup = render(UNKNOWN)

    for (const level of ACTIVITY_LEVELS_ALL) {
      expect(markup).not.toContain(level.name)
    }
  })

  it('아는 갈래 문장으로 새지 않는다', () => {
    expect(render(UNKNOWN)).not.toContain(ALL_THREE_LINE)
  })
})

describe('WalkCourseSummaryHeader — 빈 배열이면 줄을 그리지 않는다', () => {
  it('두 문구가 둘 다 없다', () => {
    const markup = render(walkCourseDetail(WALK_COURSE_UNKNOWN_DURATION, []))

    expect(markup).not.toContain(messages.walkCourse.activityFitUnknown)
    expect(markup).not.toContain('걸을 만한 코스예요')
  })
})

describe('WalkCourseSummaryHeader — 서버 metadata 를 그대로 렌더한다', () => {
  /**
   * FE 매핑 테이블이 생기면 깨진다 — 서버가 이름을 바꾸면 화면이 따라가야 한다
   * (`api-integration-guide.md` §6).
   */
  it('name 을 바꾼 fixture 의 문자열이 그대로 나온다', () => {
    const markup = render(
      walkCourseDetail(WALK_COURSE_PLAIN, [
        { code: 'MEDIUM', name: '보통(테스트)', description: null },
      ]),
    )

    expect(markup).toContain('보통(테스트)')
    expect(markup).not.toContain('MEDIUM')
  })
})

describe('WalkCourseSummaryHeader — 자리와 접근성 (D5-3 ④ · D6)', () => {
  /** `<dl>`(소요시간) 아래, 시종점 위다 */
  it('소요시간 뒤 · 시종점 앞에 선다', () => {
    const markup = render(KNOWN)
    const at = markup.indexOf(KNOWN_LINE)

    expect(at).toBeGreaterThan(markup.indexOf(messages.walkCourse.durationLabel))
    expect(at).toBeLessThan(markup.indexOf(messages.walkCourse.startEndLabel))
  })

  /**
   * **`<dl>` 은 여전히 칸이 둘이다.** 활동량이 셋째 칸으로 들어가면 고정 2열에서 반 칸을
   * 비운 채 걸린다 (#730 이 고친 배치).
   */
  it('dl 이 2열 그대로이고 dt 가 둘이다', () => {
    const markup = render(KNOWN)
    const at = markup.indexOf('<dl')

    expect(markup.slice(at, markup.indexOf('>', at))).toContain('grid-cols-2')
    expect(markup.match(/<dt/g)).toHaveLength(2)
  })

  /** 오류가 아니라 이 코스의 사실이다 — 진입마다 경고로 읽히면 안 된다 (D6) */
  it('두 갈래 어디에도 role="alert" 가 없다', () => {
    expect(render(KNOWN)).not.toContain('role="alert"')
    expect(render(UNKNOWN)).not.toContain('role="alert"')
  })

  /** 값이 낱말 나열이라 `<dd>` 로 읽히면 거리·소요시간과 같은 단일 지표로 들린다 */
  it('활동량 줄이 dl 밖의 p 다', () => {
    const markup = render(KNOWN)

    expect(markup.indexOf(KNOWN_LINE)).toBeGreaterThan(markup.indexOf('</dl>'))
  })
})

/**
 * **판정하지 않는다** (D5-3 ③). 여섯 칸 표가 **두 갈래로 접힌다** 는 단언이다 —
 * `authed` 는 담기 버튼만 가른다.
 */
const WALK_TIMES = mockWalkTimes(null)

function renderSection(overrides: Partial<WalkCourseDetailSectionProps> = {}): string {
  const props: WalkCourseDetailSectionProps = {
    course: walkCourseDetail(),
    loading: false,
    errorStatus: null,
    onRetry: vi.fn(),
    walkTimes: WALK_TIMES,
    walkTimesLoading: false,
    onWalkTimesRetry: vi.fn(),
    authed: false,
    ...overrides,
  }

  return renderToStaticMarkup(createElement(WalkCourseDetailSection, props))
}

describe('활동량 줄 — 누가 보든 같다 (D5-3 ③)', () => {
  it('미로그인과 로그인의 활동량 줄이 같다', () => {
    expect(renderSection({ authed: false })).toContain(KNOWN_LINE)
    expect(renderSection({ authed: true })).toContain(KNOWN_LINE)
  })

  it('모르는 갈래도 로그인 여부로 갈리지 않는다', () => {
    expect(renderSection({ authed: false, course: UNKNOWN })).toContain(
      messages.walkCourse.activityFitUnknown,
    )
    expect(renderSection({ authed: true, course: UNKNOWN })).toContain(
      messages.walkCourse.activityFitUnknown,
    )
  })

  /** 이 화면에는 반려견 축이 하나도 서 있지 않다 — 이름이 마크업에 없다 */
  it('어느 갈래에도 반려견 이름이 없다', () => {
    for (const course of [KNOWN, KNOWN_ALL_THREE, UNKNOWN]) {
      expect(render(course)).not.toContain('몽실이')
    }
  })

  /**
   * **등록 유도를 활동량 줄에 붙이지 않는다.** (a) 를 택했으므로 반려견을 등록해도 이 줄은
   * 한 글자도 바뀌지 않는다 — 홈·장소 상세의 유도가 성립하는 조건이 여기서는 없다.
   */
  it('반려견 등록 유도 문구가 없다', () => {
    for (const authed of [false, true]) {
      const markup = renderSection({ authed, course: UNKNOWN })

      expect(markup).not.toContain(messages.home.guestVerdictNotice)
      expect(markup).not.toContain(messages.place.detailGuestCta)
    }
  })

  /**
   * **두 안내는 서로 다른 사실이다** (D5-3 ④). 한쪽을 다른 쪽의 유무로 감추면 화면의
   * 고백이 무관한 필드에 따라 달라진다.
   */
  it('좌표도 없고 소요시간도 모르는 코스는 두 안내가 다 선다', () => {
    const markup = renderSection({ course: UNKNOWN })

    expect(markup).toContain(messages.walkCourse.activityFitUnknown)
    expect(markup).toContain(messages.walkCourse.noCoordinates)
  })
})

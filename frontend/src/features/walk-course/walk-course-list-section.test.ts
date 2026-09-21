import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it, vi } from 'vitest'

import {
  WalkCourseListSection,
  type WalkCourseListSectionProps,
} from '@/features/walk-course/walk-course-list-section'
import { messages } from '@/lib/messages'
import {
  WALK_COURSE_PLAIN,
  WALK_COURSE_PROVIDER,
  WALK_COURSE_WITH_COORDS,
} from '@/test/fixtures/walk-course'

function render(overrides: Partial<WalkCourseListSectionProps> = {}): string {
  const props: WalkCourseListSectionProps = {
    courses: [WALK_COURSE_PLAIN],
    totalCount: 1,
    basis: null,
    providerName: WALK_COURSE_PROVIDER,
    loading: false,
    errorStatus: null,
    onRetry: vi.fn(),
    onShowAll: vi.fn(),
    ...overrides,
  }

  return renderToStaticMarkup(createElement(WalkCourseListSection, props))
}

/*
  #783. **중간 단계가 prop 을 떨어뜨려도 양끝 테스트는 통과한다.** 행(`walk-course-row`)과
  상세(`walk-course-detail-section`)는 각자 단언돼 있지만, `WalkCourseListBody` 의
  `Pick<>` 목록에서 `filters` 가 빠지면 그 사이에서 조용히 사라진다 — 여기서 관통을 잡는다.
*/
describe('WalkCourseListSection — 조건을 행까지 흘린다 (#783)', () => {
  it('행 링크가 지금 보고 있는 조건을 달고 나간다', () => {
    const markup = render({ filters: { activity: 'LOW', sort: 'DISTANCE_ASC' } })

    expect(markup).toContain('?activity=LOW&amp;sort=DISTANCE_ASC')
  })

  it('조건을 주지 않으면 쿼리 없이 나간다', () => {
    expect(render()).not.toContain('?activity=')
  })
})

describe('WalkCourseListSection — 성공', () => {
  it('개수와 행을 그린다', () => {
    const markup = render({ courses: [WALK_COURSE_PLAIN], totalCount: 29 })

    expect(markup).toContain('코스 29개')
    expect(markup).toContain('시흥-광치기')
  })

  /** 출처 문자열을 FE 가 만들지 않는다 (`api-integration-guide.md` §6) */
  it('출처를 서버 providerName 그대로 그린다', () => {
    expect(render()).toContain(WALK_COURSE_PROVIDER)
  })

  /** 커서가 없어 "더 볼 것" 이라는 개념 자체가 없다 (공통명세 S3) */
  it('무한 스크롤 끝맺음 줄을 쓰지 않는다', () => {
    expect(render()).not.toContain(messages.common.listEnd)
  })
})

describe('WalkCourseListSection — 기준 줄은 응답이 정한다 (S4-1 규칙 5)', () => {
  it('적용됐으면 반려견 이름·활동량 이름·상한을 적는다', () => {
    const markup = render({
      basis: { petName: '몽실이', levelName: '낮음', maxDurationMinutes: 240 },
    })

    expect(markup).toContain('몽실이')
    // 서버 enum metadata 의 name 을 그대로 쓴다 — FE 매핑 테이블이 아니다
    expect(markup).toContain('낮음')
    expect(markup).toContain('4시간')
  })

  it('적용되지 않았으면 줄 자체를 만들지 않는다', () => {
    const markup = render({ basis: null })

    expect(markup).not.toContain('기준으로')
  })

  /**
   * **상한 숫자는 응답이 정한다** (#735). 화면이 `240 → 4시간` 을 제 상수로 갖고 있으면
   * 서버가 상한을 바꿔도 같은 숫자를 그린다 — 다른 값을 넣어 그 복제본이 없음을 잠근다.
   */
  it('상한이 바뀌면 문구도 따라간다 — FE 상수가 아니다', () => {
    const markup = render({
      basis: { petName: null, levelName: '보통', maxDurationMinutes: 270 },
    })

    expect(markup).toContain('4시간 30분')
    expect(markup).not.toContain('6시간')
  })

  /** 세그먼트로 직접 골랐거나 대표견 조회가 실패한 경우 — 없는 이름을 지어내지 않는다 */
  it('반려견을 모르면 이름 없는 문장으로 떨어진다', () => {
    const markup = render({
      basis: { petName: null, levelName: '보통', maxDurationMinutes: 360 },
    })

    expect(markup).toContain('6시간')
    // 활동량 이름은 남는다 — 응답이 준 값이라 지어낸 것이 아니다
    expect(markup).toContain('활동량(보통)')
    expect(markup).not.toContain('몽실이')
  })
})

describe('WalkCourseListSection — 0건은 404 가 아니다 (공통명세 S5)', () => {
  /**
   * **목록의 "0개" 는 200 + 빈 배열이다.** `resultMessage` 자체가 없으므로 404 문구를
   * 재활용하면 **빈 문구가 나간다.** 두 상태를 한 컴포넌트로 합치지 않는 이유다.
   */
  it('조건 0건에 전용 문구와 다음 행동을 준다', () => {
    const markup = render({ courses: [], totalCount: 0 })

    expect(markup).toContain(messages.walkCourse.emptyTitle)
    expect(markup).toContain(messages.walkCourse.emptyDescription)
    expect(markup).toContain(messages.walkCourse.emptyAction)
  })

  it('조건 0건에 재시도 버튼이 없다', () => {
    expect(render({ courses: [], totalCount: 0 })).not.toContain(messages.common.retry)
  })

  /** 404 문구를 빌려 쓰면 여기서 걸린다 */
  it('조건 0건이 상세의 404 문구를 쓰지 않는다', () => {
    const markup = render({ courses: [], totalCount: 0 })

    expect(markup).not.toContain(messages.walkCourse.detailNotFoundTitle)
  })

  /** 0건에는 출처를 세울 근거가 없다 */
  it('조건 0건에는 출처 줄을 그리지 않는다', () => {
    expect(render({ courses: [], totalCount: 0 })).not.toContain(WALK_COURSE_PROVIDER)
  })
})

describe('WalkCourseListSection — 오류 분기 (D5)', () => {
  it('5xx 에는 재시도가 있다', () => {
    const markup = render({ errorStatus: 503 })

    expect(markup).toContain(messages.walkCourse.errorTitle)
    expect(markup).toContain(messages.common.retry)
  })

  it('무응답에도 재시도가 있다', () => {
    expect(render({ errorStatus: 0 })).toContain(messages.common.retry)
  })

  /** 손으로 고친 URL 이라 같은 요청은 같은 400 이다 — 재시도가 아무것도 바꾸지 못한다 */
  it('400 에는 재시도가 없고 서버 resultMessage 를 그대로 노출한다', () => {
    const markup = render({
      errorStatus: 400,
      errorMessage: 'petActivityLevel 파라미터 형식이 올바르지 않습니다.',
    })

    expect(markup).toContain('petActivityLevel 파라미터 형식이 올바르지 않습니다.')
    expect(markup).toContain(messages.walkCourse.emptyAction)
    expect(markup).not.toContain(messages.common.retry)
  })

  it('오류에는 개수도 출처도 말하지 않는다', () => {
    const markup = render({ errorStatus: 503, totalCount: 29 })

    expect(markup).not.toContain('코스 29개')
    expect(markup).not.toContain(WALK_COURSE_PROVIDER)
  })
})

describe('WalkCourseListSection — 로딩', () => {
  it('스켈레톤만 그리고 개수를 말하지 않는다', () => {
    const markup = render({ loading: true, courses: [], totalCount: 0 })

    expect(markup).toContain('aria-busy')
    expect(markup).not.toContain('코스 0개')
    expect(markup).not.toContain(messages.walkCourse.emptyTitle)
  })
})

describe('WalkCourseListSection — 좁힌 결과에 날씨를 볼 코스가 없을 때 (D8-2)', () => {
  /**
   * 실측에서 `LOW`(4시간 이내)가 그 경우다 — 좌표 있는 넷이 전부 걸러진다.
   * **`activity === 'LOW'` 로 판정하지 않는다**: 데이터에서 읽어야 적재(#383) 후 저절로 사라진다.
   */
  it('필터가 걸렸고 좌표 있는 코스가 하나도 없으면 한 줄로 알린다', () => {
    const markup = render({
      courses: [WALK_COURSE_PLAIN],
      basis: { petName: '몽실이', levelName: '낮음', maxDurationMinutes: 240 },
    })

    expect(markup).toContain(messages.walkCourse.noGoldenInScope)
  })

  it('좌표 있는 코스가 하나라도 있으면 그 줄을 세우지 않는다', () => {
    const markup = render({
      courses: [WALK_COURSE_PLAIN, WALK_COURSE_WITH_COORDS],
      basis: { petName: '몽실이', levelName: '낮음', maxDurationMinutes: 240 },
    })

    expect(markup).not.toContain(messages.walkCourse.noGoldenInScope)
  })

  /** 좁히지 않은 목록(29개)에는 좌표 있는 코스가 있으므로 이 줄이 설 이유가 없다 */
  it('필터가 걸리지 않았으면 그 줄을 세우지 않는다', () => {
    const markup = render({ courses: [WALK_COURSE_PLAIN], basis: null })

    expect(markup).not.toContain(messages.walkCourse.noGoldenInScope)
  })
})

describe('WalkCourseListSection — 접근성 계약 (D6)', () => {
  /** 세그먼트가 URL 을 바꾸고 목록이 통째로 갈리는데, 보조기기에는 이 줄이 유일한 신호다 */
  it('결과 수를 aria-live 로 알린다', () => {
    expect(render()).toContain('aria-live="polite"')
  })

  it('도구는 밖에서 받은 것을 그대로 머리에 세운다', () => {
    const markup = render({ tools: createElement('span', null, '걷는 시간 컨트롤') })

    expect(markup).toContain('걷는 시간 컨트롤')
  })
})

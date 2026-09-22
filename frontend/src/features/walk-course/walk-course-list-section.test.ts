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
  WALK_COURSE_UNKNOWN_DURATION,
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

/*
  #776. **기준 줄은 보여 준 코스가 아니라 거른 기준을 말한다** (명세 D5-3).

  서버 `WalkCourseActivityFit.fits` 는 `durationMaxMinutes === null` 을 **어느 활동량에서도
  걸러내지 않는다** — 모르는 것을 나쁜 것으로 판정해 지우면 사용자는 그 코스가 있다는 것조차
  모르기 때문이고, 그 규칙은 바꾸지 않는다. 그래서 `LOW`(4시간)로 좁힌 목록에도 **4시간을
  넘을 수도 있는 코스가 섞여 나온다.**

  **지금 깨진 화면을 잡는 테스트가 아니다.** dev 실측(2026-09-21)은 29개 전부 파싱돼 미상이
  0건이라, 옛 문장(`4시간 이내 코스만 보여 줘요`)도 오늘은 우연히 참이었다. 적재(#722·#383)가
  파싱 실패 코스를 하나 들여오는 순간 문구가 조용히 거짓이 되는 것을 여기서 막는다.
*/
describe('WalkCourseListSection — 기준 줄이 데이터보다 강하게 말하지 않는다 (#776)', () => {
  const LOW_BASIS = { petName: '몽실이', levelName: '낮음', maxDurationMinutes: 240 }
  const MIXED = [WALK_COURSE_PLAIN, WALK_COURSE_UNKNOWN_DURATION]

  it('미상 코스가 섞인 목록에서 "이내 코스만" 이라고 단정하지 않는다', () => {
    const markup = render({ courses: MIXED, totalCount: 2, basis: LOW_BASIS })

    // 보여 준 코스 **전부**에 대한 단정 — 미상 코스가 하나만 섞여도 거짓이 된다
    expect(markup).not.toContain('이내 코스만')
    // 대신 거른 기준을 말한다. 서버는 "넘는다고 아는 것" 만 뺀다 — 미상은 그것이 아니다
    expect(markup).toContain('4시간이 넘는 코스는 빼고')
  })

  /**
   * **판정 ②** — 행에서 미상 갈래를 구분하지 않는다 (D5-3). 코스는 목록에서 사라지지 않고
   * `durationText` **원문**이 그대로 선다. 행에 새 배지·새 낱말을 만들지 않았다는 잠금이다.
   */
  it('미상 코스를 목록에서 지우지도, 행에 새 표시를 달지도 않는다', () => {
    const markup = render({ courses: MIXED, totalCount: 2, basis: LOW_BASIS })

    expect(markup).toContain(WALK_COURSE_UNKNOWN_DURATION.name)
    expect(markup).toContain(WALK_COURSE_UNKNOWN_DURATION.durationText)
  })

  /** 이름이 빠져도 **약속의 세기는 같다** — 갈리면 같은 화면이 두 가지를 약속하게 된다 */
  it('반려견 이름 없는 갈래도 같은 세기로 말한다', () => {
    const markup = render({
      courses: MIXED,
      totalCount: 2,
      basis: { ...LOW_BASIS, petName: null },
    })

    expect(markup).not.toContain('이내 코스만')
    expect(markup).toContain('4시간이 넘는 코스는 빼고')
  })

  /**
   * 미로그인·`전체` 갈래 — **기준 줄 자체가 없다** (공통명세 S4-1 규칙 5). 이 변경의 대상이
   * 아니라는 것을 잠근다: 약속을 바꾼 것이지 없던 자리에 새 약속을 만든 것이 아니다.
   */
  it('기준 줄이 없는 갈래에는 약속 자체가 서지 않는다', () => {
    const markup = render({ courses: MIXED, totalCount: 2, basis: null })

    expect(markup).not.toContain('넘는 코스는 빼고')
    expect(markup).not.toContain('이내 코스만')
    expect(markup).toContain(WALK_COURSE_UNKNOWN_DURATION.name)
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

/**
 * 목록이 이것이 제주올레라는 것을 말한다 — 이슈 [#811](https://github.com/8llow8llowMe/hondigagae/issues/811).
 *
 * `pageDescription` 은 정의만 돼 있고 **목록 화면에는 렌더되지 않았다.** `Surface` 의
 * `description` 슬롯을 개수 줄과 기준 줄이 쓰고 있었기 때문이다. 화면이 무엇을 무슨
 * 기준으로 고르는 곳인지 말해 주는 자리가 목록에 없었다.
 */
describe('WalkCourseListSection — 설명 줄 (#811)', () => {
  it('무엇을 무슨 기준으로 고르는 곳인지 말한다', () => {
    expect(render()).toContain(messages.walkCourse.listDescription)
  })

  /**
   * **조건과 무관한 줄이라 로딩·오류에서도 남는다.** 개수·기준은 셀 수 없을 때 사라지는데
   * (`countable`), 그 갈래에서 슬롯이 통째로 비면 **스켈레톤 화면에 제목만 남는다** —
   * 처음 들어온 사람이 가장 오래 보는 화면이 그것이다.
   */
  it('로딩 중에도 남는다 — 개수는 사라진다', () => {
    const markup = render({ loading: true })

    expect(markup).toContain(messages.walkCourse.listDescription)
    expect(markup).not.toContain('코스 1개')
  })

  it('오류에서도 남는다', () => {
    expect(render({ errorStatus: 500 })).toContain(messages.walkCourse.listDescription)
  })

  /**
   * **`aria-live` 는 바뀌는 줄에만 붙인다** (D6). 고정 문구에 붙으면 조건을 만질 때마다
   * 같은 문장이 다시 읽힌다 — 정작 알려야 할 결과 수가 그 안에 묻힌다.
   */
  /**
   * **제목을 되풀이하지 않는다.** 바로 위 `h2` 가 `제주올레 코스` 라고 말하므로 부제까지
   * 그 말을 하면 같은 자리가 같은 말을 두 번 한다. 대상어가 필요한 자리(404 · 400 ·
   * `meta description`)는 `pageDescription` 이 따로 맡는다.
   */
  it('제목에 있는 말을 되풀이하지 않는다', () => {
    expect(messages.walkCourse.listDescription).not.toContain(messages.walkCourse.pageTitle)
    expect(messages.walkCourse.pageDescription).toContain(messages.walkCourse.pageTitle)
  })

  it('설명 줄은 aria-live 가 아니다', () => {
    const markup = render()
    const paragraph =
      markup.split('<p').find((part) => part.includes(messages.walkCourse.listDescription)) ?? ''

    // 못 찾으면 빈 문자열이라 헛되이 통과한다 — 찾았다는 것부터 단언한다
    expect(paragraph).not.toBe('')
    expect(paragraph).not.toContain('aria-live')
    expect(markup.match(/aria-live/g)).toHaveLength(1)
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

/*
  #800. **로딩과 결과가 같은 골격이어야 전환에서 줄이 튀지 않는다.**

  높이를 문자열로 잴 수는 없으니 **골격을 만드는 클래스**를 잠근다 — 1024 실측에서 고치기
  전 스켈레톤은 101px, 실제 행은 73px 이었다(6행이면 168px). 카드로 바뀌어도(#837) 규칙은
  같고, 잠글 클래스만 카드의 것으로 옮겼다.
*/
describe('WalkCourseListSection — 로딩 골격이 실제 카드와 같다 (#800 · #837)', () => {
  const CARD = 'border-border bg-bg block h-full'
  const GRID = 'grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-3'

  it('스켈레톤이 실제 카드와 같은 상자 클래스를 쓴다', () => {
    expect(render({ loading: true })).toContain(CARD)
    expect(render()).toContain(CARD)
  })

  it('두 상태가 같은 그리드에 선다 — 열 수가 바뀌면 전환에서 카드가 옮겨 앉는다', () => {
    expect(render({ loading: true })).toContain(GRID)
    expect(render()).toContain(GRID)
  })

  /**
   * **사진 자리를 로딩에도 만든다** (#837 에서 뒤집은 자리). 표 시절에는 29개 중 25개에
   * 이미지가 없어 자리를 비워 두는 쪽이 맞았는데, 29/29 가 된 지금은 카드에서 가장 큰
   * 덩어리라 비워 두면 그만큼 점프한다.
   */
  it('사진 자리가 로딩에도 있다', () => {
    /*
      기본 fixture(`WALK_COURSE_PLAIN`)는 `firstImage` 가 null 이라 결과 쪽 사진은
      이미지를 가진 fixture 로 잰다 — 그래야 "둘 다 사진 자리를 만든다" 가 성립한다.
    */
    expect(render({ loading: true })).toContain('aspect-16/10')
    expect(render({ courses: [WALK_COURSE_WITH_COORDS] })).toContain('aspect-16/10')
  })

  /**
   * **열 머리가 사라졌다** (#837). 표였을 때는 결과에만 있으면 전환 순간 한 줄이 끼어들어
   * 아래가 통째로 밀렸는데(그래서 로딩에도 세웠다), 카드 그리드에는 머리가 없다.
   *
   * **`columnCourseLabel`(`코스`)로 재지 않는다** — 그 낱말은 제목(`제주올레 코스`)과
   * 캡션(`코스 29개`)에도 있어 열 머리가 사라져도 초록이 되는 false-green 이었다.
   * 열 머리만의 흔적인 그리드 클래스로 잰다.
   */
  it('열 머리를 그리지 않는다', () => {
    expect(render({ loading: true })).not.toContain('walk-course-row-grid')
    expect(render()).not.toContain('walk-course-row-grid')
  })
})

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it, vi } from 'vitest'

import {
  WalkCourseActivityField,
  WalkCourseSortField,
} from '@/features/walk-course/walk-course-filter-fields'
import { messages } from '@/lib/messages'
import type { WalkCourseActivityParam, WalkCourseSort } from '@/types/walk-course'

function renderActivity(applied: WalkCourseActivityParam | null): string {
  return renderToStaticMarkup(
    createElement(WalkCourseActivityField, { applied, onChange: vi.fn() }),
  )
}

function renderSort(sort: WalkCourseSort | null): string {
  return renderToStaticMarkup(createElement(WalkCourseSortField, { sort, onChange: vi.fn() }))
}

describe('WalkCourseActivityField — 활동량', () => {
  it('전체와 활동량 둘을 그린다', () => {
    const markup = renderActivity(null)

    expect(markup).toContain(messages.walkCourse.activityAll)
    expect(markup).toContain('낮음')
    expect(markup).toContain('보통')
  })

  /**
   * **상한 숫자를 컨트롤이 말하지 않는다** (#735). 응답은 *적용된* 상한 하나만 내려주므로
   * (`appliedPetActivityLevel`) 아직 고르지 않은 칸의 `4시간`·`6시간` 은 FE 복제본일 수밖에
   * 없었다. 고른 뒤 기준 줄이 서버 값으로 말한다.
   */
  it('선택지에 상한 시간을 적지 않는다', () => {
    const markup = renderActivity(null)

    expect(markup).not.toContain('4시간')
    expect(markup).not.toContain('6시간')
  })

  /** 라벨은 등록 폼과 **같은 목록**에서 온다 — 표를 두 벌 두면 화면마다 다른 말을 한다 */
  it('활동량 이름을 반려견 등록 폼과 같은 목록에서 가져온다', () => {
    const markup = renderActivity(null)
    const low = messages.pet.options.activityLevel.find((option) => option.code === 'LOW')?.name

    expect(low).toBeDefined()
    expect(markup).toContain(low)
  })

  /**
   * **`HIGH` 칸이 없다.** 결과가 필터 없음과 같은데(실측 29/29) 보내면
   * `appliedPetActivityLevel` 이 채워져 화면이 좁히지도 않은 것을 좁혔다고 말한다.
   * 그 뜻을 갖는 칸은 `전체` 하나뿐이다 (공통명세 S4-1 규칙 3).
   */
  it('HIGH 칸을 두지 않는다 — 전체가 그 자리다', () => {
    const markup = renderActivity(null)

    expect(markup).not.toContain('HIGH')
    expect(markup).not.toContain('높음')
  })

  /**
   * **URL 값이 아니라 적용된 값을 가리킨다.** URL 이 비면 서버가 대표견으로 채우므로,
   * URL 만 보면 실제로 좁혀진 화면에서 아무 칸도 선택돼 있지 않다.
   */
  it('적용된 값이 없으면 전체가 선택된다', () => {
    const markup = renderActivity(null)
    const [first] = markup.split('</button>')

    expect(first).toContain('aria-checked="true"')
    expect(first).toContain(messages.walkCourse.activityAll)
  })

  it('LOW 가 적용됐으면 낮음이 선택된다', () => {
    const markup = renderActivity('LOW')
    const selected = markup.split('</button>').find((part) => part.includes('aria-checked="true"'))

    expect(selected).toContain('낮음')
  })

  it('MEDIUM 이 적용됐으면 보통이 선택된다', () => {
    const markup = renderActivity('MEDIUM')
    const selected = markup.split('</button>').find((part) => part.includes('aria-checked="true"'))

    expect(selected).toContain('보통')
  })
})

describe('WalkCourseSortField — 정렬', () => {
  it('계약 4종 중 둘만 노출한다 (D8-4)', () => {
    const markup = renderSort(null)

    expect(markup).toContain(messages.walkCourse.sortCourseNo)
    expect(markup).toContain(messages.walkCourse.sortDistanceAsc)
    expect(markup.match(/role="radio"/g)).toHaveLength(2)
  })

  it('기본값이면 코스 순이 선택된다', () => {
    const [first] = renderSort(null).split('</button>')

    expect(first).toContain('aria-checked="true"')
  })

  it('짧은 순을 고르면 그 칸이 선택된다', () => {
    const selected = renderSort('DISTANCE_ASC')
      .split('</button>')
      .find((part) => part.includes('aria-checked="true"'))

    expect(selected).toContain(messages.walkCourse.sortDistanceAsc)
  })
})

describe('세그먼트 접근성 계약 (D6)', () => {
  it('축 이름을 그룹에 적는다', () => {
    expect(renderActivity(null)).toContain('aria-label="활동량"')
    expect(renderSort(null)).toContain('aria-label="정렬"')
  })

  /** 배타 축이라 라디오다 — 칩으로 두면 여러 개를 켤 수 있다고 읽힌다 */
  it('배타 축이라 radiogroup 이다', () => {
    expect(renderActivity(null)).toContain('role="radiogroup"')
  })

  /** 색만으로 선택을 표시하지 않는다 — aria-checked 와 weight 가 함께 선다 */
  it('선택을 색 class 만으로 표시하지 않는다', () => {
    const selected = renderActivity('LOW')
      .split('</button>')
      .find((part) => part.includes('aria-checked="true"'))

    expect(selected).toContain('font-semibold')
  })

  /** 44px — 모바일 최소 터치 영역 (DESIGN.md §7) */
  it('칸이 최소 터치 높이를 갖는다', () => {
    expect(renderActivity(null)).toContain('h-11')
  })
})

describe('두 축이 서로 다른 컨트롤로 읽힌다 (#734)', () => {
  /**
   * **세그먼트 두 벌이 하나의 5칸 라디오로 읽히던 것이 이 이슈의 결함이다.** 정렬을
   * 옮길 재사용 가능한 값-선택 드롭다운이 저장소에 없어(파일 머리 주석 참고) 세그먼트는
   * 유지하되, 보이는 라벨로 두 축을 가른다.
   */
  it('활동량 세그먼트 위에 보이는 활동량 캡션이 있다', () => {
    expect(renderActivity(null)).toContain(messages.walkCourse.activityGroupLabel)
  })

  it('정렬 세그먼트 위에 보이는 정렬 캡션이 있다', () => {
    expect(renderSort(null)).toContain(messages.walkCourse.sortGroupLabel)
  })

  /**
   * 라디오그룹의 접근 이름과 겹쳐 두 번 읽히지 않게 시각 전용으로 둔다.
   *
   * **여는 태그까지 한 정규식으로 잠근다** — 캡션과 `aria-label` 이 이제 같은 문구라
   * (#735) `toContain('활동량')` 만으로는 어느 쪽을 봤는지 알 수 없다.
   */
  it('보이는 캡션은 aria-hidden 이다 — 접근 이름은 라디오그룹이 이미 말한다', () => {
    const caption = new RegExp(
      `<span aria-hidden="true"[^>]*>${messages.walkCourse.activityGroupLabel}</span>`,
    )

    expect(renderActivity(null)).toMatch(caption)
  })
})

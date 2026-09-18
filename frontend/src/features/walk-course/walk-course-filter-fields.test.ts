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

describe('WalkCourseActivityField — 걷는 시간', () => {
  it('전체와 두 상한을 그린다', () => {
    const markup = renderActivity(null)

    expect(markup).toContain(messages.walkCourse.activityAll)
    expect(markup).toContain('4시간 이내')
    expect(markup).toContain('6시간 이내')
  })

  /**
   * **`HIGH` 칸이 없다.** 결과가 필터 없음과 같은데(실측 29/29) 보내면
   * `petActivityLevelApplied: true` 가 와서 화면이 좁히지도 않은 것을 좁혔다고 말한다.
   * 그 뜻을 갖는 칸은 `전체` 하나뿐이다 (공통명세 S4-1 규칙 3).
   */
  it('HIGH 칸을 두지 않는다 — 전체가 그 자리다', () => {
    expect(renderActivity(null)).not.toContain('HIGH')
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

  it('LOW 가 적용됐으면 4시간 이내가 선택된다', () => {
    const markup = renderActivity('LOW')
    const selected = markup.split('</button>').find((part) => part.includes('aria-checked="true"'))

    expect(selected).toContain('4시간 이내')
  })

  it('MEDIUM 이 적용됐으면 6시간 이내가 선택된다', () => {
    const markup = renderActivity('MEDIUM')
    const selected = markup.split('</button>').find((part) => part.includes('aria-checked="true"'))

    expect(selected).toContain('6시간 이내')
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
    expect(renderActivity(null)).toContain('aria-label="걷는 시간"')
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

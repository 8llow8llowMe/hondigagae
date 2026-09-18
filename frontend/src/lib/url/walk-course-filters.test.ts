import { describe, expect, it } from 'vitest'

import {
  parseWalkCourseFilters,
  toWalkCourseFilterQuery,
  walkCourseFilterHref,
} from '@/lib/url/walk-course-filters'
import { DEFAULT_WALK_COURSE_FILTERS, type WalkCourseFilters } from '@/types/walk-course'

describe('parseWalkCourseFilters — 읽기', () => {
  it('값이 없으면 기본값이다 — 빈 URL = 대표견으로 채울 상태', () => {
    expect(parseWalkCourseFilters({})).toEqual(DEFAULT_WALK_COURSE_FILTERS)
  })

  it('LOW · MEDIUM · ALL 을 읽는다', () => {
    expect(parseWalkCourseFilters({ activity: 'LOW' }).activity).toBe('LOW')
    expect(parseWalkCourseFilters({ activity: 'MEDIUM' }).activity).toBe('MEDIUM')
    expect(parseWalkCourseFilters({ activity: 'ALL' }).activity).toBe('ALL')
  })

  /**
   * **`HIGH` 를 `ALL` 과 같게 읽는다** (`코스목록-세부명세.md` D0). 결과가 필터 없음과
   * 같으므로(실측 29/29) 그 뜻을 갖는 값으로 정규화한다 — 그대로 두면 서버에 보내
   * `applied: true` 를 받고 화면이 좁히지도 않은 것을 좁혔다고 말한다.
   */
  it('손으로 적어 넣은 HIGH 는 ALL 과 같게 읽는다', () => {
    expect(parseWalkCourseFilters({ activity: 'HIGH' }).activity).toBe('ALL')
  })

  /** `null`(값 없음)로 떨어뜨린다 — 그러면 대표견으로 채워져 화면이 정상으로 열린다 */
  it('모르는 값은 기본값으로 떨어진다', () => {
    expect(parseWalkCourseFilters({ activity: 'low' }).activity).toBeNull()
    expect(parseWalkCourseFilters({ activity: '' }).activity).toBeNull()
  })

  it('정렬은 화이트리스트다 — 노출하지 않는 값은 기본값으로 떨어진다', () => {
    expect(parseWalkCourseFilters({ sort: 'DISTANCE_ASC' }).sort).toBe('DISTANCE_ASC')
    expect(parseWalkCourseFilters({ sort: 'DURATION_ASC' }).sort).toBeNull()
    expect(parseWalkCourseFilters({ sort: 'COURSE_NO' }).sort).toBeNull()
  })

  it('URLSearchParams 로도 읽는다', () => {
    const params = new URLSearchParams('activity=MEDIUM&sort=DISTANCE_ASC')

    expect(parseWalkCourseFilters(params)).toEqual({ activity: 'MEDIUM', sort: 'DISTANCE_ASC' })
  })

  it('배열로 온 값은 첫 번째를 쓴다', () => {
    expect(parseWalkCourseFilters({ activity: ['LOW', 'MEDIUM'] }).activity).toBe('LOW')
  })
})

describe('toWalkCourseFilterQuery — 쓰기', () => {
  it('기본값은 URL 에서 생략한다', () => {
    expect(toWalkCourseFilterQuery(DEFAULT_WALK_COURSE_FILTERS)).toBe('')
  })

  it('고른 값만 싣는다', () => {
    expect(toWalkCourseFilterQuery({ activity: 'LOW', sort: null })).toBe('activity=LOW')
    expect(toWalkCourseFilterQuery({ activity: null, sort: 'DISTANCE_ASC' })).toBe(
      'sort=DISTANCE_ASC',
    )
  })

  /** `ALL` 은 기본값이 아니다 — 빼면 새로고침에서 자동 채움이 되살아난다 */
  it('ALL 은 URL 에 남는다', () => {
    expect(toWalkCourseFilterQuery({ activity: 'ALL', sort: null })).toBe('activity=ALL')
  })
})

describe('round-trip — 읽고 쓴 값이 같다', () => {
  const cases: WalkCourseFilters[] = [
    DEFAULT_WALK_COURSE_FILTERS,
    { activity: 'LOW', sort: null },
    { activity: 'MEDIUM', sort: 'DISTANCE_ASC' },
    { activity: 'ALL', sort: 'DISTANCE_ASC' },
  ]

  it.each(cases)('%o', (filters) => {
    const query = toWalkCourseFilterQuery(filters)

    expect(parseWalkCourseFilters(new URLSearchParams(query))).toEqual(filters)
  })
})

describe('walkCourseFilterHref — 조건을 통째로 다시 싣는다', () => {
  /** 정렬만 바꿨는데 활동량이 떨어지면 목록이 29개로 되돌아간다 (D4) */
  it('정렬만 바꾼 href 가 activity 를 유지한다', () => {
    const href = walkCourseFilterHref('/walk-courses', { activity: 'LOW', sort: 'DISTANCE_ASC' })

    expect(href).toContain('activity=LOW')
    expect(href).toContain('sort=DISTANCE_ASC')
  })

  it('기본 상태면 물음표를 붙이지 않는다', () => {
    expect(walkCourseFilterHref('/walk-courses', DEFAULT_WALK_COURSE_FILTERS)).toBe('/walk-courses')
  })
})

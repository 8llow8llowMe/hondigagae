import { describe, expect, it } from 'vitest'

import { walkCourseDetailPath, walkCourseListPath } from '@/lib/api/walk-course'

/**
 * **`HIGH` 가 나갈 수 있는 경로가 타입에서 이미 막혀 있다** (`WalkCourseActivityParam` 에
 * 없다). 여기서 잠그는 것은 그 다음 — `null` 이 파라미터를 **지운다**는 것이다.
 *
 * `HIGH` 를 보내면 결과는 같은데 `petActivityLevelApplied: true` 가 와서 화면이
 * **좁히지도 않은 것을 좁혔다고 말한다** (공통명세 S4-1 규칙 3).
 */
describe('walkCourseListPath — 값이 없는 파라미터는 아예 싣지 않는다', () => {
  it('조건이 없으면 쿼리 없는 경로다', () => {
    expect(walkCourseListPath({ petActivityLevel: null, sort: null })).toBe('/walk-courses')
  })

  it('활동량만 있으면 그것만 싣는다', () => {
    expect(walkCourseListPath({ petActivityLevel: 'LOW', sort: null })).toBe(
      '/walk-courses?petActivityLevel=LOW',
    )
  })

  it('정렬만 있으면 그것만 싣는다', () => {
    expect(walkCourseListPath({ petActivityLevel: null, sort: 'DISTANCE_ASC' })).toBe(
      '/walk-courses?sort=DISTANCE_ASC',
    )
  })

  it('둘 다 있으면 둘 다 싣는다', () => {
    const path = walkCourseListPath({ petActivityLevel: 'MEDIUM', sort: 'DISTANCE_ASC' })

    expect(path).toContain('petActivityLevel=MEDIUM')
    expect(path).toContain('sort=DISTANCE_ASC')
  })

  /** 빈 문자열을 보내면 백엔드 enum 바인딩이 400 을 던진다 */
  it('빈 값을 문자열로 보내지 않는다', () => {
    expect(walkCourseListPath({ petActivityLevel: null, sort: null })).not.toContain('=')
  })
})

describe('walkCourseDetailPath — id 를 문자열 그대로 쓴다', () => {
  it('Snowflake 를 숫자로 바꾸지 않는다', () => {
    expect(walkCourseDetailPath('6911167100216303304')).toBe('/walk-courses/6911167100216303304')
  })
})

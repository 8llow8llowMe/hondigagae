import { describe, expect, it } from 'vitest'

import { walkCourseMetaLine } from '@/lib/plan/walk-course-meta'
import { planItemWalkCourse } from '@/test/fixtures/plan'

/**
 * `WALK` 항목 행의 메타 줄 (#620 · 일정상세-세부명세 D12-4).
 *
 * `placeMetaLine` 과 같은 규칙(조각이 없으면 낱말이 빠지고, 전부 없으면 줄 자체가
 * 없다)을 검증한다.
 */
describe('walkCourseMetaLine', () => {
  it('값이 다 있으면 구간명 · 거리 · 소요시간을 붙인다', () => {
    expect(walkCourseMetaLine(planItemWalkCourse())).toBe('시흥-광치기 · 15.1km · 4~5시간')
  })

  it('durationText 만 없으면 끝에 가운뎃점이 남지 않는다', () => {
    expect(walkCourseMetaLine(planItemWalkCourse({ durationText: null }))).toBe(
      '시흥-광치기 · 15.1km',
    )
  })

  it('name 만 없으면 거리 · 소요시간만 남는다', () => {
    expect(walkCourseMetaLine(planItemWalkCourse({ name: null }))).toBe('15.1km · 4~5시간')
  })

  it('전부 null 이면 null 이다 — 줄을 렌더하지 않는다', () => {
    const empty = planItemWalkCourse({ name: null, distanceKm: null, durationText: null })

    expect(walkCourseMetaLine(empty)).toBeNull()
  })

  /**
   * 인자가 `null` 인 경로 — 요약 자체가 오지 않은 세 갈래(코스 없음 ·
   * tour-service 장애 · 수기 정리)가 전부 여기로 온다 (D12-4-1).
   */
  it('인자가 null(요약 없음) 이면 null 이다', () => {
    expect(walkCourseMetaLine(null)).toBeNull()
  })

  it('정수 거리도 소수 1자리로 그린다 — 19 는 19.0km 다', () => {
    expect(walkCourseMetaLine(planItemWalkCourse({ distanceKm: 19 }))).toContain('19.0km')
  })

  /**
   * `durationMaxMinutes` 는 "제한 없음" 이 아니라 "원문 파싱 실패" 다 — 화면 숫자로
   * 쓰지 않는다. `300` 을 넣어도 결과 문자열에 `300` 이 없어야 한다.
   */
  it('durationMaxMinutes 를 문구에 쓰지 않는다', () => {
    const line = walkCourseMetaLine(planItemWalkCourse({ durationMaxMinutes: 300 }))

    expect(line).not.toContain('300')
  })
})

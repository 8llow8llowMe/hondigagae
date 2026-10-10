import { describe, expect, it } from 'vitest'

import { formatCourseDistance } from '@/lib/format/distance'

/**
 * 코스 거리는 **km 단위 실수**로 온다 (`BigDecimal` → JSON number). m 로 오는
 * `formatDistance` 와 입력 단위가 다르다 — 같은 함수로 합치면 `15.1` 이 `15m` 가 된다.
 */
describe('formatCourseDistance — 소수 1자리 고정 (공통명세 S3)', () => {
  it('소수 1자리를 그대로 쓴다', () => {
    expect(formatCourseDistance(15.1)).toBe('15.1km')
    expect(formatCourseDistance(4.2)).toBe('4.2km')
  })

  /**
   * **`19` 를 `19km` 로 줄이지 않는다.** 실측에 `19.0` 이 있고, 같은 열의 `19.1` 과
   * 자릿수가 어긋나면 목록에서 값이 들쭉날쭉해 보인다.
   */
  it('정수여도 소수 자리를 남긴다', () => {
    expect(formatCourseDistance(19)).toBe('19.0km')
  })

  it('값이 없으면 자리표시자다', () => {
    expect(formatCourseDistance(null)).toBe('-')
    expect(formatCourseDistance(undefined)).toBe('-')
  })

  it('음수는 자리표시자다', () => {
    expect(formatCourseDistance(-1)).toBe('-')
  })
})

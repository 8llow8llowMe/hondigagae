import { describe, expect, it } from 'vitest'

import { isWalkCourseId } from '@/lib/walk-course/id'

/**
 * `/walk-courses/{id}` 는 `@PathVariable long` 이라 숫자가 아니면 **400** 이다
 * (`WalkCourseWebController.java:74` · dev 실측 `WALKCOURSE_113`). 404 가 아니다.
 * `/places/{placeId}` 와 정확히 같은 모양이라 같은 처치를 한다 (#563).
 */
describe('isWalkCourseId — 서버가 받아들일 수 있는 모양인가', () => {
  it('숫자 문자열은 참이다', () => {
    expect(isWalkCourseId('6911167100216303304')).toBe(true)
  })

  /**
   * **`Number()` 를 거치지 않는다.** 19자리는 `Number.MAX_SAFE_INTEGER`(16자리) 밖이라
   * 숫자로 바꾸는 순간 값이 뭉개진다 — 정규식으로 모양만 본다.
   */
  it('안전 정수 범위 밖의 id 도 참이다 — 값을 숫자로 바꿔 보지 않는다', () => {
    expect(isWalkCourseId('9007199254740993')).toBe(true)
  })

  it('숫자가 아니면 거짓이다', () => {
    expect(isWalkCourseId('abc')).toBe(false)
  })

  it('빈 문자열은 거짓이다', () => {
    expect(isWalkCourseId('')).toBe(false)
  })

  it('소수점은 거짓이다', () => {
    expect(isWalkCourseId('12.3')).toBe(false)
  })

  /** 부호는 `Long.parseLong` 이 받지만 코스 id 가 음수일 수 없다 — 400 이 확정된 주소다 */
  it('음수는 거짓이다', () => {
    expect(isWalkCourseId('-1')).toBe(false)
  })

  it('공백이 섞이면 거짓이다', () => {
    expect(isWalkCourseId(' 12')).toBe(false)
    expect(isWalkCourseId('12 ')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'

import { hasCoordinates, toCoursePosition } from '@/lib/walk-course/coordinates'

/**
 * **이 판정 하나가 골든타임 동선 전체를 연다** (공통명세 S4-2).
 *
 * 실측 29개 중 25개가 좌표 null 이라, 여기서 틀리면 **다수의 코스**가 기니만 앞바다
 * (0, 0)의 예보를 **200 정상 응답으로** 받아 온다 — 틀린 답이 오류로 보이지 않는다.
 */
describe('hasCoordinates — 좌표가 있는 코스만 참이다', () => {
  it('lat·lng 가 둘 다 숫자면 참이다', () => {
    expect(hasCoordinates({ lat: 33.4, lng: 126.9 })).toBe(true)
  })

  it('lat 이 null 이면 거짓이다', () => {
    expect(hasCoordinates({ lat: null, lng: 126.9 })).toBe(false)
  })

  /** 한쪽만 보는 실수를 잡는다 — `lat` 만 확인하는 구현이 이 케이스에서 통과한다 */
  it('lng 가 null 이면 거짓이다', () => {
    expect(hasCoordinates({ lat: 33.4, lng: null })).toBe(false)
  })

  it('둘 다 null 이면 거짓이다', () => {
    expect(hasCoordinates({ lat: null, lng: null })).toBe(false)
  })

  /**
   * **`0` 은 유효한 좌표다.** `null` 만 없음이다 — `!course.lat` 로 판정하면 여기서 걸린다.
   * 제주 좌표에 0 이 오지는 않지만, 판정식이 falsy 검사면 그 사실이 우연이 된다.
   */
  it('0 은 없음이 아니다', () => {
    expect(hasCoordinates({ lat: 0, lng: 0 })).toBe(true)
  })
})

describe('toCoursePosition — 골든타임에 넘길 좌표', () => {
  it('좌표가 있으면 position 을 만든다', () => {
    expect(toCoursePosition({ lat: 33.4, lng: 126.9 })).toEqual({ lat: 33.4, lng: 126.9 })
  })

  /**
   * **`lat ?? 0` 을 쓰지 않는다.** `useWalkTimes` 의 `enabled` 가 `position !== null` 이라,
   * 여기서 `null` 을 만들면 요청 자체가 나가지 않는다 (`코스상세-세부명세.md` D3-1).
   */
  it('좌표가 없으면 null 이다 — 0 으로 메우지 않는다', () => {
    expect(toCoursePosition({ lat: null, lng: 126.9 })).toBeNull()
    expect(toCoursePosition({ lat: 33.4, lng: null })).toBeNull()
    expect(toCoursePosition({ lat: null, lng: null })).toBeNull()
  })
})

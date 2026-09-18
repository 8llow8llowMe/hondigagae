import { describe, expect, it } from 'vitest'

import { formatElapsed } from '@/lib/ai-plan/elapsed'

describe('formatElapsed — 지난 시간만 말한다 (#710)', () => {
  it('1분 미만은 초로 적는다', () => {
    expect(formatElapsed(12_000)).toBe('12초')
    expect(formatElapsed(59_999)).toBe('59초')
  })

  it('1분 이상은 분과 초로 적는다', () => {
    expect(formatElapsed(72_000)).toBe('1분 12초')
    expect(formatElapsed(83_000)).toBe('1분 23초')
  })

  /* `2분 0초` 는 0 을 읽게 만들 뿐이다 */
  it('초가 0 이면 분만 적는다', () => {
    expect(formatElapsed(120_000)).toBe('2분')
  })

  /*
    **첫 tick 전에는 그리지 않는다.** `elapsedMs` 는 0 에서 시작하고 `TICK_MS` 는 1초라
    이 상태를 반드시 지난다 — `0초 지남` 을 그리면 첫 프레임에 보였다 사라지는 줄이 생겨
    카드 높이가 한 번 튄다.
  */
  it('1초 전에는 null 이다', () => {
    expect(formatElapsed(0)).toBeNull()
    expect(formatElapsed(999)).toBeNull()
  })

  /*
    시계는 `Date.now()` 차이라 기기 시간이 뒤로 가면 음수가 된다. `-3초 지남` 은 버그를
    사용자에게 보여 주는 것이다.
  */
  it('음수·유한하지 않은 값은 null 이다', () => {
    expect(formatElapsed(-1_000)).toBeNull()
    expect(formatElapsed(Number.NaN)).toBeNull()
    expect(formatElapsed(Number.POSITIVE_INFINITY)).toBeNull()
  })
})

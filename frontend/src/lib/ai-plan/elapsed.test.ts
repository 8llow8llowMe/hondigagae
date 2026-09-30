import { describe, expect, it } from 'vitest'

import { formatElapsed, stepElapsedMsOf } from '@/lib/ai-plan/elapsed'

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

/*
  **현재 단계에서 지난 시간 (#1057).** 서버 시각(`stepStartedAt`)과 기기 시각의 차이라, 새로고침해도
  0 으로 돌아가지 않는다 — 구독 시작을 세는 전체 경과와 다른 점이다.
*/
describe('stepElapsedMsOf — 이 단계에서 지난 시간 (#1057)', () => {
  const STARTED = '2026-09-30T14:03:12.345+09:00'
  const startedMs = Date.parse(STARTED)

  it('서버가 준 단계 시작 시각부터 지금까지를 잰다', () => {
    expect(stepElapsedMsOf(STARTED, startedMs + 45_000)).toBe(45_000)
  })

  // 밀리초가 0 이면 서버가 소수부를 뺀다 (`ai-service.md` "stepStartedAt")
  it('소수부 없는 시각도 읽는다', () => {
    expect(stepElapsedMsOf('2026-09-30T14:03:12+09:00', Date.parse('2026-09-30T05:03:13Z'))).toBe(
      1000,
    )
  })

  /*
    **PENDING · 종결 · 옛 저장 데이터는 null 이다.** 그 자리를 비운다 — 끝난 작업 위에 경과 시간이
    계속 늘거나, 없는 시각을 0 으로 읽어 "0초째" 를 그리지 않는다.
  */
  it('시각이 없거나 시계가 아직 돌지 않았으면 null 이다', () => {
    expect(stepElapsedMsOf(null, startedMs)).toBeNull()
    expect(stepElapsedMsOf(undefined, startedMs)).toBeNull()
    expect(stepElapsedMsOf(STARTED, null)).toBeNull()
  })

  it('읽을 수 없는 시각은 null 이다', () => {
    expect(stepElapsedMsOf('어제', startedMs)).toBeNull()
    expect(stepElapsedMsOf('', startedMs)).toBeNull()
  })

  /*
    기기 시계가 서버보다 늦으면 음수가 나온다. 값은 그대로 돌려주고 **표기가 거른다**
    (`formatElapsed` 가 음수를 null 로 읽는다) — 두 곳에서 따로 거르면 규칙이 갈린다.
  */
  it('기기 시계가 늦어 음수여도 값은 돌려주고, 표기가 거른다', () => {
    const skewed = stepElapsedMsOf(STARTED, startedMs - 3_000)
    expect(skewed).toBe(-3_000)
    expect(formatElapsed(skewed ?? 0)).toBeNull()
  })
})

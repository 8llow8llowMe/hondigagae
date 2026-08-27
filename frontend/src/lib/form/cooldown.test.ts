import { describe, expect, it } from 'vitest'

import { remainingSeconds } from '@/lib/form/cooldown'

describe('remainingSeconds', () => {
  it('시작 직후에는 전체 쿨다운을 그대로 반환한다', () => {
    expect(remainingSeconds(0, 60, 0)).toBe(60)
  })

  it('30초 경과 시 30을 반환한다', () => {
    expect(remainingSeconds(0, 60, 30_000)).toBe(30)
  })

  it('60초(전체 쿨다운) 경과 시 0을 반환한다', () => {
    expect(remainingSeconds(0, 60, 60_000)).toBe(0)
  })

  it('쿨다운을 초과해 경과해도 음수가 아니라 0을 반환한다', () => {
    expect(remainingSeconds(0, 60, 90_000)).toBe(0)
  })

  it('경계값 — 59초 경과 시 1을 반환한다', () => {
    expect(remainingSeconds(0, 60, 59_000)).toBe(1)
  })

  it('startedAt 이 임의 시각이어도 상대 경과만 본다', () => {
    const startedAt = 1_700_000_000_000
    expect(remainingSeconds(startedAt, 60, startedAt + 45_000)).toBe(15)
  })
})

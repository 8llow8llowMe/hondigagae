import { describe, expect, it } from 'vitest'

import { formatRemaining, formatWait } from '@/lib/format/wait'

describe('formatWait — 기다릴 시간', () => {
  it('1분 미만은 초로 쓴다', () => {
    expect(formatWait(1)).toBe('1초')
    expect(formatWait(59)).toBe('59초')
  })

  it('1분 이상은 분으로 올려 쓴다 — IP 상한(AUTH_016)의 1시간이 "3540초" 로 보이지 않게', () => {
    expect(formatWait(60)).toBe('1분')
    expect(formatWait(61)).toBe('2분')
    expect(formatWait(600)).toBe('10분')
    expect(formatWait(3540)).toBe('59분')
  })
})

describe('formatRemaining — 남은 시간', () => {
  it('분과 초를 함께 쓴다', () => {
    expect(formatRemaining(299)).toBe('4분 59초')
  })

  it('딱 떨어지면 분만, 1분 미만이면 초만 쓴다', () => {
    expect(formatRemaining(300)).toBe('5분')
    expect(formatRemaining(59)).toBe('59초')
  })
})

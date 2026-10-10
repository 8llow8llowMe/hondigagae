import { describe, expect, it } from 'vitest'

import { BUDGET_PRESETS_MANWON, formatBudget } from '@/lib/ai-plan/budget'

describe('BUDGET_PRESETS_MANWON', () => {
  it('아트보드 01 의 어림값 세 개다', () => {
    expect(BUDGET_PRESETS_MANWON).toEqual([20, 30, 50])
  })
})

describe('formatBudget', () => {
  it('만원 단위로 딱 나뉘면 만원으로 쓴다 — 폼이 만원 단위로 받으므로 대부분 그렇다', () => {
    expect(formatBudget(300_000)).toBe('30만원')
    expect(formatBudget(10_000)).toBe('1만원')
  })

  it('천 단위 구분을 넣는다', () => {
    expect(formatBudget(15_000_000)).toBe('1,500만원')
  })

  it('만원 단위로 나뉘지 않으면 원으로 쓴다 — 서버가 임의 값을 줄 수 있다', () => {
    expect(formatBudget(205_000)).toBe('205,000원')
    expect(formatBudget(1)).toBe('1원')
  })

  it('예산을 정하지 않았으면 null 이다 — 0원이라고 쓰지 않는다', () => {
    expect(formatBudget(null)).toBeNull()
  })

  it('0 은 만원 배수라 0만원이 된다 — 계약이 @Positive 라 실제로 오지 않는 값이다', () => {
    expect(formatBudget(0)).toBe('0만원')
  })
})

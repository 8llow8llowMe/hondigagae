import { describe, expect, it } from 'vitest'

import { aiPlanFormSchema } from '@/features/ai-plan/schemas'
import { validate } from '@/lib/form/validate'
import { messages } from '@/lib/messages'
import { type AiPlanFormValues, EMPTY_AI_PLAN_FORM_VALUES } from '@/types/ai-plan'

/**
 * 예산 축만 본다. 일정 예산(#566)과 **같은 결함**이 이쪽에도 있었다 — 상한이 없어
 * 큰 수가 그대로 나갔다. 다만 걸리는 이유가 다르다: 이 폼은 만원 단위로 받아
 * `submit.ts` 가 10000 배 해 보내므로, 서버 `Long` 한참 앞에서 **`Number` 정밀도**가
 * 먼저 깨진다.
 */
function values(overrides: Partial<AiPlanFormValues> = {}): AiPlanFormValues {
  return {
    ...EMPTY_AI_PLAN_FORM_VALUES,
    startDate: '2026-09-21',
    endDate: '2026-09-22',
    petIds: ['123456789012000001'],
    ...overrides,
  }
}

describe('aiPlanFormSchema — 예산(만원)', () => {
  it('빈 값은 통과한다 — "상관없음" 이다', () => {
    expect(validate(aiPlanFormSchema, values({ budgetManwon: '' })).ok).toBe(true)
  })

  it('흔한 예산은 통과한다', () => {
    expect(validate(aiPlanFormSchema, values({ budgetManwon: '30' })).ok).toBe(true)
  })

  it('0·소수·문자는 막는다', () => {
    for (const budgetManwon of ['0', '3.5', 'abc']) {
      const result = validate(aiPlanFormSchema, values({ budgetManwon }))
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.errors.fields.budgetManwon).toBe(messages.aiPlan.errorBudgetPositive)
    }
  })

  it('원으로 바꿨을 때 정확히 표현되지 않는 값은 막는다', () => {
    // 900_000_000_000 만원 = 9e15 원. Number.MAX_SAFE_INTEGER(약 9.007e15) 안이다
    expect(validate(aiPlanFormSchema, values({ budgetManwon: '900000000000' })).ok).toBe(true)

    // 한 자리 더 붙으면 9e16 원이라 Number 가 값을 바꾼다 — 화면과 서버가 다른 수를 본다
    const result = validate(aiPlanFormSchema, values({ budgetManwon: '9000000000000' }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.fields.budgetManwon).toBe(messages.aiPlan.errorBudgetTooLarge)
  })
})

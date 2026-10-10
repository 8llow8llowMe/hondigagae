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

/**
 * **#974.** 반려견을 안 고르고 제출하면 "반려견 식별자는 양수여야 합니다." 가 떴다 — 서버
 * `AIPLAN_105`(`petId` 의 `@Positive`) 문구를 FE 메시지로 베껴 둔 것이었다. 이 검증은 서버의
 * 그 규칙과 **다른 규칙**이다: 서버는 반려견을 선택으로 받고, 0마리를 막는 것은 화면이다.
 * 그래서 복제본이 아니라 무엇을 하면 되는지 말하는 문구로 잠근다.
 */
describe('aiPlanFormSchema — 반려견', () => {
  it('0마리면 무엇을 하면 되는지 말하는 문구로 막는다', () => {
    const result = validate(aiPlanFormSchema, values({ petIds: [] }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.fields.petIds).toBe('함께 갈 반려견을 골라 주세요.')
    expect(result.errors.fields.petIds).toBe(messages.aiPlan.errorPetRequired)
  })

  it('서버 검증 문구(개발자용 낱말)를 화면에 내지 않는다', () => {
    expect(messages.aiPlan.errorPetRequired).not.toMatch(/식별자|양수/)
  })
})

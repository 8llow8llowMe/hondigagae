import { describe, expect, it } from 'vitest'

import { messages } from '@/lib/messages'
import { PLAN_BUDGET_MAX, planBudgetIssue } from '@/lib/plan/budget'
import { validatePlanEdit } from '@/lib/plan/edit'

describe('planBudgetIssue — 예산 판정', () => {
  it('빈 값은 문제가 아니다 — 선택 입력이라 "안 정했다" 다', () => {
    expect(planBudgetIssue('')).toBeNull()
    expect(planBudgetIssue('   ')).toBeNull()
  })

  it('숫자가 아닌 값은 invalid 다', () => {
    expect(planBudgetIssue('-1')).toBe('invalid')
    expect(planBudgetIssue('1.5')).toBe('invalid')
    expect(planBudgetIssue('abc')).toBe('invalid')
    // `Number()` 는 통과시키지만 서식이 아니다 — 정규식이 먼저 보는 이유다
    expect(planBudgetIssue('1e3')).toBe('invalid')
    expect(planBudgetIssue('+5')).toBe('invalid')
  })

  /*
    경계값은 dev 실측 그대로다 — `2147483647` 은 일정이 생성됐고 `2147483648` 은
    400 이 돌아왔다. 서버 `PlanCreateRequest.budget` 이 `Integer` 라서다.
  */
  it('Integer 상한까지는 통과하고 한 칸 넘으면 too-large 다', () => {
    expect(PLAN_BUDGET_MAX).toBe(2_147_483_647)
    expect(planBudgetIssue('2147483647')).toBeNull()
    expect(planBudgetIssue('2147483648')).toBe('too-large')
    expect(planBudgetIssue('99999999999999999999')).toBe('too-large')
  })

  it('0 과 흔한 예산은 그대로 통과한다', () => {
    expect(planBudgetIssue('0')).toBeNull()
    expect(planBudgetIssue('400000')).toBeNull()
  })
})

describe('validatePlanEdit — 수정 폼도 같은 상한을 본다', () => {
  const values = (budget: string) => ({ title: '제주 2박 3일', budget })

  it('상한을 넘기면 예산 칸에 오류가 붙는다', () => {
    expect(validatePlanEdit(values('2147483648')).budget).toBe(messages.plan.errorBudgetTooLarge)
  })

  it('상한 안이면 통과한다', () => {
    expect(validatePlanEdit(values('2147483647')).budget).toBeUndefined()
    expect(validatePlanEdit(values('')).budget).toBeUndefined()
  })

  it('서식이 틀린 값은 "너무 커요" 가 아니라 서식 오류다', () => {
    expect(validatePlanEdit(values('abc')).budget).toBe(messages.plan.errorBudgetNegative)
  })
})

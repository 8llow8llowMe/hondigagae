import { describe, expect, it } from 'vitest'

import { messages } from '@/lib/messages'
import { canCopyPlan, copyEndDateFor, toPlanCopyPayload, validatePlanCopy } from '@/lib/plan/copy'
import type { CodeNameMetadata } from '@/types/api'

const DRAFT: CodeNameMetadata = { code: 'DRAFT', name: '초안', description: null }
const CONFIRMED: CodeNameMetadata = { code: 'CONFIRMED', name: '확정', description: null }
const COMPLETED: CodeNameMetadata = { code: 'COMPLETED', name: '완료', description: null }

describe('canCopyPlan — 진입점 노출 조건 (#617, 일정복사-세부명세 D4-1)', () => {
  const today = new Date('2026-09-18T00:00:00Z')

  it('종료일이 오늘보다 이르면 지난 일정이라 보인다', () => {
    expect(
      canCopyPlan({ startDate: '2026-09-01', endDate: '2026-09-10', status: DRAFT }, today),
    ).toBe(true)
  })

  it('상태가 COMPLETED 면 종료일이 미래여도 보인다 — isPastPlan 과 다른 축이다', () => {
    expect(
      canCopyPlan({ startDate: '2026-09-20', endDate: '2026-09-22', status: COMPLETED }, today),
    ).toBe(true)
  })

  it('다가오는 초안은 숨는다', () => {
    expect(
      canCopyPlan({ startDate: '2026-09-20', endDate: '2026-09-22', status: DRAFT }, today),
    ).toBe(false)
  })

  it('여행 중인 확정 일정도 숨는다', () => {
    expect(
      canCopyPlan({ startDate: '2026-09-17', endDate: '2026-09-20', status: CONFIRMED }, today),
    ).toBe(false)
  })

  it('날짜를 못 읽는 깨진 데이터는 상태와 무관하게 숨는다 — 지난 쪽으로 밀지 않는다', () => {
    expect(
      canCopyPlan({ startDate: '2026-13-40', endDate: '2026-09-22', status: COMPLETED }, today),
    ).toBe(false)
  })
})

describe('copyEndDateFor — 종료일 자동 채움 (기본값이지 검증이 아니다)', () => {
  it('시작일 + (일수 - 1) 로 종료일을 채운다', () => {
    expect(copyEndDateFor('2027-09-12', 3)).toBe('2027-09-14')
  })

  it('경계: totalDays === 1 이면 시작일과 같다', () => {
    expect(copyEndDateFor('2027-09-12', 1)).toBe('2027-09-12')
  })

  it('서식이 아닌 시작일은 null — 호출부는 종료일을 채우지 않는다', () => {
    expect(copyEndDateFor('2027-13-40', 3)).toBeNull()
  })
})

describe('validatePlanCopy — 클라이언트 선차단 (D4-2: 일수 일치는 막지 않는다)', () => {
  it('빈 값은 각 필드의 필수 오류다', () => {
    const errors = validatePlanCopy({ startDate: '', endDate: '' })
    expect(errors.startDate).toBe(messages.plan.errorStartDateRequired)
    expect(errors.endDate).toBe(messages.plan.errorEndDateRequired)
  })

  it('역전은 종료일에 붙는다', () => {
    const errors = validatePlanCopy({ startDate: '2027-09-14', endDate: '2027-09-12' })
    expect(errors.endDate).toBe(messages.plan.errorDateRange)
  })

  it('31일은 상한 오류, 경계 30일은 오류가 없다', () => {
    expect(validatePlanCopy({ startDate: '2026-09-01', endDate: '2026-10-01' }).endDate).toBe(
      messages.plan.errorPeriodTooLong,
    )
    expect(
      validatePlanCopy({ startDate: '2026-09-01', endDate: '2026-09-30' }).endDate,
    ).toBeUndefined()
  })

  /*
    **회귀 방지 단언.** 원본이 3일짜리여도 이 함수는 원본 일수를 모른다 — 일수 일치
    (`PLAN_021`)는 서버가 판정한다. 여기에 검사가 생기면 서버 규칙이 두 곳으로 갈린다
    (`일정복사-세부명세.md` D4-2, #585 의 `PLAN_008` 과 같은 결정).
  */
  it('일수 불일치는 오류가 아니다 — 원본보다 짧은 기간을 넣어도 통과한다', () => {
    const errors = validatePlanCopy({ startDate: '2027-09-12', endDate: '2027-09-13' })
    expect(errors).toEqual({})
  })
})

describe('toPlanCopyPayload — title 을 보내지 않는다 (D3-1)', () => {
  it('startDate·endDate 만 담는다', () => {
    const payload = toPlanCopyPayload({ startDate: '2027-09-12', endDate: '2027-09-14' })
    expect(payload).toEqual({ startDate: '2027-09-12', endDate: '2027-09-14' })
    expect(Object.hasOwn(payload, 'title')).toBe(false)
  })
})

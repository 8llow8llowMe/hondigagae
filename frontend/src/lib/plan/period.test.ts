import { describe, expect, it } from 'vitest'

import { messages } from '@/lib/messages'
import { toPlanUpdatePayload, validatePlanEdit } from '@/lib/plan/edit'
import { PLAN_PERIOD_MAX_DAYS, planPeriodIssue } from '@/lib/plan/period'

describe('planPeriodIssue — 기간 판정', () => {
  it('빈 값·깨진 서식은 문제로 보지 않는다 — 각 필드가 따로 말한다', () => {
    expect(planPeriodIssue('', '')).toBeNull()
    expect(planPeriodIssue('2026-09-12', '')).toBeNull()
    expect(planPeriodIssue('', '2026-09-14')).toBeNull()
    expect(planPeriodIssue('2026-9-12', '2026-09-14')).toBeNull()
    // 달력에 없는 날 — `parseDay` 가 되돌려 비교해 걸러낸다
    expect(planPeriodIssue('2026-02-31', '2026-03-05')).toBeNull()
  })

  it('종료일이 시작일보다 이르면 reversed 다', () => {
    expect(planPeriodIssue('2026-09-14', '2026-09-12')).toBe('reversed')
  })

  it('같은 날은 하루짜리 일정이라 문제가 아니다', () => {
    expect(planPeriodIssue('2026-09-12', '2026-09-12')).toBeNull()
  })

  /*
    경계는 서버 `PLAN_009`(최대 30일) 복제본이다. 양끝을 포함해 세므로 09-01 ~ 09-30 이
    딱 30일이고, 09-01 ~ 10-01 이 31일로 넘어간다 — `totalDaysBetween` 과 같은 셈이다.
  */
  it('30일까지는 통과하고 31일부터 too-long 이다', () => {
    expect(PLAN_PERIOD_MAX_DAYS).toBe(30)
    expect(planPeriodIssue('2026-09-01', '2026-09-30')).toBeNull()
    expect(planPeriodIssue('2026-09-01', '2026-10-01')).toBe('too-long')
  })

  it('역전을 상한보다 먼저 본다 — 역전에 "30일을 넘었어요" 는 틀린 진단이다', () => {
    expect(planPeriodIssue('2026-12-31', '2026-01-01')).toBe('reversed')
  })
})

describe('validatePlanEdit — 기간 편집 (#585)', () => {
  const values = (startDate: string, endDate: string) => ({
    title: '제주 2박 3일',
    startDate,
    endDate,
    budget: '',
  })

  it('정상 기간은 날짜 오류를 내지 않는다', () => {
    const errors = validatePlanEdit(values('2026-09-12', '2026-09-14'))
    expect(errors.startDate).toBeUndefined()
    expect(errors.endDate).toBeUndefined()
  })

  it('빈 날짜는 각 필드의 "골라 주세요" 다 — 관계 오류로 덮지 않는다', () => {
    const errors = validatePlanEdit(values('', ''))
    expect(errors.startDate).toBe(messages.plan.errorStartDateRequired)
    expect(errors.endDate).toBe(messages.plan.errorEndDateRequired)
  })

  it('역전은 종료일에 붙는다 — 사용자가 방금 고른 쪽이다', () => {
    expect(validatePlanEdit(values('2026-09-14', '2026-09-12')).endDate).toBe(
      messages.plan.errorDateRange,
    )
  })

  it('30일을 넘기면 상한 문구가 종료일에 붙는다', () => {
    expect(validatePlanEdit(values('2026-09-01', '2026-10-01')).endDate).toBe(
      messages.plan.errorPeriodTooLong,
    )
  })
})

describe('toPlanUpdatePayload — 부분 수정 규약이 날짜에도 그대로다 (#585)', () => {
  /*
    서버는 **보내지 않은 필드를 유지**한다(`PlanCommandProcessor.updatePlan`). 이 폼은
    기간을 바꾸지 않았어도 **두 날짜를 함께 보낸다** — 한쪽만 보내는 경로를 만들지 않기
    위해서다. 시작일만 보내면 서버가 새 시작일과 **옛 종료일**로 기간을 다시 계산한다.
  */
  it('바꾸지 않은 기간도 두 날짜가 함께 실린다', () => {
    const payload = toPlanUpdatePayload({
      title: '제주 2박 3일',
      startDate: '2026-09-12',
      endDate: '2026-09-14',
      budget: '400000',
    })

    expect(payload.startDate).toBe('2026-09-12')
    expect(payload.endDate).toBe('2026-09-14')
  })

  it('한쪽만 실리는 경로가 없다', () => {
    const payload = toPlanUpdatePayload({
      title: '제주 2박 3일',
      startDate: '2026-10-01',
      endDate: '2026-10-03',
      budget: '',
    })

    expect(Object.hasOwn(payload, 'startDate')).toBe(true)
    expect(Object.hasOwn(payload, 'endDate')).toBe(true)
  })

  /** `status` 는 여전히 넣지 않는다 — 확정은 별도 동작이다 */
  it('status 는 실리지 않는다', () => {
    const payload = toPlanUpdatePayload({
      title: '제주 2박 3일',
      startDate: '2026-09-12',
      endDate: '2026-09-14',
      budget: '',
    })

    expect(Object.hasOwn(payload, 'status')).toBe(false)
  })
})

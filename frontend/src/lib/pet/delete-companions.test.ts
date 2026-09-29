import { describe, expect, it } from 'vitest'

import { petDeleteCompanionLines } from '@/lib/pet/delete-companions'
import { petCompanionSummary } from '@/test/fixtures/plan'

/**
 * 반려견 삭제 확인창의 동행 일정 문장 (#1042). 수치는 서버가 센다
 * (`GET /plans/companions/{petId}`) — 화면은 0 인 문장을 내지 않는 규칙만 갖는다.
 */
describe('petDeleteCompanionLines', () => {
  it('셋 다 0 이면 아무 문장도 내지 않는다 — 일정과 상관없는 아이다', () => {
    expect(
      petDeleteCompanionLines({
        ...petCompanionSummary,
        editablePlanCount: 0,
        soleCompanionPlanCount: 0,
        completedPlanCount: 0,
      }),
    ).toEqual([])
  })

  it('미완료 일정 수를 말한다', () => {
    expect(
      petDeleteCompanionLines({
        ...petCompanionSummary,
        editablePlanCount: 2,
        soleCompanionPlanCount: 0,
        completedPlanCount: 0,
      }),
    ).toEqual(['이 아이가 동행하는 일정 2개에서 빠져요.'])
  })

  it('그중 이 아이만 동행하는 일정은 남는다고 따로 말한다', () => {
    expect(
      petDeleteCompanionLines({
        ...petCompanionSummary,
        editablePlanCount: 3,
        soleCompanionPlanCount: 1,
        completedPlanCount: 0,
      }),
    ).toEqual([
      '이 아이가 동행하는 일정 3개에서 빠져요.',
      '그중 1개는 동행 반려견이 없는 일정으로 남아요.',
    ])
  })

  /*
    전부가 이 아이만 동행하는 일정이면 "그중 2개는" 이 앞 문장의 수를 되풀이한다. 일정이
    지워지지 않는다는 것이 사용자가 가장 먼저 물을 것이라 그것을 말한다.
  */
  it('전부 이 아이만 동행하는 일정이면 수를 되풀이하지 않는다', () => {
    expect(
      petDeleteCompanionLines({
        ...petCompanionSummary,
        editablePlanCount: 2,
        soleCompanionPlanCount: 2,
        completedPlanCount: 0,
      }),
    ).toEqual([
      '이 아이가 동행하는 일정 2개에서 빠져요.',
      '일정은 지워지지 않고 동행 반려견이 없는 일정으로 남아요.',
    ])
  })

  it('다녀온 일정은 기록이 그대로 남는다고 말한다', () => {
    expect(
      petDeleteCompanionLines({
        ...petCompanionSummary,
        editablePlanCount: 0,
        soleCompanionPlanCount: 0,
        completedPlanCount: 3,
      }),
    ).toEqual(['다녀온 일정 3개의 기록은 그대로 남아요.'])
  })

  it('세 문장이 이 순서로 선다 — 바뀌는 것 먼저, 그대로인 것 나중', () => {
    expect(petDeleteCompanionLines(petCompanionSummary)).toEqual([
      '이 아이가 동행하는 일정 2개에서 빠져요.',
      '그중 1개는 동행 반려견이 없는 일정으로 남아요.',
      '다녀온 일정 3개의 기록은 그대로 남아요.',
    ])
  })

  /*
    계약상 sole ≤ editable 이다(서버가 editable 중에서 센다). 어긋난 값이 와도 "3개 중 5개"
    같은 거짓 문장을 만들지 않는다.
  */
  it('sole 이 editable 보다 크게 와도 앞 문장의 수를 넘는 문장을 만들지 않는다', () => {
    expect(
      petDeleteCompanionLines({
        ...petCompanionSummary,
        editablePlanCount: 0,
        soleCompanionPlanCount: 1,
        completedPlanCount: 0,
      }),
    ).toEqual([])
  })
})

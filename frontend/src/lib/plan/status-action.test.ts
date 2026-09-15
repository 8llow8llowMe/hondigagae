import { describe, expect, it } from 'vitest'

import { planStatusActions } from '@/lib/plan/status-action'

describe('planStatusActions — 일정 상태 버튼', () => {
  it('초안에서는 확정만 연다 — 완료를 열지 않는다', () => {
    expect(planStatusActions('DRAFT')).toEqual([
      { kind: 'confirm', nextStatus: 'CONFIRMED', variant: 'primary' },
    ])
  })

  it('확정에서는 완료가 주 행동이고 초안 되돌리기는 보조다', () => {
    expect(planStatusActions('CONFIRMED')).toEqual([
      { kind: 'complete', nextStatus: 'COMPLETED', variant: 'primary' },
      { kind: 'revert-draft', nextStatus: 'DRAFT', variant: 'secondary' },
    ])
  })

  it('완료에서는 확정으로만 되돌린다 — 초안으로는 가지 않는다', () => {
    expect(planStatusActions('COMPLETED')).toEqual([
      { kind: 'reopen', nextStatus: 'CONFIRMED', variant: 'secondary' },
    ])
    expect(planStatusActions('COMPLETED').some((action) => action.nextStatus === 'DRAFT')).toBe(
      false,
    )
  })

  it('모르는 코드에서는 버튼을 만들지 않는다', () => {
    expect(planStatusActions('ARCHIVED')).toEqual([])
    expect(planStatusActions('')).toEqual([])
  })
})

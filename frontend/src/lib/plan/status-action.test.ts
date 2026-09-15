import { describe, expect, it } from 'vitest'

import {
  forwardStatusAction,
  planStatusActions,
  reverseStatusActions,
} from '@/lib/plan/status-action'

describe('planStatusActions — 일정 상태 버튼', () => {
  it('초안에서는 확정만 연다 — 완료를 열지 않는다', () => {
    expect(planStatusActions('DRAFT')).toEqual([
      { kind: 'confirm', nextStatus: 'CONFIRMED', variant: 'primary', direction: 'forward' },
    ])
  })

  it('확정에서는 완료가 주 행동이고 초안 되돌리기는 보조다', () => {
    expect(planStatusActions('CONFIRMED')).toEqual([
      { kind: 'complete', nextStatus: 'COMPLETED', variant: 'primary', direction: 'forward' },
      { kind: 'revert-draft', nextStatus: 'DRAFT', variant: 'secondary', direction: 'reverse' },
    ])
  })

  it('완료에서는 확정으로만 되돌린다 — 초안으로는 가지 않는다', () => {
    expect(planStatusActions('COMPLETED')).toEqual([
      { kind: 'reopen', nextStatus: 'CONFIRMED', variant: 'secondary', direction: 'reverse' },
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

/*
  자리를 가르는 축이다 (#653 · 진단 PL-2 · 명세 D11-2) — 정방향은 개요 아래 전폭 버튼,
  역방향은 `⋯` 메뉴. "드물다" 나 "위험하다" 로 가르지 않았다: 전이는 넷 다 되돌릴 수 있다.
*/
describe('방향 — 전폭 버튼과 메뉴를 가른다', () => {
  it('정방향은 상태마다 최대 하나다', () => {
    expect(forwardStatusAction('DRAFT')?.kind).toBe('confirm')
    expect(forwardStatusAction('CONFIRMED')?.kind).toBe('complete')
  })

  /* 다녀온 일정이 가장 세게 미는 것이 되돌리기일 이유가 없다 — 그 화면의 할 일은 읽는 것 */
  it('완료에는 정방향이 없다 — 전폭 버튼이 0개가 된다', () => {
    expect(forwardStatusAction('COMPLETED')).toBeUndefined()
  })

  it('초안에는 역방향이 없다 — 되돌아갈 앞 상태가 없다', () => {
    expect(reverseStatusActions('DRAFT')).toEqual([])
  })

  it('확정·완료의 되돌리기는 역방향이다', () => {
    expect(reverseStatusActions('CONFIRMED').map((a) => a.kind)).toEqual(['revert-draft'])
    expect(reverseStatusActions('COMPLETED').map((a) => a.kind)).toEqual(['reopen'])
  })

  /* 둘로 갈라도 합치면 원래 목록이다 — 한쪽에만 있거나 양쪽에 있는 액션이 없어야 한다 */
  it('정방향과 역방향을 합치면 전체 목록이다', () => {
    for (const code of ['DRAFT', 'CONFIRMED', 'COMPLETED', 'ARCHIVED']) {
      const forward = forwardStatusAction(code)
      const split = [...(forward === undefined ? [] : [forward]), ...reverseStatusActions(code)]

      expect(split).toEqual(planStatusActions(code))
    }
  })
})

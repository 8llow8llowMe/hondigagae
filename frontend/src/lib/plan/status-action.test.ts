import { describe, expect, it } from 'vitest'

import { planPhaseOf } from '@/lib/plan/date'
import {
  forwardStatusAction,
  planStatusActionLayout,
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

/**
 * 시점 축 (#732 · 진단 665-1). `direction` 이 첫 번째 축이고 이것이 두 번째다 —
 * 출발 전날 화면에서 가장 큰 색면이 `여행 완료하기` 였다.
 *
 * `today` 는 로컬 정오다 (`packing-promotion.test.ts` 와 같은 이유).
 */
describe('planStatusActionLayout — 아직 이를 수 없는 정방향은 메뉴로 내려간다', () => {
  const TODAY = new Date(2026, 8, 18, 12) // 2026-09-18

  function layout(statusCode: string, startDate: string, endDate: string) {
    return planStatusActionLayout(statusCode, planPhaseOf(startDate, endDate, TODAY))
  }

  it('출발 전날(D-1)의 `여행 완료하기` 는 버튼이 아니라 메뉴다', () => {
    const upcoming = layout('CONFIRMED', '2026-09-19', '2026-09-21')

    expect(upcoming.button).toBeUndefined()
    expect(upcoming.menu.map((action) => action.kind)).toEqual(['complete', 'revert-draft'])
  })

  it('출발 당일(D-DAY)도 아직 마친 여행이 아니다 — planPhaseOf 가 upcoming 에 남긴다', () => {
    expect(layout('CONFIRMED', '2026-09-18', '2026-09-20').button).toBeUndefined()
  })

  it('여행 중이면 버튼으로 돌아온다', () => {
    const ongoing = layout('CONFIRMED', '2026-09-17', '2026-09-20')

    expect(ongoing.button?.kind).toBe('complete')
    expect(ongoing.menu.map((action) => action.kind)).toEqual(['revert-draft'])
  })

  it('지난 일정에서도 버튼이다 — 그때가 바로 완료를 누를 때다', () => {
    expect(layout('CONFIRMED', '2026-09-10', '2026-09-12').button?.kind).toBe('complete')
  })

  /*
    이 판정이 가르는 것은 "정방향이냐" 가 아니라 "아직 이를 수 없는 일이냐" 다.
    전부 내리면 #553 이 확정 버튼을 개요 아래로 끌어올린 결정까지 되돌아간다.
  */
  it('출발 전 초안의 `확정하기` 는 그대로 버튼이다 — 그날 할 수 있는 일이다', () => {
    const upcoming = layout('DRAFT', '2026-09-19', '2026-09-21')

    expect(upcoming.button?.kind).toBe('confirm')
    expect(upcoming.menu).toEqual([])
  })

  it('완료 일정은 시점과 무관하게 버튼이 없다 — 정방향 자체가 없다', () => {
    const past = layout('COMPLETED', '2026-09-10', '2026-09-12')
    const upcoming = layout('COMPLETED', '2026-09-19', '2026-09-21')

    expect(past.button).toBeUndefined()
    expect(upcoming.button).toBeUndefined()
    expect(upcoming.menu.map((action) => action.kind)).toEqual(['reopen'])
  })

  it('날짜를 못 읽으면 있던 진입점을 감추지 않는다', () => {
    expect(planStatusActionLayout('CONFIRMED', null).button?.kind).toBe('complete')
  })

  /* 버튼과 메뉴를 합치면 원래 목록이다 — 두 곳에 서거나 사라지는 액션이 없어야 한다 */
  it('어느 시점에서도 액션이 사라지거나 겹치지 않는다', () => {
    for (const code of ['DRAFT', 'CONFIRMED', 'COMPLETED', 'ARCHIVED']) {
      for (const [start, end] of [
        ['2026-09-19', '2026-09-21'],
        ['2026-09-17', '2026-09-20'],
        ['2026-09-10', '2026-09-12'],
      ] as const) {
        const { button, menu } = layout(code, start, end)
        const all = [...(button === undefined ? [] : [button]), ...menu]

        expect([...all].sort((a, b) => a.kind.localeCompare(b.kind))).toEqual(
          [...planStatusActions(code)].sort((a, b) => a.kind.localeCompare(b.kind)),
        )
      }
    }
  })
})

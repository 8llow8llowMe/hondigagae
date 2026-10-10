import { describe, expect, it } from 'vitest'

import { messages } from '@/lib/messages'
import type { PlanPhase } from '@/lib/plan/date'
import { planPhaseLabel, planPhaseNote } from '@/lib/plan/phase-text'

/**
 * 판정(`planPhaseOf`)과 표기를 갈라 둔 경계를 잠근다.
 *
 * **`past` 와 `null` 이 둘 다 `null` 을 돌려주는 것이 계약이다** — 지난 일정의 기둥을
 * 비우는 동작이 여기 달려 있는데, 렌더 테스트는 `not.toMatch(/D-\d/)` 로만 봐서 이걸
 * 직접 잡지 못한다.
 */
describe('기둥 문구 (planPhaseLabel)', () => {
  it('다가오는 일정은 D-N 이다', () => {
    expect(planPhaseLabel({ kind: 'upcoming', days: 11 })).toBe('D-11')
  })

  it('출발 당일은 D-DAY 다 — D-0 이라고 쓰지 않는다', () => {
    expect(planPhaseLabel({ kind: 'upcoming', days: 0 })).toBe(messages.plan.ddayToday)
  })

  it('여행 중은 며칠째인지 말하지 않는다 — 기둥이 좁다', () => {
    expect(planPhaseLabel({ kind: 'ongoing', day: 4 })).toBe(messages.plan.ongoing)
  })

  it('지난 일정은 기둥을 비운다 — D+3 같은 말을 지어내지 않는다', () => {
    expect(planPhaseLabel({ kind: 'past' })).toBeNull()
  })

  it('판정을 못 했으면 기둥을 비운다', () => {
    expect(planPhaseLabel(null)).toBeNull()
  })
})

describe('날짜 줄 덧말 (planPhaseNote)', () => {
  it('여행 중일 때만 있다', () => {
    expect(planPhaseNote({ kind: 'ongoing', day: 4 })).toBe('오늘 4일차')
  })

  it('나머지 갈래에는 없다', () => {
    const others: (PlanPhase | null)[] = [
      { kind: 'upcoming', days: 11 },
      { kind: 'upcoming', days: 0 },
      { kind: 'past' },
      null,
    ]

    for (const phase of others) expect(planPhaseNote(phase)).toBeNull()
  })
})

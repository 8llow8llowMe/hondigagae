import { describe, expect, it } from 'vitest'

import { formatPlanDateRange, isPastPlan, planPhaseOf, weekdayOf } from '@/lib/plan/date'
import {
  countByPet,
  countByStatus,
  filterPlans,
  groupPlans,
  hasActiveFilters,
} from '@/lib/plan/list'
import type { PlanStatusCode, PlanSummaryItem } from '@/types/plan'

const STATUS_NAMES: Record<PlanStatusCode, string> = {
  DRAFT: '초안',
  CONFIRMED: '확정',
  COMPLETED: '완료',
}

function plan(overrides: Partial<PlanSummaryItem> = {}): PlanSummaryItem {
  const code = (overrides.status?.code ?? 'DRAFT') as PlanStatusCode
  const merged = {
    planId: '1234567890123456789',
    petId: '9876543210987654321',
    petIds: ['9876543210987654321'],
    areaCode: '39',
    title: '몽실이와 제주 2박 3일',
    startDate: '2026-09-12',
    endDate: '2026-09-14',
    status: { code, name: STATUS_NAMES[code] ?? code, description: null },
    ...overrides,
  }

  /*
    **`petIds` 는 `petId` 를 따라간다** — 지정하지 않으면 한 마리 일정이다. 고정값으로 두면
    `plan({ petId: 'p1' })` 이 대표만 바뀌고 동행은 옛 아이디로 남아, 반려견 축 테스트가
    조용히 엉뚱한 것을 검증한다.
  */
  return { ...merged, petIds: overrides.petIds ?? [merged.petId] } satisfies PlanSummaryItem
}

/** 아트보드가 쓴 날짜다. 2026-08-27 기준으로 D-16 이 나온다 */
const TODAY = new Date(2026, 7, 27)

describe('날짜 — 타임존에 흔들리지 않는다', () => {
  it("'YYYY-MM-DD' 를 UTC 자정으로 읽어 KST 에서도 요일이 밀리지 않는다", () => {
    expect(weekdayOf('2026-09-12')).toBe('토')
    expect(weekdayOf('2026-09-14')).toBe('월')
  })

  it('달력에 없는 날짜는 다음 달로 넘기지 않고 null 이다', () => {
    expect(weekdayOf('2026-02-31')).toBeNull()
    expect(weekdayOf('2026-13-01')).toBeNull()
    expect(weekdayOf('오늘')).toBeNull()
  })

  it('같은 해면 종료일의 연도를 반복하지 않는다', () => {
    expect(formatPlanDateRange('2026-09-12', '2026-09-14')).toBe('2026-09-12 (토) – 09-14 (월)')
  })

  it('해를 넘기면 종료일에도 연도를 쓴다 — 12-30 – 01-02 는 거꾸로 읽힌다', () => {
    expect(formatPlanDateRange('2026-12-30', '2027-01-02')).toBe(
      '2026-12-30 (수) – 2027-01-02 (토)',
    )
  })

  it('하루짜리 일정은 한 번만 쓴다', () => {
    expect(formatPlanDateRange('2026-04-11', '2026-04-11')).toBe('2026-04-11 (토)')
  })
})

describe('날짜 판정 — D-day · 여행 중 · 지남을 한 함수가 답한다', () => {
  it('아트보드의 D-16 을 재현한다', () => {
    expect(planPhaseOf('2026-09-12', '2026-09-14', TODAY)).toEqual({ kind: 'upcoming', days: 16 })
  })

  it('오늘 출발이면 D-DAY 쪽이다 — 여행 중이 아니다', () => {
    expect(planPhaseOf('2026-08-27', '2026-08-29', TODAY)).toEqual({ kind: 'upcoming', days: 0 })
  })

  it('하루짜리 일정을 당일에 봐도 여행 중을 거치지 않는다', () => {
    expect(planPhaseOf('2026-08-27', '2026-08-27', TODAY)).toEqual({ kind: 'upcoming', days: 0 })
  })

  /*
    #561 이 실제로 걸린 경계다 — dev 에서 `2026-09-11 ~ 09-14` 일정을 09-14 에 보니
    "다가오는 일정" 에 D-day 없이 서 있었다. 여기 세 건이 그 구간 전체를 덮는다.
  */
  it('이미 출발했고 오늘이 기간 안이면 여행 중이다 — 2일차부터 센다', () => {
    expect(planPhaseOf('2026-08-26', '2026-08-29', TODAY)).toEqual({ kind: 'ongoing', day: 2 })
  })

  it('마지막 날에도 아직 여행 중이다 — 이게 비어 있던 칸이다', () => {
    expect(planPhaseOf('2026-08-24', '2026-08-27', TODAY)).toEqual({ kind: 'ongoing', day: 4 })
  })

  it('종료 다음 날부터 지난 일정이다', () => {
    expect(planPhaseOf('2026-08-24', '2026-08-26', TODAY)).toEqual({ kind: 'past' })
  })

  it('날짜를 못 읽으면 null 이다 — 지난 쪽으로 밀지 않는다', () => {
    expect(planPhaseOf('없음', '2026-08-29', TODAY)).toBeNull()
    expect(planPhaseOf('2026-08-29', '없음', TODAY)).toBeNull()
  })

  /*
    기간이 역전된 깨진 데이터. 같은 파일의 `totalDaysBetween` 은 여기서 `null` 을 주는데,
    저쪽은 "셀 수 없다" 이고 이쪽은 "이미 끝난 것으로 본다" 라 답이 갈리는 게 맞다.
    중요한 건 `ongoing` 으로 새지 않는 것이다 — `오늘 -3일차` 같은 말이 나가면 안 된다.
  */
  it('기간이 역전돼도 여행 중으로 새지 않는다', () => {
    expect(planPhaseOf('2026-08-29', '2026-08-26', TODAY)).toEqual({ kind: 'past' })
  })
})

describe('지난 일정 판정 — 날짜 기준이고 상태 기준이 아니다', () => {
  it('종료일이 오늘보다 이전이면 지난 일정이다', () => {
    expect(isPastPlan('2026-08-26', TODAY)).toBe(true)
  })

  it('오늘 끝나는 일정은 아직 지나지 않았다', () => {
    expect(isPastPlan('2026-08-27', TODAY)).toBe(false)
  })

  it('상태가 확정이어도 날짜가 지났으면 지난 일정이다', () => {
    const { past } = groupPlans(
      [
        plan({
          endDate: '2026-05-04',
          startDate: '2026-05-02',
          status: { code: 'CONFIRMED', name: '확정', description: null },
        }),
      ],
      TODAY,
    )
    expect(past).toHaveLength(1)
  })

  it('날짜를 못 읽으면 지난 쪽으로 밀지 않는다', () => {
    expect(isPastPlan('없음', TODAY)).toBe(false)
  })
})

describe('나누기 · 재정렬', () => {
  const A = plan({ planId: 'a', startDate: '2026-09-12', endDate: '2026-09-14' })
  const B = plan({ planId: 'b', startDate: '2026-10-03', endDate: '2026-10-04' })
  const OLD = plan({ planId: 'c', startDate: '2026-05-02', endDate: '2026-05-04' })
  const OLDER = plan({ planId: 'd', startDate: '2026-04-11', endDate: '2026-04-11' })

  it('다가오는 일정은 가까운 여행이 위로 온다 — 서버의 id DESC 를 따르지 않는다', () => {
    // 서버가 주는 순서(만든 역순)를 흉내 낸다
    const { upcoming } = groupPlans([B, A], TODAY)
    expect(upcoming.map((p) => p.planId)).toEqual(['a', 'b'])
  })

  it('지난 일정은 최근 여행이 위로 온다', () => {
    const { past } = groupPlans([OLDER, OLD], TODAY)
    expect(past.map((p) => p.planId)).toEqual(['c', 'd'])
  })

  it('같은 날 출발하면 planId 로 순서를 고정한다 — 브라우저마다 갈리지 않게', () => {
    const x = plan({ planId: 'x', startDate: '2026-09-12' })
    const y = plan({ planId: 'y', startDate: '2026-09-12' })
    expect(groupPlans([y, x], TODAY).upcoming.map((p) => p.planId)).toEqual(['x', 'y'])
  })

  /*
    #561. 전에는 칸이 `upcoming` / `past` 둘뿐이라 여행 중인 일정이 "다가오는 일정" 으로
    갔다. 아래 두 건이 그 회귀를 막는다 — 셋으로 갈리는지와, 셋 다 서로를 침범하지 않는지.
  */
  it('오늘이 여행 기간 안이면 여행 중으로 간다 — 다가오는 쪽이 아니다', () => {
    const NOW = plan({ planId: 'n', startDate: '2026-08-24', endDate: '2026-08-27' })
    const { ongoing, upcoming, past } = groupPlans([NOW], TODAY)

    expect(ongoing.map((p) => p.planId)).toEqual(['n'])
    expect(upcoming).toHaveLength(0)
    expect(past).toHaveLength(0)
  })

  it('세 칸이 각자 자기 것만 가져간다', () => {
    const NOW = plan({ planId: 'n', startDate: '2026-08-24', endDate: '2026-08-27' })
    const { ongoing, upcoming, past } = groupPlans([B, OLD, NOW, A], TODAY)

    expect(ongoing.map((p) => p.planId)).toEqual(['n'])
    expect(upcoming.map((p) => p.planId)).toEqual(['a', 'b'])
    expect(past.map((p) => p.planId)).toEqual(['c'])
  })

  it('날짜를 못 읽으면 다가오는 쪽에 둔다', () => {
    const BROKEN = plan({ planId: 'z', startDate: '없음', endDate: '없음' })
    const { ongoing, upcoming, past } = groupPlans([BROKEN], TODAY)

    expect(upcoming.map((p) => p.planId)).toEqual(['z'])
    expect(ongoing).toHaveLength(0)
    expect(past).toHaveLength(0)
  })
})

describe('좁히기', () => {
  const DRAFT = plan({ planId: 'a', petId: 'p1' })
  const CONFIRMED = plan({
    planId: 'b',
    petId: 'p2',
    status: { code: 'CONFIRMED', name: '확정', description: null },
  })
  const ALL = [DRAFT, CONFIRMED]

  it('기본 필터는 아무것도 거르지 않는다', () => {
    expect(filterPlans(ALL, { status: 'ALL', petIds: [] })).toEqual(ALL)
    expect(hasActiveFilters({ status: 'ALL', petIds: [] })).toBe(false)
  })

  it('상태는 배타 축이다', () => {
    expect(filterPlans(ALL, { status: 'DRAFT', petIds: [] })).toEqual([DRAFT])
  })

  it('반려견은 다중 축이라 여러 마리를 켜면 둘 다 남는다', () => {
    expect(filterPlans(ALL, { status: 'ALL', petIds: ['p1', 'p2'] })).toEqual(ALL)
  })

  it('두 축은 함께 걸린다', () => {
    expect(filterPlans(ALL, { status: 'DRAFT', petIds: ['p2'] })).toEqual([])
  })

  /*
    #152 — 백엔드도 `GET /plans?petId=` 를 대표 컬럼과 조인 테이블을 **둘 다** 보도록
    바꿨다. 대표만 보면 둘째 반려견으로 거를 때 일정이 사라진다.
  */
  it('동행 반려견으로 걸러도 잡힌다 — 대표만 보지 않는다', () => {
    const together = plan({ planId: 'c', petId: 'p1', petIds: ['p1', 'p3'] })

    expect(filterPlans([together], { status: 'ALL', petIds: ['p3'] })).toEqual([together])
  })
})

describe('개수 — 0 을 감추지 않는다', () => {
  it('없는 상태도 0 으로 센다', () => {
    const counts = countByStatus([plan()])
    expect(counts).toEqual({ ALL: 1, DRAFT: 1, CONFIRMED: 0, COMPLETED: 0 })
  })

  it('서버가 모르는 상태 코드를 내려도 ALL 합계는 맞는다', () => {
    const counts = countByStatus([
      plan({ status: { code: 'ARCHIVED', name: '보관', description: null } }),
    ])
    expect(counts.ALL).toBe(1)
    expect(counts.DRAFT + counts.CONFIRMED + counts.COMPLETED).toBe(0)
  })

  it('반려견별로 센다', () => {
    const counts = countByPet([plan({ petId: 'p1' }), plan({ petId: 'p1' }), plan({ petId: 'p2' })])
    expect(counts.get('p1')).toBe(2)
    expect(counts.get('p2')).toBe(1)
  })

  /*
    합이 일정 수를 넘는 게 맞다 — 좁히기가 "한 마리라도 동행이면 히트" 이므로 대표만 세면
    "초코 0건" 이라고 적어 놓고 골랐을 때 일정이 나오는 모순이 생긴다 (#152).
  */
  it('동행 일정은 아이마다 한 번씩 센다', () => {
    const counts = countByPet([plan({ petId: 'p1', petIds: ['p1', 'p2'] })])

    expect(counts.get('p1')).toBe(1)
    expect(counts.get('p2')).toBe(1)
  })
})

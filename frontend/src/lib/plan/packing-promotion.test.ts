import { describe, expect, it } from 'vitest'

import {
  isPackingPromotionWindow,
  PACKING_PROMOTION_MAX_DAYS,
  packingPlacement,
} from '@/lib/plan/packing-promotion'
import type { PlanPackingListResponse } from '@/types/plan'

/**
 * 준비물 시간 승격 경계 (명세 D11-9-1 · D11-9-6).
 *
 * `today` 를 인자로 주입받으므로 **시계를 고정할 필요가 없다.** 아래 `today` 는 모두
 * 로컬 정오다 — `todayUtc()` 가 로컬 getter 로 날짜를 읽어서, 자정으로 만들면 타임존에
 * 따라 하루가 밀린다 (`lib/date/day.ts` `dayToLocalNoon` 주석과 같은 이유).
 */
const TODAY = new Date(2026, 8, 18, 12) // 2026-09-18

function plan(startDate: string, endDate: string) {
  return { startDate, endDate }
}

describe('isPackingPromotionWindow — 승격 창은 D-1 과 D-0 둘뿐', () => {
  it('D-2 는 올리지 않는다 — 창의 바깥쪽 경계다', () => {
    expect(isPackingPromotionWindow(plan('2026-09-20', '2026-09-22'), TODAY)).toBe(false)
  })

  it('D-1 은 올린다 — 창의 안쪽 경계다', () => {
    expect(isPackingPromotionWindow(plan('2026-09-19', '2026-09-21'), TODAY)).toBe(true)
  })

  it('출발 당일(D-0)도 올린다 — planPhaseOf 가 당일을 upcoming 에 남긴다', () => {
    expect(isPackingPromotionWindow(plan('2026-09-18', '2026-09-20'), TODAY)).toBe(true)
  })

  it('여행 중 2일차는 내려간다 — 출발한 뒤의 준비물은 과업이 아니라 기록이다', () => {
    expect(isPackingPromotionWindow(plan('2026-09-17', '2026-09-20'), TODAY)).toBe(false)
  })

  it('마지막날도 내려간다 — 여행 중 전체가 비승격이다', () => {
    expect(isPackingPromotionWindow(plan('2026-09-16', '2026-09-18'), TODAY)).toBe(false)
  })

  it('지난 일정은 올리지 않는다 — 다녀온 여행에서 짐 목록을 맨 위로 올릴 이유가 없다', () => {
    expect(isPackingPromotionWindow(plan('2026-09-10', '2026-09-12'), TODAY)).toBe(false)
  })

  it('날짜를 못 읽으면 기본 순서를 지킨다 — 근거 없이 배치를 바꾸지 않는다', () => {
    expect(isPackingPromotionWindow(plan('2026-13-01', '2026-13-03'), TODAY)).toBe(false)
  })

  it('기간이 역전된 데이터는 past 로 떨어져 비승격이다 — planPhaseOf 에 위임한 값이다', () => {
    expect(isPackingPromotionWindow(plan('2026-09-19', '2026-09-17'), TODAY)).toBe(false)
  })

  it('자정을 넘기면 D-2 가 D-1 이 되어 열린다 — 날짜 칸으로만 센다', () => {
    const beforeMidnight = new Date(2026, 8, 18, 23, 59)
    const afterMidnight = new Date(2026, 8, 19, 0, 0)

    expect(isPackingPromotionWindow(plan('2026-09-20', '2026-09-22'), beforeMidnight)).toBe(false)
    expect(isPackingPromotionWindow(plan('2026-09-20', '2026-09-22'), afterMidnight)).toBe(true)
  })

  it('창은 상수 하나다 — 넓히려면 여기만 바꾼다', () => {
    expect(PACKING_PROMOTION_MAX_DAYS).toBe(1)
  })
})

/**
 * 내용 조건 (#732 · 진단 665-3).
 *
 * #665 는 시간만 보고 올렸다 — 그래서 출발 전날에 올라온 카드가 **비어 있었다**.
 * 승격의 보상이 "빈 상태를 더 잘 보이는 자리로 옮긴 것" 이 되면 안 된다.
 */
describe('packingPlacement — 자리는 시간과 내용을 함께 본다', () => {
  function list(count: number): PlanPackingListResponse {
    return {
      planId: '1',
      generatedAt: count > 0 ? '2026-09-18T00:00:00' : null,
      totalCount: count,
      checkedCount: 0,
      items: Array.from({ length: count }, (_, index) => ({
        packingItemId: String(index),
        category: '반려견 케어',
        name: `준비물 ${index}`,
        reason: null,
        checked: false,
        sortOrder: index,
        source: { code: 'AI', name: 'AI 추천', description: null },
      })),
    }
  }

  const upcoming = plan('2026-09-19', '2026-09-21')
  const ongoing = plan('2026-09-17', '2026-09-20')
  const past = plan('2026-09-10', '2026-09-12')

  it('D-1 이고 담을 것이 있으면 올린다', () => {
    expect(packingPlacement(upcoming, TODAY, list(3))).toBe('promoted')
  })

  it('D-1 인데 비어 있으면 올리지 않고 스트립으로 유도한다', () => {
    expect(packingPlacement(upcoming, TODAY, list(0))).toBe('strip')
  })

  it('아직 못 읽었으면 기본 자리를 지킨다 — null 은 "비었다" 가 아니다', () => {
    expect(packingPlacement(upcoming, TODAY, null)).toBe('default')
  })

  it('여행 중·지난 일정은 담을 것이 있어도 기본 자리다 — 짐은 떠나기 전에 싼다', () => {
    expect(packingPlacement(ongoing, TODAY, list(3))).toBe('default')
    expect(packingPlacement(past, TODAY, list(3))).toBe('default')
  })

  it('창이 닫혀 있으면 비어도 스트립을 띄우지 않는다 — 그날의 과업이 아니다', () => {
    expect(packingPlacement(ongoing, TODAY, list(0))).toBe('default')
    expect(packingPlacement(past, TODAY, list(0))).toBe('default')
  })
})

import { describe, expect, it } from 'vitest'

import { isPackingPromoted, PACKING_PROMOTION_MAX_DAYS } from '@/lib/plan/packing-promotion'

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

describe('isPackingPromoted — 승격 창은 D-1 과 D-0 둘뿐', () => {
  it('D-2 는 올리지 않는다 — 창의 바깥쪽 경계다', () => {
    expect(isPackingPromoted(plan('2026-09-20', '2026-09-22'), TODAY)).toBe(false)
  })

  it('D-1 은 올린다 — 창의 안쪽 경계다', () => {
    expect(isPackingPromoted(plan('2026-09-19', '2026-09-21'), TODAY)).toBe(true)
  })

  it('출발 당일(D-0)도 올린다 — planPhaseOf 가 당일을 upcoming 에 남긴다', () => {
    expect(isPackingPromoted(plan('2026-09-18', '2026-09-20'), TODAY)).toBe(true)
  })

  it('여행 중 2일차는 내려간다 — 출발한 뒤의 준비물은 과업이 아니라 기록이다', () => {
    expect(isPackingPromoted(plan('2026-09-17', '2026-09-20'), TODAY)).toBe(false)
  })

  it('마지막날도 내려간다 — 여행 중 전체가 비승격이다', () => {
    expect(isPackingPromoted(plan('2026-09-16', '2026-09-18'), TODAY)).toBe(false)
  })

  it('지난 일정은 올리지 않는다 — 다녀온 여행에서 짐 목록을 맨 위로 올릴 이유가 없다', () => {
    expect(isPackingPromoted(plan('2026-09-10', '2026-09-12'), TODAY)).toBe(false)
  })

  it('날짜를 못 읽으면 기본 순서를 지킨다 — 근거 없이 배치를 바꾸지 않는다', () => {
    expect(isPackingPromoted(plan('2026-13-01', '2026-13-03'), TODAY)).toBe(false)
  })

  it('기간이 역전된 데이터는 past 로 떨어져 비승격이다 — planPhaseOf 에 위임한 값이다', () => {
    expect(isPackingPromoted(plan('2026-09-19', '2026-09-17'), TODAY)).toBe(false)
  })

  it('자정을 넘기면 D-2 가 D-1 이 되어 열린다 — 날짜 칸으로만 센다', () => {
    const beforeMidnight = new Date(2026, 8, 18, 23, 59)
    const afterMidnight = new Date(2026, 8, 19, 0, 0)

    expect(isPackingPromoted(plan('2026-09-20', '2026-09-22'), beforeMidnight)).toBe(false)
    expect(isPackingPromoted(plan('2026-09-20', '2026-09-22'), afterMidnight)).toBe(true)
  })

  it('창은 상수 하나다 — 넓히려면 여기만 바꾼다', () => {
    expect(PACKING_PROMOTION_MAX_DAYS).toBe(1)
  })
})

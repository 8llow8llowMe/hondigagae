import { describe, expect, it } from 'vitest'

import { editStartTimesRegress, planDayItemsPayload, toEditItems } from '@/lib/plan/day-items'
import { routeReorderAllowed, routeReorderSuggestion } from '@/lib/plan/route-reorder'
import { planItem, planItemPlace } from '@/test/fixtures/plan'
import type { PlanItemDetail } from '@/types/plan'

/*
  좌표는 제주 위도(33.4)의 한 줄 위에 경도만 바꿔 둔다 — 경도 0.05 가 약 4.65km 다.
  A(126.50) · B(126.55) · C(126.60) · D(126.65) 순서가 서쪽에서 동쪽이다.
*/
const LAT = 33.4

function at(id: string, lng: number, overrides: Partial<PlanItemDetail> = {}): PlanItemDetail {
  return planItem({
    planItemId: id,
    day: 1,
    sequence: 0,
    title: id,
    place: planItemPlace({ lat: LAT, lng }),
    ...overrides,
  })
}

const LODGING = { code: 'LODGING', name: '숙박', description: null }

function ids(items: PlanItemDetail[] | undefined): string[] {
  return (items ?? []).map((item) => item.planItemId)
}

describe('routeReorderSuggestion — 되돌아가는 동선 (#1462 · D31-1)', () => {
  it('A → C → B → D 처럼 되돌아가면 A → B → C → D 를 제안한다', () => {
    const result = routeReorderSuggestion(
      [at('A', 126.5), at('C', 126.6), at('B', 126.55), at('D', 126.65)],
      null,
    )

    expect(ids(result?.order)).toEqual(['A', 'B', 'C', 'D'])
    // 23.2km → 13.9km. 9.3km 가 준다
    expect(result?.savedMeters).toBeGreaterThan(9_000)
    expect(result?.savedMeters).toBeLessThan(9_500)
  })

  it('이미 한 방향으로 흐르면 제안하지 않는다', () => {
    expect(
      routeReorderSuggestion(
        [at('A', 126.5), at('B', 126.55), at('C', 126.6), at('D', 126.65)],
        null,
      ),
    ).toBeNull()
  })

  it('줄어드는 거리가 3km 미만이면 제안하지 않는다 — 순서를 흔들 값이 아니다', () => {
    // 0.93 + 0.47 + 0.93 = 2.3km → 1.4km. 0.9km 준다
    expect(
      routeReorderSuggestion(
        [at('A', 126.5), at('C', 126.51), at('B', 126.505), at('D', 126.515)],
        null,
      ),
    ).toBeNull()
  })

  it('숙박(LODGING)은 제자리에 두고 그 앞 구간만 다시 놓는다', () => {
    const result = routeReorderSuggestion(
      [at('A', 126.5), at('C', 126.6), at('B', 126.55), at('L', 126.65, { itemType: LODGING })],
      null,
    )

    expect(ids(result?.order)).toEqual(['A', 'B', 'C', 'L'])
  })

  it('맨 앞 숙박도 움직이지 않는다 — 아침 체크아웃 자리다', () => {
    const result = routeReorderSuggestion(
      [at('L', 126.5, { itemType: LODGING }), at('C', 126.6), at('B', 126.55), at('D', 126.65)],
      null,
    )

    expect(ids(result?.order)).toEqual(['L', 'B', 'C', 'D'])
  })

  it('시각이 박힌 항목은 제자리다 — 시각의 순서가 그대로라 역행이 새로 생기지 않는다', () => {
    const result = routeReorderSuggestion(
      [
        at('A', 126.5, { startTime: '10:00:00' }),
        at('C', 126.6),
        at('B', 126.55),
        at('D', 126.65, { startTime: '15:00:00' }),
      ],
      null,
    )

    expect(ids(result?.order)).toEqual(['A', 'B', 'C', 'D'])
    expect(result?.order[0]?.startTime).toBe('10:00:00')
    expect(result?.order[3]?.startTime).toBe('15:00:00')
  })

  it('되돌아가는 원인이 시각 박힌 항목이면 제안하지 않는다 — 그것은 움직이지 않는다', () => {
    expect(
      routeReorderSuggestion(
        [
          at('A', 126.5),
          at('C', 126.6, { startTime: '12:00:00' }),
          at('B', 126.55),
          at('D', 126.65),
        ],
        null,
      ),
    ).toBeNull()
  })

  it('형식이 어긋난 시각은 시각이 없는 것으로 본다 (D14-3)', () => {
    const result = routeReorderSuggestion(
      [at('A', 126.5), at('C', 126.6, { startTime: 'oops' }), at('B', 126.55), at('D', 126.65)],
      null,
    )

    expect(ids(result?.order)).toEqual(['A', 'B', 'C', 'D'])
  })

  it('좌표를 모르는 항목(이동 · 휴식 등)은 제자리이고 구간의 경계가 된다', () => {
    const move = at('M', 0, {
      itemType: { code: 'MOVE', name: '이동', description: null },
      place: null,
    })
    const result = routeReorderSuggestion(
      [at('A', 126.5), at('C', 126.6), at('B', 126.55), at('D', 126.65), move],
      null,
    )

    expect(ids(result?.order)).toEqual(['A', 'B', 'C', 'D', 'M'])
  })

  it('앞날 숙소(출발점)에서의 첫 이동도 거리에 넣는다', () => {
    const basis = at('PREV', 126.7, { itemType: LODGING, day: 0 })
    const items = [at('A', 126.5), at('B', 126.55)]

    // 출발점이 없으면 둘의 순서는 거리가 같다
    expect(routeReorderSuggestion(items, null)).toBeNull()
    // 동쪽 숙소에서 출발하면 B 부터 가는 편이 4.65km 짧다
    expect(ids(routeReorderSuggestion(items, basis)?.order)).toEqual(['B', 'A'])
  })

  it('움직일 항목이 8개 이상 이어진 구간은 다시 놓지 않는다 — 경우의 수 상한', () => {
    const lngs = [126.5, 126.6, 126.55, 126.65, 126.6, 126.7, 126.65, 126.75]
    const items = lngs.map((lng, index) => at(`P${index}`, lng))

    expect(routeReorderSuggestion(items, null)).toBeNull()
  })

  it('입력 배열을 바꾸지 않는다', () => {
    const items = [at('A', 126.5), at('C', 126.6), at('B', 126.55), at('D', 126.65)]
    routeReorderSuggestion(items, null)

    expect(ids(items)).toEqual(['A', 'C', 'B', 'D'])
  })
})

describe('제안 순서의 저장 — 편집기의 일괄 교체 그대로 (D31-2)', () => {
  const items = [
    at('A', 126.5, { startTime: '10:00:00', memo: '아침 산책' }),
    at('C', 126.6, { memo: '카페', targetId: '300' }),
    at('B', 126.55, { itemType: { code: 'MEAL', name: '식사', description: null } }),
    at('L', 126.65, { itemType: LODGING, startTime: '15:00:00' }),
  ]
  const order = routeReorderSuggestion(items, null)?.order ?? []

  it('메모 · 시각 · itemType 을 되싣고 sequence 만 다시 매긴다', () => {
    const payload = planDayItemsPayload(toEditItems(order), 1)

    expect(payload.items.map((item) => item.title)).toEqual(['A', 'B', 'C', 'L'])
    expect(payload.items.map((item) => item.sequence)).toEqual([0, 1, 2, 3])
    expect(payload.items[0]).toMatchObject({ startTime: '10:00:00', memo: '아침 산책' })
    expect(payload.items[1]).toMatchObject({ itemType: 'MEAL' })
    expect(payload.items[2]).toMatchObject({ memo: '카페', targetId: '300' })
    expect(payload.items[3]).toMatchObject({ itemType: 'LODGING', startTime: '15:00:00' })
  })

  it('시각 역행을 새로 만들지 않아 저장이 "시각도 맞출까요?" 를 묻지 않는다 (D25-3)', () => {
    expect(editStartTimesRegress(toEditItems(order))).toBe(false)
  })
})

describe('routeReorderAllowed — 제안을 낼 수 있는 날 (D31-3)', () => {
  const items = [at('A', 126.5)]
  const base = { statusCode: 'DRAFT', date: '2026-10-20', today: '2026-10-13', items }

  it('초안 · 확정의 아직 오지 않은 날에 낸다', () => {
    expect(routeReorderAllowed(base)).toBe(true)
    expect(routeReorderAllowed({ ...base, statusCode: 'CONFIRMED' })).toBe(true)
  })

  it('여행 당일도 낸다', () => {
    expect(routeReorderAllowed({ ...base, date: '2026-10-13' })).toBe(true)
  })

  it('완료 일정은 내지 않는다', () => {
    expect(routeReorderAllowed({ ...base, statusCode: 'COMPLETED' })).toBe(false)
  })

  it('지난 날은 내지 않는다 — 이미 다녀온 순서다', () => {
    expect(routeReorderAllowed({ ...base, date: '2026-10-12' })).toBe(false)
  })

  it('날짜를 모르면 내지 않는다', () => {
    expect(routeReorderAllowed({ ...base, date: null })).toBe(false)
  })

  it('다녀옴이 체크된 항목이 있는 날은 내지 않는다 — 일괄 교체가 체크를 지운다 (D9-2)', () => {
    expect(routeReorderAllowed({ ...base, items: [at('A', 126.5, { visited: true })] })).toBe(false)
  })
})

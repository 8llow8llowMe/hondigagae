import { describe, expect, it } from 'vitest'

import {
  hasEditChanges,
  moveEditItem,
  planDayItemsPayload,
  survivingItems,
  toEditItems,
  toggleRemoved,
} from '@/lib/plan/day-items'
import { planItem } from '@/test/fixtures/plan'
import type { PlanItemDetail } from '@/types/plan'

/** Snowflake — Number() 를 거치면 정밀도를 잃는 값이다 */
const BIG_ID = '212481712381923328'

const ITEMS: PlanItemDetail[] = [
  planItem({
    planItemId: 'a',
    day: 2,
    sequence: 0,
    title: '미술관',
    targetId: BIG_ID,
    memo: '실내라 비가 와도 괜찮아요',
    startTime: '10:00:00',
  }),
  planItem({ planItemId: 'b', day: 2, sequence: 1, title: '시장', targetId: '212481712381923334' }),
  planItem({
    planItemId: 'c',
    day: 2,
    sequence: 2,
    title: '이동',
    itemType: { code: 'MOVE', name: '이동', description: null },
    targetId: null,
  }),
]

describe('moveEditItem', () => {
  it('한 칸 위로 옮긴다', () => {
    const moved = moveEditItem(toEditItems(ITEMS), 1, 'up')

    expect(moved.map((entry) => entry.item.title)).toEqual(['시장', '미술관', '이동'])
  })

  it('한 칸 아래로 옮긴다', () => {
    const moved = moveEditItem(toEditItems(ITEMS), 0, 'down')

    expect(moved.map((entry) => entry.item.title)).toEqual(['시장', '미술관', '이동'])
  })

  it('맨 위에서 위로 · 맨 아래에서 아래로는 배열이 그대로다', () => {
    const items = toEditItems(ITEMS)

    // 참조까지 같아야 호출부가 "안 움직였다" 를 알 수 있다
    expect(moveEditItem(items, 0, 'up')).toBe(items)
    expect(moveEditItem(items, items.length - 1, 'down')).toBe(items)
  })

  it('범위 밖 index 는 배열을 그대로 둔다', () => {
    const items = toEditItems(ITEMS)

    expect(moveEditItem(items, -1, 'down')).toBe(items)
    expect(moveEditItem(items, 9, 'up')).toBe(items)
  })

  it('원본 배열을 바꾸지 않는다', () => {
    const items = toEditItems(ITEMS)
    moveEditItem(items, 0, 'down')

    expect(items.map((entry) => entry.item.title)).toEqual(['미술관', '시장', '이동'])
  })

  it('삭제 표시된 항목도 함께 움직인다 — 목록에 남아 있다', () => {
    const marked = toggleRemoved(toEditItems(ITEMS), 0)
    const moved = moveEditItem(marked, 0, 'down')

    expect(moved[1]?.item.title).toBe('미술관')
    expect(moved[1]?.removed).toBe(true)
  })
})

describe('toggleRemoved', () => {
  it('켜고 끈다 — 배열에서 빼지 않는다', () => {
    const once = toggleRemoved(toEditItems(ITEMS), 1)

    expect(once).toHaveLength(3)
    expect(once[1]?.removed).toBe(true)
    expect(toggleRemoved(once, 1)[1]?.removed).toBe(false)
  })
})

describe('hasEditChanges — 변경이 없으면 저장을 잠근다', () => {
  it('아무것도 안 했으면 false 다', () => {
    expect(hasEditChanges(toEditItems(ITEMS), ITEMS)).toBe(false)
  })

  it('순서를 바꾸면 true 다', () => {
    expect(hasEditChanges(moveEditItem(toEditItems(ITEMS), 0, 'down'), ITEMS)).toBe(true)
  })

  it('삭제 표시만 해도 true 다', () => {
    expect(hasEditChanges(toggleRemoved(toEditItems(ITEMS), 0), ITEMS)).toBe(true)
  })

  it('옮겼다가 되돌리면 false 다 — 같은 목록을 다시 보내지 않는다', () => {
    const back = moveEditItem(moveEditItem(toEditItems(ITEMS), 0, 'down'), 1, 'up')

    expect(hasEditChanges(back, ITEMS)).toBe(false)
  })
})

describe('planDayItemsPayload', () => {
  it('삭제 표시 항목이 빠지고 sequence 가 0부터 다시 매겨진다', () => {
    const payload = planDayItemsPayload(toggleRemoved(toEditItems(ITEMS), 0), 2)

    expect(payload.items.map((entry) => entry.title)).toEqual(['시장', '이동'])
    expect(payload.items.map((entry) => entry.sequence)).toEqual([0, 1])
  })

  it('memo · startTime · itemType 을 그대로 되돌려 싣는다 — 빼먹으면 지워진다', () => {
    const first = planDayItemsPayload(toEditItems(ITEMS), 2).items[0]

    expect(first?.memo).toBe('실내라 비가 와도 괜찮아요')
    expect(first?.startTime).toBe('10:00:00')
    expect(first?.itemType).toBe('PLACE')
  })

  it('targetId 를 문자열로 싣는다 — Snowflake 정밀도를 잃지 않는다', () => {
    const first = planDayItemsPayload(toEditItems(ITEMS), 2).items[0]

    expect(first?.targetId).toBe(BIG_ID)
    expect(typeof first?.targetId).toBe('string')
    // 숫자로 바꿨다면 값이 달라진다
    expect(String(Number(BIG_ID))).not.toBe(BIG_ID)
  })

  it('targetId 가 null 인 항목(MOVE)은 키 자체를 넣지 않는다', () => {
    const move = planDayItemsPayload(toEditItems(ITEMS), 2).items[2]

    expect(move).not.toHaveProperty('targetId')
  })

  it('memo · startTime 이 null 이면 키를 넣지 않는다', () => {
    const second = planDayItemsPayload(toEditItems(ITEMS), 2).items[1]

    expect(second).not.toHaveProperty('memo')
    expect(second).not.toHaveProperty('startTime')
  })

  it('day 를 경로값 그대로 싣는다 — 0 을 보내면 @Min(1) 에 걸린다', () => {
    const payload = planDayItemsPayload(toEditItems(ITEMS), 3)

    expect(payload.items.every((entry) => entry.day === 3)).toBe(true)
  })

  it('전부 삭제하면 빈 목록이다 — 서버가 허용하는 동작이라 막지 않는다', () => {
    let items = toEditItems(ITEMS)
    for (let index = 0; index < ITEMS.length; index += 1) items = toggleRemoved(items, index)

    expect(planDayItemsPayload(items, 2).items).toEqual([])
  })
})

describe('survivingItems', () => {
  it('저장 후 남을 항목만 준다', () => {
    expect(survivingItems(toggleRemoved(toEditItems(ITEMS), 1)).map((item) => item.title)).toEqual([
      '미술관',
      '이동',
    ])
  })
})

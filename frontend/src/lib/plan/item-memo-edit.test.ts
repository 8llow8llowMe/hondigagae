import { describe, expect, it } from 'vitest'

import { messages } from '@/lib/messages'
import {
  ITEM_MEMO_MAX,
  itemMemoChanged,
  itemMemoModalProps,
  itemMemoTargetOf,
  setItemMemoPayload,
  validateItemMemo,
  visitsToRestore,
} from '@/lib/plan/item-memo-edit'
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
    itemType: { code: 'PLACE', name: '장소', description: null },
    targetId: BIG_ID,
    memo: '실내라 비가 와도 괜찮아요',
    startTime: '10:00:00',
    visited: true,
  }),
  planItem({
    planItemId: 'b',
    day: 2,
    sequence: 1,
    title: '고기국수',
    itemType: { code: 'MEAL', name: '식사', description: null },
    targetId: '212481712381923334',
    memo: '줄이 길어요',
    startTime: '12:30:00',
    visited: false,
  }),
  planItem({
    planItemId: 'c',
    day: 2,
    sequence: 2,
    title: '이동',
    itemType: { code: 'MOVE', name: '이동', description: null },
    targetId: null,
    memo: null,
    startTime: null,
    visited: true,
  }),
]

describe('setItemMemoPayload', () => {
  it('고른 항목의 메모만 바꾸고 다른 항목의 필드는 그대로 되싣는다', () => {
    const payload = setItemMemoPayload(ITEMS, 2, 'b', '오픈런 추천')

    expect(payload).toEqual({
      items: [
        {
          day: 2,
          sequence: 0,
          itemType: 'PLACE',
          targetId: BIG_ID,
          title: '미술관',
          memo: '실내라 비가 와도 괜찮아요',
          startTime: '10:00:00',
        },
        {
          day: 2,
          sequence: 1,
          itemType: 'MEAL',
          targetId: '212481712381923334',
          title: '고기국수',
          memo: '오픈런 추천',
          startTime: '12:30:00',
        },
        { day: 2, sequence: 2, itemType: 'MOVE', title: '이동' },
      ],
    })
  })

  it('targetId 를 문자열 그대로 싣는다 — Snowflake 정밀도', () => {
    const payload = setItemMemoPayload(ITEMS, 2, 'b', '메모')

    expect(payload?.items[0]?.targetId).toBe(BIG_ID)
  })

  it('앞뒤 공백을 걷어 싣는다', () => {
    const payload = setItemMemoPayload(ITEMS, 2, 'c', '  주차장 넓음 \n')

    expect(payload?.items[2]?.memo).toBe('주차장 넓음')
  })

  it('null 이면 그 항목의 memo 키를 뺀다(지우기) — 다른 항목 메모는 남는다', () => {
    const payload = setItemMemoPayload(ITEMS, 2, 'a', null)

    expect(payload?.items[0]).not.toHaveProperty('memo')
    expect(payload?.items[0]?.startTime).toBe('10:00:00')
    expect(payload?.items[1]?.memo).toBe('줄이 길어요')
  })

  it('공백뿐이면 지우기와 같다', () => {
    const payload = setItemMemoPayload(ITEMS, 2, 'a', '   ')

    expect(payload?.items[0]).not.toHaveProperty('memo')
  })

  it('순서를 바꾸지 않는다 — sequence 를 화면 순서대로 0부터 매긴다', () => {
    const payload = setItemMemoPayload(ITEMS, 2, 'a', '바뀐 메모')

    expect(payload?.items.map((item) => [item.sequence, item.title])).toEqual([
      [0, '미술관'],
      [1, '고기국수'],
      [2, '이동'],
    ])
  })

  it('들고 있는 항목에 없으면 null — 보내지 않는다', () => {
    expect(setItemMemoPayload(ITEMS, 2, 'zzz', '메모')).toBeNull()
  })
})

describe('validateItemMemo', () => {
  it('500자까지는 통과한다', () => {
    expect(validateItemMemo('가'.repeat(ITEM_MEMO_MAX))).toBeNull()
  })

  it('501자면 문구를 낸다', () => {
    expect(validateItemMemo('가'.repeat(ITEM_MEMO_MAX + 1))).toBe(messages.plan.itemMemoTooLong)
  })

  it('길이는 걷어낸 값으로 잰다', () => {
    expect(validateItemMemo(`  ${'가'.repeat(ITEM_MEMO_MAX)}  `)).toBeNull()
  })

  it('빈 값은 막지 않는다 — 지우기다', () => {
    expect(validateItemMemo('')).toBeNull()
  })

  it('계약 상한과 같다(PlanItemRequest.memo maxLength 500)', () => {
    expect(ITEM_MEMO_MAX).toBe(500)
  })
})

describe('itemMemoChanged', () => {
  it('걷어낸 값이 같으면 바뀐 것이 아니다', () => {
    expect(itemMemoChanged('줄이 길어요', ' 줄이 길어요 ')).toBe(false)
  })

  it('null 과 빈 값은 같다', () => {
    expect(itemMemoChanged(null, '  ')).toBe(false)
  })

  it('다르면 바뀌었다', () => {
    expect(itemMemoChanged('줄이 길어요', '')).toBe(true)
  })
})

describe('visitsToRestore', () => {
  /** 교체 뒤 서버가 돌려준 그 일자 — planItemId 가 새로 발급되고 다녀옴이 풀린다 */
  const AFTER = ITEMS.map((item) => ({
    ...item,
    planItemId: `new-${item.planItemId}`,
    visited: false,
  }))

  it('교체 전 다녀옴이던 자리의 새 planItemId 를 돌려준다', () => {
    expect(visitsToRestore(ITEMS, AFTER)).toEqual(['new-a', 'new-c'])
  })

  it('이미 다녀옴으로 남아 있으면 다시 보내지 않는다', () => {
    const after = AFTER.map((item, index) => (index === 0 ? { ...item, visited: true } : item))

    expect(visitsToRestore(ITEMS, after)).toEqual(['new-c'])
  })

  it('자리의 항목이 다르면(유형 · 대상 · 이름) 건너뛴다 — 남의 행에 체크하지 않는다', () => {
    const after = AFTER.map((item, index) => (index === 0 ? { ...item, title: '다른 곳' } : item))

    expect(visitsToRestore(ITEMS, after)).toEqual(['new-c'])
  })

  it('항목 수가 다르면 아무것도 되살리지 않는다', () => {
    expect(visitsToRestore(ITEMS, AFTER.slice(0, 2))).toEqual([])
  })

  it('같은 장소가 두 번 담겨도 자리(순번)로 가른다 — 다녀온 쪽만 되살린다', () => {
    const twice = (planItemId: string, sequence: number, visited: boolean) =>
      planItem({ planItemId, day: 2, sequence, title: '협재해수욕장', targetId: BIG_ID, visited })
    const before = [twice('x', 0, false), twice('y', 1, true)]
    const after = [twice('new-x', 0, false), twice('new-y', 1, false)]

    expect(visitsToRestore(before, after)).toEqual(['new-y'])
  })

  it('다녀옴이 없던 날은 빈 배열이다', () => {
    const before = ITEMS.map((item) => ({ ...item, visited: false }))

    expect(visitsToRestore(before, AFTER)).toEqual([])
  })
})

describe('itemMemoTargetOf · itemMemoModalProps — 연 시점 스냅숏 (#1460 리뷰)', () => {
  it('열 때 제목 · 메모 · 자리를 적어 둔다', () => {
    expect(itemMemoTargetOf(2, ITEMS, 'b')).toEqual({
      day: 2,
      planItemId: 'b',
      index: 1,
      title: '고기국수',
      memo: '줄이 길어요',
    })
  })

  it('상세에 없는 항목이면 열지 않는다', () => {
    expect(itemMemoTargetOf(2, ITEMS, 'gone')).toBeNull()
  })

  it('모달은 스냅숏만 본다 — 교체로 상세 id 가 바뀌어도 열린 채 같은 열쇠다(onSaved 까지 유지)', () => {
    const target = itemMemoTargetOf(2, ITEMS, 'b')

    expect(itemMemoModalProps(target)).toEqual({
      open: true,
      key: 'memo:b',
      title: '고기국수',
      initial: '줄이 길어요',
    })
  })

  it('닫으면(null) 닫힌 열쇠다', () => {
    expect(itemMemoModalProps(null)).toEqual({
      open: false,
      key: 'memo:closed',
      title: '',
      initial: null,
    })
  })
})

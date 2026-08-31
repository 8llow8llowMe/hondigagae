import { describe, expect, it } from 'vitest'

import { draftItemCount, draftPlaceIds, draftToPlanPayload } from '@/lib/ai-plan/draft-to-plan'
import type { AiPlanDraft, AiPlanRequestSnapshot, AiPlanScheduleItem } from '@/types/ai-plan'

const snapshot: AiPlanRequestSnapshot = {
  areaCode: '39',
  startDate: '2026-09-12',
  endDate: '2026-09-14',
  petId: '123456789012000001',
  petName: '몽실이',
  budget: 300_000,
  requestNote: '실내 위주로',
}

function item(overrides: Partial<AiPlanScheduleItem> = {}): AiPlanScheduleItem {
  return {
    itemType: 'PLACE',
    placeId: '212481712381923328',
    title: '협재해수욕장',
    note: '오전이라 노면이 덜 뜨거워요.',
    ...overrides,
  }
}

function draft(days: AiPlanDraft['days']): AiPlanDraft {
  return { days, reasons: [] }
}

function payload(days: AiPlanDraft['days'], excludedPlaceIds?: Set<string>) {
  return draftToPlanPayload({
    draft: draft(days),
    snapshot,
    title: '몽실이와 제주 2박 3일',
    ...(excludedPlaceIds === undefined ? {} : { excludedPlaceIds }),
  })
}

describe('draftToPlanPayload — 일정 본문은 입력 조건에서 온다', () => {
  it('초안에 없는 조건(petId·기간·예산·areaCode)을 스냅샷에서 채운다', () => {
    const result = payload([{ day: 1, items: [item()] }])

    expect(result.petId).toBe('123456789012000001')
    expect(result.areaCode).toBe('39')
    expect(result.startDate).toBe('2026-09-12')
    expect(result.endDate).toBe('2026-09-14')
    expect(result.budget).toBe(300_000)
    expect(result.title).toBe('몽실이와 제주 2박 3일')
  })

  it('예산이 없으면 키 자체를 뺀다', () => {
    const result = draftToPlanPayload({
      draft: draft([{ day: 1, items: [item()] }]),
      snapshot: { ...snapshot, budget: null },
      title: '제주 2박 3일',
    })

    expect('budget' in result).toBe(false)
  })
})

describe('draftToPlanPayload — 항목 매핑', () => {
  it('day 를 그대로 쓰고 sequence 를 0부터 매긴다', () => {
    const result = payload([
      { day: 1, items: [item({ title: '가' }), item({ title: '나' })] },
      { day: 2, items: [item({ title: '다' })] },
    ])

    expect(result.items?.map((i) => [i.day, i.sequence, i.title])).toEqual([
      [1, 0, '가'],
      [1, 1, '나'],
      [2, 0, '다'],
    ])
  })

  it('note 를 memo 로 옮긴다', () => {
    const result = payload([{ day: 1, items: [item({ note: '목줄 착용 필수' })] }])
    expect(result.items?.[0]?.memo).toBe('목줄 착용 필수')
  })

  it('note 가 비면 memo 키를 뺀다', () => {
    const result = payload([{ day: 1, items: [item({ note: '   ' })] }])
    expect('memo' in (result.items?.[0] ?? {})).toBe(false)
  })

  it('startTime 을 보내지 않는다 — 초안에 없다', () => {
    const result = payload([{ day: 1, items: [item()] }])
    expect('startTime' in (result.items?.[0] ?? {})).toBe(false)
  })

  it('title 을 100자로 자른다 (ITEM_TITLE_LENGTH_INVALID)', () => {
    const result = payload([{ day: 1, items: [item({ title: '가'.repeat(140) })] }])
    expect(result.items?.[0]?.title).toHaveLength(100)
  })

  it('memo 를 500자로 자른다 (MEMO_LENGTH_INVALID)', () => {
    const result = payload([{ day: 1, items: [item({ note: '나'.repeat(700) })] }])
    expect(result.items?.[0]?.memo).toHaveLength(500)
  })
})

describe('draftToPlanPayload — targetId (명세 S5 함정 2)', () => {
  it('PLACE/MEAL/LODGING 은 placeId 를 targetId 로 보낸다', () => {
    const result = payload([
      {
        day: 1,
        items: [
          item({ itemType: 'PLACE', placeId: '1' }),
          item({ itemType: 'MEAL', placeId: '2' }),
          item({ itemType: 'LODGING', placeId: '3' }),
        ],
      },
    ])

    expect(result.items?.map((i) => i.targetId)).toEqual(['1', '2', '3'])
  })

  it('WALK 은 placeId 가 실려 와도 targetId 를 보내지 않는다 — walk_course.id 와 어긋난다', () => {
    const result = payload([{ day: 1, items: [item({ itemType: 'WALK', placeId: '999' })] }])

    expect(result.items).toHaveLength(1)
    expect('targetId' in (result.items?.[0] ?? {})).toBe(false)
  })

  it('MOVE 는 placeId 가 null 이라 targetId 가 없다', () => {
    const result = payload([{ day: 1, items: [item({ itemType: 'MOVE', placeId: null })] }])
    expect('targetId' in (result.items?.[0] ?? {})).toBe(false)
  })

  it('targetId 를 문자열로 유지한다 — Snowflake 정밀도', () => {
    const placeId = '212481712381923328'
    const result = payload([{ day: 1, items: [item({ placeId })] }])

    expect(result.items?.[0]?.targetId).toBe(placeId)
    expect(typeof result.items?.[0]?.targetId).toBe('string')
  })
})

describe('draftToPlanPayload — 보낼 수 없는 항목을 걸러낸다', () => {
  it('PlanItemType 에 없는 itemType 은 뺀다 — 하나가 어긋나면 요청 전체가 400 이다', () => {
    const result = payload([
      { day: 1, items: [item({ itemType: 'CAFE' }), item({ title: '살아남는 항목' })] },
    ])

    expect(result.items?.map((i) => i.title)).toEqual(['살아남는 항목'])
  })

  it('title 이 빈 항목은 뺀다 (@NotBlank)', () => {
    const result = payload([{ day: 1, items: [item({ title: '  ' }), item({ title: '남는 곳' })] }])
    expect(result.items?.map((i) => i.title)).toEqual(['남는 곳'])
  })

  it('day 가 1 미만인 일자는 뺀다 (@Min(1))', () => {
    const result = payload([
      { day: 0, items: [item({ title: '버려짐' })] },
      { day: 1, items: [item({ title: '남음' })] },
    ])

    expect(result.items?.map((i) => i.title)).toEqual(['남음'])
  })

  it('걸러낸 뒤 sequence 에 구멍을 남기지 않는다', () => {
    const result = payload([
      {
        day: 1,
        items: [item({ title: '가' }), item({ itemType: 'CAFE' }), item({ title: '나' })],
      },
    ])

    expect(result.items?.map((i) => i.sequence)).toEqual([0, 1])
  })
})

describe('draftToPlanPayload — PLAN_004 재시도 (명세 S5 함정 3)', () => {
  it('제외한 장소만 빼고 나머지는 그대로 담는다 — 초안을 버리지 않는다', () => {
    const result = payload(
      [
        {
          day: 1,
          items: [
            item({ title: '사라진 곳', placeId: '111' }),
            item({ title: '살아있는 곳', placeId: '222' }),
          ],
        },
      ],
      new Set(['111']),
    )

    expect(result.items?.map((i) => i.title)).toEqual(['살아있는 곳'])
    expect(result.items?.[0]?.sequence).toBe(0)
  })

  it('제외 목록은 placeId 가 없는 항목에 영향을 주지 않는다', () => {
    const result = payload(
      [{ day: 1, items: [item({ itemType: 'MOVE', placeId: null, title: '이동' })] }],
      new Set(['111']),
    )

    expect(result.items?.map((i) => i.title)).toEqual(['이동'])
  })
})

describe('draftPlaceIds', () => {
  it('보강·안내 대상이 되는 장소 id 만 모으고 중복을 접는다', () => {
    const ids = draftPlaceIds(
      draft([
        { day: 1, items: [item({ placeId: '1' }), item({ placeId: '1' })] },
        { day: 2, items: [item({ placeId: '2' }), item({ itemType: 'WALK', placeId: '3' })] },
      ]),
    )

    expect(ids).toEqual(['1', '2'])
  })
})

describe('draftItemCount', () => {
  it('모든 일자의 항목을 합산한다 — 요약줄의 "항목 N개"', () => {
    const count = draftItemCount(
      draft([
        { day: 1, items: [item(), item()] },
        { day: 2, items: [item()] },
      ]),
    )

    expect(count).toBe(3)
  })
})

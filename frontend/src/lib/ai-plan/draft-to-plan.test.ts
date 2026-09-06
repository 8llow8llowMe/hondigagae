import { describe, expect, it } from 'vitest'

import { draftItemCount, draftPlaceIds, draftToPlanPayload } from '@/lib/ai-plan/draft-to-plan'
import {
  aiPlanDraft,
  aiPlanItem,
  aiPlanItemWithNulls,
  aiPlanSnapshot as snapshot,
} from '@/test/fixtures/ai-plan'
import type { AiPlanDraft, AiPlanScheduleItem } from '@/types/ai-plan'

function item(overrides: Partial<AiPlanScheduleItem> = {}): AiPlanScheduleItem {
  return aiPlanItem({ title: '협재해수욕장', ...overrides })
}

function draft(days: AiPlanDraft['days']): AiPlanDraft {
  return aiPlanDraft(days)
}

function payload(
  days: AiPlanDraft['days'],
  extra: { excludedPlaceIds?: Set<string>; totalDays?: number; sigunguCode?: string } = {},
) {
  const { sigunguCode, ...options } = extra

  return draftToPlanPayload({
    draft: draft(days),
    snapshot: sigunguCode === undefined ? snapshot : { ...snapshot, sigunguCode },
    title: '몽실이와 제주 2박 3일',
    ...options,
  })
}

describe('draftToPlanPayload — 일정 본문은 입력 조건에서 온다', () => {
  it('초안에 없는 조건(기간·예산·areaCode)을 스냅샷에서 채운다', () => {
    const result = payload([{ day: 1, items: [item()] }])

    expect(result.petIds).toEqual(['123456789012000001'])
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
      { excludedPlaceIds: new Set(['111']) },
    )

    expect(result.items?.map((i) => i.title)).toEqual(['살아있는 곳'])
    expect(result.items?.[0]?.sequence).toBe(0)
  })

  it('제외 목록은 placeId 가 없는 항목에 영향을 주지 않는다', () => {
    const result = payload(
      [{ day: 1, items: [item({ itemType: 'MOVE', placeId: null, title: '이동' })] }],
      { excludedPlaceIds: new Set(['111']) },
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

describe('draftToPlanPayload — title·note 가 null 로 올 수 있다', () => {
  it('note 가 null 이면 던지지 않고 memo 키를 뺀다', () => {
    const result = payload([{ day: 1, items: [aiPlanItemWithNulls({ title: '이름은 있다' })] }])

    expect(result.items).toHaveLength(1)
    expect('memo' in (result.items?.[0] ?? {})).toBe(false)
  })

  it('title 이 null 이면 그 항목을 뺀다 — @NotBlank 로 요청 전체가 400 이 된다', () => {
    const result = payload([{ day: 1, items: [aiPlanItemWithNulls(), item({ title: '남는 곳' })] }])

    expect(result.items?.map((i) => i.title)).toEqual(['남는 곳'])
  })

  it('둘 다 null 인 항목만 있으면 items 가 빈 배열이다', () => {
    expect(payload([{ day: 1, items: [aiPlanItemWithNulls()] }]).items).toEqual([])
  })
})

describe('draftToPlanPayload — 기간 밖 일차를 걸러낸다 (PLAN_002)', () => {
  it('totalDays 를 넘는 일차를 뺀다 — 하나만 벗어나도 저장 전체가 400 이다', () => {
    const result = payload(
      [
        { day: 1, items: [item({ title: '남음' })] },
        { day: 4, items: [item({ title: '버려짐' })] },
      ],
      { totalDays: 3 },
    )

    expect(result.items?.map((i) => i.title)).toEqual(['남음'])
  })

  it('경계값(day === totalDays)은 남긴다', () => {
    const result = payload([{ day: 3, items: [item({ title: '경계' })] }], { totalDays: 3 })
    expect(result.items?.map((i) => i.title)).toEqual(['경계'])
  })

  it('totalDays 를 주지 않으면 거르지 않는다 — 일수를 모를 때 임의로 버리지 않는다', () => {
    const result = payload([{ day: 4, items: [item({ title: '남음' })] }])
    expect(result.items?.map((i) => i.title)).toEqual(['남음'])
  })
})

describe('draftToPlanPayload — 판정 기준 반려견 (#128 · 명세 D4)', () => {
  const twoPets = {
    ...snapshot,
    pets: [
      { petId: '111', name: '몽실이' },
      { petId: '222', name: '초코' },
    ],
  }

  /*
    #152 가 develop 에 들어오기 전에는 담기 직전에 사람이 한 마리를 골랐다. 이제 서버가
    `petIds` 를 받으므로 동반한 아이를 전부 싣고, **순서를 지킨다** — 서버가 첫 번째를
    대표 반려견으로 삼는다 (`PlanCommandProcessor.createPlan`).
  */
  it('동반한 아이를 전부 싣고 순서를 지킨다', () => {
    const result = draftToPlanPayload({
      draft: draft([{ day: 1, items: [item()] }]),
      snapshot: twoPets,
      title: '제주 2박 3일',
      totalDays: 3,
    })

    expect(result.petIds).toEqual(['111', '222'])
  })

  /*
    서버 `effectivePetIds()` 가 petIds 를 이기게 두므로 petId 는 무시될 값이다. 두 필드를
    함께 실으면 어느 쪽이 진짜인지 호출부마다 다시 묻게 된다.
  */
  it('무시될 petId 를 함께 보내지 않는다', () => {
    const result = draftToPlanPayload({
      draft: draft([{ day: 1, items: [item()] }]),
      snapshot: twoPets,
      title: '제주 2박 3일',
      totalDays: 3,
    })

    expect('petId' in result).toBe(false)
  })
})

describe('draftToPlanPayload — 고른 지역을 저장까지 옮긴다 (#251)', () => {
  /*
    옮기지 않으면 "제주시만" 으로 만든 일정이 담기는 순간 "지역 미지정" 이 된다.
    계약(`PlanCreateRequest.sigunguCode`)에는 처음부터 있던 필드인데 화면이 싣지 않고 있었다.
  */
  it('스냅샷의 sigunguCode 를 실어 보낸다', () => {
    const result = payload([{ day: 1, items: [item()] }], { sigunguCode: '4' })

    expect(result.sigunguCode).toBe('4')
  })

  it('제주 전체였으면 키를 뺀다', () => {
    const result = payload([{ day: 1, items: [item()] }])

    expect('sigunguCode' in result).toBe(false)
  })
})

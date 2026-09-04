import { describe, expect, it } from 'vitest'

import {
  dayRegenerateBlock,
  toDayRegeneratePayload,
  toRegeneratedDayItems,
} from '@/lib/ai-plan/regenerate'
import type { AiPlanDraft } from '@/types/ai-plan'
import type { PlanDetail } from '@/types/plan'

function plan(overrides: Partial<PlanDetail> = {}): PlanDetail {
  return {
    planId: '223456789012000001',
    petId: '123456789012000001',
    petIds: ['123456789012000001', '123456789012000002'],
    areaCode: '39',
    sigunguCode: '4',
    title: '몽실이와 제주 2박 3일',
    startDate: '2026-09-12',
    endDate: '2026-09-14',
    budget: 400000,
    status: { code: 'DRAFT', name: '초안', description: null },
    totalDays: 3,
    items: [],
    ...overrides,
  }
}

describe('toDayRegeneratePayload', () => {
  it('일정에서 지역·기간·반려견을 그대로 싣는다', () => {
    const payload = toDayRegeneratePayload(plan(), 2, '')

    expect(payload.areaCode).toBe('39')
    expect(payload.startDate).toBe('2026-09-12')
    expect(payload.endDate).toBe('2026-09-14')
    expect(payload.petIds).toEqual(['123456789012000001', '123456789012000002'])
  })

  it('planId 와 regenerateDay 를 짝으로 싣는다', () => {
    const payload = toDayRegeneratePayload(plan(), 2, '')

    expect(payload.planId).toBe('223456789012000001')
    expect(payload.regenerateDay).toBe(2)
  })

  /*
    Snowflake 다. `Number()` 를 거치면 정밀도를 잃는다 — `submit.ts` 의 pinnedPlaceIds 와
    같은 판단이다.
  */
  it('planId 를 숫자로 바꾸지 않는다', () => {
    expect(typeof toDayRegeneratePayload(plan(), 1, '').planId).toBe('string')
  })

  it('예산이 없으면 키 자체를 넣지 않는다 — @Positive 다', () => {
    expect('budget' in toDayRegeneratePayload(plan({ budget: null }), 1, '')).toBe(false)
  })

  it('예산이 0 이하면 키를 넣지 않는다', () => {
    expect('budget' in toDayRegeneratePayload(plan({ budget: 0 }), 1, '')).toBe(false)
  })

  it('예산이 있으면 원 단위 그대로 싣는다', () => {
    expect(toDayRegeneratePayload(plan(), 1, '').budget).toBe(400000)
  })

  it('메모가 비면 키를 넣지 않는다', () => {
    expect('requestNote' in toDayRegeneratePayload(plan(), 1, '   ')).toBe(false)
  })

  it('메모는 trim 해서 싣는다', () => {
    expect(toDayRegeneratePayload(plan(), 1, '  실내 위주로  ').requestNote).toBe('실내 위주로')
  })

  /*
    R3-1. 일정에 저장되지 않는 값이라 되살릴 근거가 없다. 특히 pinnedPlaceIds 는
    "반드시 배치" 약속이라 잘못 실으면 요구한 적 없는 장소가 그 날에 박힌다.
  */
  it('preferFavorites·pinnedPlaceIds 를 지어내지 않는다', () => {
    const payload = toDayRegeneratePayload(plan(), 1, '메모')

    expect('preferFavorites' in payload).toBe(false)
    expect('pinnedPlaceIds' in payload).toBe(false)
  })

  it('한 마리 일정도 petIds 원소 하나로 싣는다', () => {
    const payload = toDayRegeneratePayload(plan({ petIds: ['123456789012000001'] }), 1, '')

    expect(payload.petIds).toEqual(['123456789012000001'])
  })
})

function draft(): AiPlanDraft {
  return {
    days: [
      {
        day: 1,
        items: [{ itemType: 'PLACE', placeId: '111', title: '1일차 그대로', note: null }],
      },
      {
        day: 2,
        items: [
          { itemType: 'PLACE', placeId: '222', title: '오설록 티뮤지엄', note: '실내예요' },
          { itemType: 'WALK', placeId: '333', title: '사려니숲길 산책', note: null },
        ],
      },
    ],
    reasons: [],
  }
}

describe('toRegeneratedDayItems', () => {
  /*
    R4. 프롬프트가 "나머지 날은 그대로 유지해 전체 일정을 출력할 것" 이라고 **부탁**할
    뿐 강제하지 않는다. 사용자는 하루만 바꾸겠다고 했다.
  */
  it('목표 일자만 뽑는다 — 다른 날은 무시한다', () => {
    const items = toRegeneratedDayItems(draft(), 2, 3)

    expect(items).not.toBeNull()
    expect(items?.every((item) => item.day === 2)).toBe(true)
    expect(items?.map((item) => item.title)).toEqual(['오설록 티뮤지엄', '사려니숲길 산책'])
  })

  it('sequence 를 0부터 다시 매긴다', () => {
    expect(toRegeneratedDayItems(draft(), 2, 3)?.map((item) => item.sequence)).toEqual([0, 1])
  })

  /*
    R4-3 · #89. `AiPlanScheduleItem.placeId` 는 장소 id 인데 `WALK` 의 `targetId` 는
    `walk_course.id` 다. 보내면 틀린 id 가 조용히 저장된다.
  */
  it('WALK 에는 targetId 를 붙이지 않는다', () => {
    const items = toRegeneratedDayItems(draft(), 2, 3)
    const walk = items?.find((item) => item.itemType === 'WALK')

    expect(walk).toBeDefined()
    expect('targetId' in (walk ?? {})).toBe(false)
  })

  it('PLACE 에는 targetId 를 붙인다', () => {
    const place = toRegeneratedDayItems(draft(), 2, 3)?.find((item) => item.itemType === 'PLACE')

    expect(place?.targetId).toBe('222')
  })

  /*
    R4-2. 빈 배열로 PUT 하면 `PlanDayItemsReplacePayload` 가 "그 일자 전부 삭제" 로
    읽는다 — 재생성 실패가 조용한 삭제가 된다.
  */
  it('목표 일자가 없으면 null 이다 — 빈 배열이 아니다', () => {
    expect(toRegeneratedDayItems(draft(), 3, 3)).toBeNull()
  })

  it('목표 일자의 항목이 전부 걸러지면 빈 배열이다 — null 과 다르다', () => {
    const empty: AiPlanDraft = {
      days: [{ day: 2, items: [{ itemType: 'PLACE', placeId: null, title: '  ', note: null }] }],
      reasons: [],
    }

    expect(toRegeneratedDayItems(empty, 2, 3)).toEqual([])
  })

  it('title 이 null 인 항목을 만나도 죽지 않는다', () => {
    const nullTitle: AiPlanDraft = {
      days: [{ day: 2, items: [{ itemType: 'PLACE', placeId: '1', title: null, note: null }] }],
      reasons: [],
    }

    expect(toRegeneratedDayItems(nullTitle, 2, 3)).toEqual([])
  })

  it('제외한 장소는 빠진다 — PLAN_004 재시도가 쓴다', () => {
    const items = toRegeneratedDayItems(draft(), 2, 3, new Set(['222']))

    expect(items?.map((item) => item.title)).toEqual(['사려니숲길 산책'])
  })

  it('기간 밖 일차는 애초에 뽑히지 않는다', () => {
    expect(toRegeneratedDayItems(draft(), 2, 1)).toEqual([])
  })
})

/*
  **제출이 두 전제를 조용히 물려받는다** — `POST /ai-plans` 는 `validateRegenerateRequest`
  **앞에서** 시작일과 일수를 본다 (`AiPlanJobProcessor:55-62`). 재생성 payload 가 저장된
  일정의 기간을 그대로 싣기 때문에, 이 판정이 없으면 이미 시작한 여행과 11일 이상 일정이
  누를 수는 있지만 늘 400 인 버튼을 갖는다.
*/
describe('dayRegenerateBlock', () => {
  const TODAY = new Date('2026-09-04T10:00:00+09:00')

  it('오늘 시작하는 3일 일정은 막지 않는다', () => {
    expect(dayRegenerateBlock({ startDate: '2026-09-04', totalDays: 3 }, TODAY)).toBeNull()
  })

  it('앞으로의 일정은 막지 않는다', () => {
    expect(dayRegenerateBlock({ startDate: '2026-09-12', totalDays: 3 }, TODAY)).toBeNull()
  })

  /* `AIPLAN_017` — 여행 시작일은 오늘 이후여야 합니다 */
  it('이미 시작한 여행은 막는다 — 하루가 남았어도 그렇다', () => {
    expect(dayRegenerateBlock({ startDate: '2026-09-01', totalDays: 5 }, TODAY)).toBe(
      'START_DATE_IN_PAST',
    )
  })

  /* `AIPLAN_018` — AI 일정 생성은 최대 10일까지 지원합니다 (plan-service 는 30일까지 받는다) */
  it('10일은 통과하고 11일은 막는다 — 경계가 상한 포함이다', () => {
    expect(dayRegenerateBlock({ startDate: '2026-09-12', totalDays: 10 }, TODAY)).toBeNull()
    expect(dayRegenerateBlock({ startDate: '2026-09-12', totalDays: 11 }, TODAY)).toBe(
      'TRIP_DAYS_EXCEEDED',
    )
  })

  /* 서버가 먼저 보는 순서를 따른다 — 둘 다 걸리면 시작일이 이긴다 */
  it('둘 다 걸리면 시작일을 말한다', () => {
    expect(dayRegenerateBlock({ startDate: '2026-08-01', totalDays: 30 }, TODAY)).toBe(
      'START_DATE_IN_PAST',
    )
  })

  /* 날짜를 못 읽으면 막지 않는다 — `isPastPlan` 과 같은 판단이다 */
  it('날짜 형식이 아니면 막지 않는다', () => {
    expect(dayRegenerateBlock({ startDate: '2026/09/12', totalDays: 3 }, TODAY)).toBeNull()
  })
})

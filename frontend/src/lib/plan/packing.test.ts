import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api/error'
import { messages } from '@/lib/messages'
import {
  groupByCategory,
  hasAiItems,
  isUserPackingItem,
  packingAddErrorMessage,
  packingCategories,
  shouldOfferGeneration,
  toPackingAddPayload,
  toPackingSavePayload,
  validatePackingAdd,
  withCheckedItem,
} from '@/lib/plan/packing'
import type { PackingListItem } from '@/types/ai-plan'
import type { CodeNameMetadata } from '@/types/api'
import type { PlanPackingDetailItem, PlanPackingListResponse } from '@/types/plan'

const AI: CodeNameMetadata = { code: 'AI', name: 'AI', description: null }
const USER: CodeNameMetadata = { code: 'USER', name: '직접 추가', description: null }

function item(name: string, overrides: Partial<PlanPackingDetailItem> = {}): PlanPackingDetailItem {
  return {
    packingItemId: `id-${name}`,
    category: '필수',
    name,
    reason: '이유 문장입니다.',
    source: AI,
    checked: false,
    sortOrder: 0,
    ...overrides,
  }
}

function list(items: PlanPackingDetailItem[], generatedAt: string | null): PlanPackingListResponse {
  return {
    planId: '754304949915095040',
    items,
    totalCount: items.length,
    checkedCount: items.filter((entry) => entry.checked).length,
    generatedAt,
  }
}

/*
  **서버가 이 둘을 구분해 주지 않는다.** `generatedAt` 은 "AI 항목이 하나도 없으면 null"
  이라, 만든 뒤 AI 항목을 전부 지우면 다시 null 로 돌아간다 — 화면이 "아직 안 만들었다" 와
  "만들고 다 지웠다" 를 가르는 척하면 안 된다. 대신 이 값이 답해 주는 것은 **"AI가
  골랐어요" 라고 말해도 되는가** 다.
*/
describe('hasAiItems / shouldOfferGeneration — generatedAt 이 답하는 것', () => {
  it('AI 항목이 없으면(generatedAt null) 생성을 권한다', () => {
    const never = list([], null)

    expect(hasAiItems(never)).toBe(false)
    expect(shouldOfferGeneration(never)).toBe(true)
  })

  /*
    **`items.length` 로 판정하면 이 사용자가 생성 버튼을 영영 못 만난다.** 직접 적어 둔
    항목이 있어 목록이 비어 있지 않지만 AI 를 아직 부른 적이 없다.
  */
  it('직접 추가만 해 둔 목록에도 생성을 권한다', () => {
    const userOnly = list([item('배변봉투', { source: USER, reason: null })], null)

    expect(hasAiItems(userOnly)).toBe(false)
    expect(shouldOfferGeneration(userOnly)).toBe(true)
  })

  it('AI 항목이 저장돼 있으면 다시 돌리지 않는다', () => {
    const saved = list([item('리드줄')], '2026-09-14T10:00:00')

    expect(hasAiItems(saved)).toBe(true)
    expect(shouldOfferGeneration(saved)).toBe(false)
  })

  /** 못 읽은 상태에서 생성을 권하면 저장된 것이 있는지 모르는 채로 덮어쓸 수 있다 */
  it('아직 못 읽었으면(null) 권하지 않는다', () => {
    expect(shouldOfferGeneration(null)).toBe(false)
  })
})

describe('toPackingSavePayload — AI 결과 → 저장 본문', () => {
  const created: PackingListItem[] = [
    { category: '필수', name: '리드줄', reason: '야외 장소가 포함돼 있습니다.' },
    { category: '필수', name: '배변봉투', reason: '   ' },
  ]

  it('분류·이름·이유를 그대로 옮긴다', () => {
    const payload = toPackingSavePayload(created)

    expect(payload.items[0]).toEqual({
      category: '필수',
      name: '리드줄',
      reason: '야외 장소가 포함돼 있습니다.',
    })
  })

  /** 빈 이유를 보내면 "이유가 있는데 비어 있는" 항목이 저장돼 화면이 빈 줄을 그린다 */
  it('이유가 공백뿐이면 키 자체를 뺀다', () => {
    const payload = toPackingSavePayload(created)

    expect(Object.hasOwn(payload.items[1] as object, 'reason')).toBe(false)
  })
})

/*
  챙김 체크는 `Response<Void>` 라 갱신된 목록이 오지 않는다. 화면이 낙관적으로 먼저
  그리는데, `checkedCount` 를 같이 고치지 않으면 요약 줄이 목록과 다른 수를 말한다.
*/
describe('withCheckedItem — 낙관적 갱신', () => {
  const base = list([item('리드줄'), item('배변봉투')], '2026-09-14T10:00:00')

  it('해당 항목만 바뀌고 checkedCount 가 함께 따라온다', () => {
    const next = withCheckedItem(base, 'id-리드줄', true)

    expect(next.items[0]?.checked).toBe(true)
    expect(next.items[1]?.checked).toBe(false)
    expect(next.checkedCount).toBe(1)
  })

  it('해제하면 수가 다시 줄어든다', () => {
    const checked = withCheckedItem(base, 'id-리드줄', true)

    expect(withCheckedItem(checked, 'id-리드줄', false).checkedCount).toBe(0)
  })

  it('원본을 바꾸지 않는다 — 실패했을 때 되돌릴 목록이 이것이다', () => {
    withCheckedItem(base, 'id-리드줄', true)

    expect(base.items[0]?.checked).toBe(false)
    expect(base.checkedCount).toBe(0)
  })
})

describe('groupByCategory / packingCategories — 서버 순서를 유지한다', () => {
  const items = [item('리드줄'), item('우비', { category: '날씨 대비' }), item('배변봉투')]

  it('처음 나온 분류가 먼저다 — 가나다로 정렬하지 않는다', () => {
    expect(groupByCategory(items).map(([category]) => category)).toEqual(['필수', '날씨 대비'])
  })

  it('같은 분류가 한 묶음으로 모인다', () => {
    expect(groupByCategory(items)[0]?.[1].map((entry) => entry.name)).toEqual([
      '리드줄',
      '배변봉투',
    ])
  })

  it('분류 목록은 중복 없이 순서대로다', () => {
    expect(packingCategories(items)).toEqual(['필수', '날씨 대비'])
  })
})

describe('isUserPackingItem — 이유가 비는 것이 실패가 아닌 갈래', () => {
  it('USER 항목을 가른다', () => {
    expect(isUserPackingItem(item('배변봉투', { source: USER, reason: null }))).toBe(true)
    expect(isUserPackingItem(item('리드줄'))).toBe(false)
  })
})

describe('validatePackingAdd / toPackingAddPayload — 직접 추가 폼', () => {
  it('둘 다 비면 각 칸에 오류가 붙는다', () => {
    const errors = validatePackingAdd({ category: '  ', name: '' })

    expect(errors.category).toBe(messages.plan.errorPackingCategoryRequired)
    expect(errors.name).toBe(messages.plan.errorPackingNameRequired)
  })

  it('둘 다 있으면 통과한다', () => {
    expect(validatePackingAdd({ category: '반려견 케어', name: '배변봉투' })).toEqual({})
  })

  it('앞뒤 공백을 떼고 보낸다', () => {
    expect(toPackingAddPayload({ category: ' 반려견 케어 ', name: ' 배변봉투 ' })).toEqual({
      category: '반려견 케어',
      name: '배변봉투',
    })
  })
})

/*
  중복 이름은 다른 이름을 적으면 되고, 50개 초과는 무엇을 적어도 안 된다 — 뭉뚱그리면
  사용자가 이름만 바꿔 가며 반복한다.
*/
describe('packingAddErrorMessage — 두 실패를 갈라 말한다', () => {
  it('PLAN_012 는 중복 이름이다', () => {
    const error = new ApiError(409, 'PLAN_012', '이미 같은 이름의 준비물이 있습니다.')

    expect(packingAddErrorMessage(error)).toBe(messages.plan.errorPackingNameDuplicated)
  })

  it('PLAN_013 은 개수 상한이다', () => {
    const error = new ApiError(400, 'PLAN_013', '준비물은 일정당 최대 50개까지 저장할 수 있습니다.')

    expect(packingAddErrorMessage(error)).toBe(messages.plan.errorPackingLimitExceeded)
  })

  it('모르는 실패·ApiError 가 아닌 실패는 일반 문구로 돌아간다', () => {
    expect(packingAddErrorMessage(new ApiError(500, 'PLAN_900', '내부 오류'))).toBe(
      messages.plan.packingAddError,
    )
    expect(packingAddErrorMessage(new Error('network'))).toBe(messages.plan.packingAddError)
  })
})

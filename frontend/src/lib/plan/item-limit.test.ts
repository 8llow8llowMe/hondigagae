import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api/error'
import { isPlanItemLimitError, PLAN_MAX_ITEMS } from '@/lib/plan/item-limit'

/**
 * 일정 항목 수 상한 (#1251 · BE #1243). 근거: `PlanErrorCode.PLAN_ITEM_LIMIT_EXCEEDED`(PLAN_028,
 * 도메인 예외 — `fieldErrors` 없음) · `PlanValidationMessage.ITEMS_SIZE_INVALID`(PLAN_136,
 * `@Size` — `fieldErrors: [{ field: 'items' }]`) 소스 실측.
 */
const LIMIT_MESSAGE_136 = '일정 항목은 최대 100개까지 담을 수 있습니다.'

describe('PLAN_MAX_ITEMS', () => {
  it('서버 Plan.MAX_ITEMS 와 같은 100 이다', () => {
    expect(PLAN_MAX_ITEMS).toBe(100)
  })
})

describe('isPlanItemLimitError', () => {
  it('PLAN_028(교체 뒤 일정 전체가 상한을 넘음)을 상한 오류로 본다', () => {
    const error = new ApiError(400, 'PLAN_028', '일정에는 항목을 최대 100개까지 담을 수 있습니다.')

    expect(isPlanItemLimitError(error)).toBe(true)
  })

  it('PLAN_136(요청 목록 하나가 상한을 넘음)을 상한 오류로 본다', () => {
    const error = new ApiError(400, 'PLAN_136', LIMIT_MESSAGE_136, [
      { code: 'PLAN_136', field: 'items', message: LIMIT_MESSAGE_136 },
    ])

    expect(isPlanItemLimitError(error)).toBe(true)
  })

  /*
    검증 오류가 여럿이면 대표 코드는 정렬된 첫 오류다 — `items` 보다 앞선 필드(`title` 등)가
    함께 틀리면 `resultCode` 가 그쪽 코드가 된다. 그래도 상한은 상한이다.
  */
  it('대표 코드가 다른 검증 오류여도 fieldErrors 에 PLAN_136 이 있으면 상한 오류다', () => {
    const error = new ApiError(400, 'PLAN_108', '제목은 필수입니다.', [
      { code: 'PLAN_108', field: 'title', message: '제목은 필수입니다.' },
      { code: 'PLAN_136', field: 'items', message: LIMIT_MESSAGE_136 },
    ])

    expect(isPlanItemLimitError(error)).toBe(true)
  })

  it('다른 4xx · 5xx · ApiError 가 아닌 실패는 상한 오류가 아니다', () => {
    expect(isPlanItemLimitError(new ApiError(400, 'PLAN_004', null))).toBe(false)
    expect(isPlanItemLimitError(new ApiError(404, 'PLAN_001', null))).toBe(false)
    expect(isPlanItemLimitError(new ApiError(500, null, null))).toBe(false)
    expect(isPlanItemLimitError(new Error('PLAN_028'))).toBe(false)
    expect(isPlanItemLimitError(null)).toBe(false)
  })
})

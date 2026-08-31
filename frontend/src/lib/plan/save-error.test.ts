import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api/error'
import { messages } from '@/lib/messages'
import { toPlanDaySaveError } from '@/lib/plan/save-error'

/**
 * 일괄 교체 저장 실패 분류 — 편집모드(#81)와 담기(#82)가 **같은 함수를 쓴다.**
 * 두 벌이 되면 한쪽만 고쳐졌을 때 같은 400 에 다른 안내가 나간다.
 */
const COPY = {
  retriable: messages.plan.addPlaceErrorDescription,
  missingPlace: messages.plan.addPlaceMissingPlaceError,
}

describe('toPlanDaySaveError', () => {
  it('PLAN_004 는 재시도를 주지 않는다 — 같은 본문이 같은 400 을 받는다', () => {
    const error = toPlanDaySaveError(new ApiError(400, 'PLAN_004', null), COPY)

    expect(error.retriable).toBe(false)
    // 문구는 화면이 준다 — 담기 화면에는 "빼낼 목록" 이 없어 편집모드 문구를 쓸 수 없다
    expect(error.message).toBe(COPY.missingPlace)
    expect(error.message).not.toBe(messages.plan.editMissingPlaceError)
  })

  it('PLAN_002 는 재시도가 아니라 새로고침이다 — 들고 있는 상세가 낡았다', () => {
    const error = toPlanDaySaveError(new ApiError(400, 'PLAN_002', null), COPY)

    expect(error.retriable).toBe(false)
    expect(error.message).toBe(messages.plan.editDayOutOfRangeError)
  })

  it('5xx 는 재시도 가능하고 문구는 호출부가 준다 — 담기에는 "편집한 내용" 이 없다', () => {
    const error = toPlanDaySaveError(new ApiError(500, null, null), COPY)

    expect(error.retriable).toBe(true)
    expect(error.message).toBe(COPY.retriable)
    expect(error.message).not.toBe(messages.plan.editSaveErrorDescription)
  })

  it('ApiError 가 아닌 실패도 재시도 가능으로 다룬다', () => {
    expect(toPlanDaySaveError(new Error('boom'), COPY).retriable).toBe(true)
  })

  it('PLAN_002 는 문구를 나누지 않는다 — 어느 화면에서든 할 일이 새로고침으로 같다', () => {
    const error = toPlanDaySaveError(new ApiError(400, 'PLAN_002', null), COPY)

    expect(error.message).toBe(messages.plan.editDayOutOfRangeError)
  })
})

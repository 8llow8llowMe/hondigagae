import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api/error'
import { messages } from '@/lib/messages'
import { planDetailNotFoundTitle } from '@/lib/plan/detail-title'

/**
 * **#676.** `[planId]/not-found.tsx` 자체의 `metadata` 가 Next 16 에서 먹히지 않아
 * (`detail-title.ts` 머리주석), `generateMetadata` 가 이 판정을 대신 쓴다.
 */
describe('planDetailNotFoundTitle', () => {
  it('404 는 일정 상세 404 문구를 돌려준다', () => {
    const title = planDetailNotFoundTitle(
      new ApiError(404, 'PLAN_002', '존재하지 않는 일정입니다.'),
    )

    expect(title).toBe(messages.plan.detailNotFoundTitle)
  })

  it('5xx·무응답에는 아무것도 단정하지 않는다 — null 이면 부모 제목을 그대로 물려받는다', () => {
    for (const error of [new ApiError(503, null, null), new ApiError(0, null, null)]) {
      expect(planDetailNotFoundTitle(error)).toBeNull()
    }
  })

  it('400·401 등 다른 4xx 도 단정하지 않는다', () => {
    expect(planDetailNotFoundTitle(new ApiError(400, 'PLAN_113', null))).toBeNull()
    expect(planDetailNotFoundTitle(new ApiError(401, null, null))).toBeNull()
  })

  it('ApiError 가 아니면 단정하지 않는다', () => {
    expect(planDetailNotFoundTitle(new TypeError('boom'))).toBeNull()
  })
})

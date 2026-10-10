import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api/error'
import { messages } from '@/lib/messages'
import { planDetailNotFoundTitle, planDetailTitle } from '@/lib/plan/detail-title'

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

/**
 * **#905 R5.** 성공하면 루트의 평문 `혼디가개` 가 아니라 `여행 일정` 을 낸다 — 일정 이름은
 * 넣지 않는다 (`detail-title.ts` 머리주석의 프라이버시 근거).
 */
describe('planDetailTitle', () => {
  it('성공(오류 null)이면 여행 일정 목록과 같은 이름을 돌려준다', () => {
    expect(planDetailTitle(null)).toBe(messages.plan.pageTitle)
  })

  it('404 는 일정 상세 404 문구다 — planDetailNotFoundTitle 과 같다', () => {
    expect(planDetailTitle(new ApiError(404, 'PLAN_002', null))).toBe(
      messages.plan.detailNotFoundTitle,
    )
  })

  it('5xx·무응답·다른 4xx 는 판정하지 않는 목록 제목으로 떨어진다 (#206 · 장소 상세와 같다)', () => {
    for (const error of [
      new ApiError(503, null, null),
      new ApiError(0, null, null),
      new ApiError(400, 'PLAN_113', null),
      new TypeError('boom'),
    ]) {
      expect(planDetailTitle(error)).toBe(messages.plan.pageTitle)
    }
  })
})

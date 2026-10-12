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
 * **#1383 이 #905 R5 를 뒤집었다.** 성공하면 **일정 이름**을 낸다 — 이름이 같은 일정이 여럿이라
 * (`몽과 제주 2박 3일` 이 다섯 중 넷) 탭 · 기록에서 `여행 일정` 만으로는 구분되지 않았다.
 */
describe('planDetailTitle', () => {
  it('성공이면 일정 이름이다', () => {
    expect(planDetailTitle(null, '몽과 제주 2박 3일')).toBe('몽과 제주 2박 3일')
  })

  it('이름의 앞뒤 공백은 걷는다', () => {
    expect(planDetailTitle(null, '  가을 서귀포  ')).toBe('가을 서귀포')
  })

  it('이름이 비었거나 없으면 여행 일정 목록과 같은 이름으로 떨어진다', () => {
    expect(planDetailTitle(null, '   ')).toBe(messages.plan.pageTitle)
    expect(planDetailTitle(null, null)).toBe(messages.plan.pageTitle)
    expect(planDetailTitle(null)).toBe(messages.plan.pageTitle)
  })

  it('오류가 있으면 이름을 받아도 쓰지 않는다', () => {
    expect(planDetailTitle(new ApiError(503, null, null), '몽과 제주')).toBe(
      messages.plan.pageTitle,
    )
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

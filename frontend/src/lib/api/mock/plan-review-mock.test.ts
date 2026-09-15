import { beforeEach, describe, expect, it } from 'vitest'

import { resolveMock } from '@/lib/api/mock'
import { resetMockStore } from '@/lib/api/mock/store'
import type { PlanReviewResponse } from '@/types/plan'

/**
 * 여행 후기 mock (#614 계약 복제).
 *
 * **mock 이 백엔드보다 느슨하거나 엄격해서는 안 된다.** 화면이 갈리는 규칙만 잠근다 —
 * 완료가 아니면 PLAN_016, 없으면 PLAN_015, 중복 POST 는 PLAN_017, 장소가 아니면 PLAN_018.
 */

const TOKEN = 'mock-access-900000000000000001'
const COMPLETED = '223456789012000003'
const DRAFT = '223456789012000001'
const OTHERS = '223456789012000099'
const PLACE_ITEM = '323456789012000020'
const WALK_ON_DRAFT = '323456789012000006'

function call(path: string, method: string, body: unknown = null, token: string | null = TOKEN) {
  return resolveMock(path, method, '', body === null ? null : JSON.stringify(body), token)
}

function payload(overallRating = 4, items: unknown[] = []) {
  return { overallRating, body: '둘째 날이 더웠다.', items }
}

describe('후기 mock — 조회', () => {
  beforeEach(resetMockStore)

  it('완료 일정에 후기가 없으면 404 PLAN_015 다', () => {
    const result = call(`/plans/${COMPLETED}/reviews`, 'GET')

    expect(result?.status).toBe(404)
    expect((result?.payload as { dataHeader: { resultCode: string } }).dataHeader.resultCode).toBe(
      'PLAN_015',
    )
  })

  it('초안 일정은 400 PLAN_016 이다 — GET 도 같다', () => {
    const result = call(`/plans/${DRAFT}/reviews`, 'GET')

    expect(result?.status).toBe(400)
    expect((result?.payload as { dataHeader: { resultCode: string } }).dataHeader.resultCode).toBe(
      'PLAN_016',
    )
  })

  it('남의 일정은 404 PLAN_001 이다', () => {
    const result = call(`/plans/${OTHERS}/reviews`, 'GET')

    expect(result?.status).toBe(404)
    expect((result?.payload as { dataHeader: { resultCode: string } }).dataHeader.resultCode).toBe(
      'PLAN_001',
    )
  })
})

describe('후기 mock — 작성', () => {
  beforeEach(resetMockStore)

  it('전체 만족도만으로 쓸 수 있다', () => {
    const result = call(`/plans/${COMPLETED}/reviews`, 'POST', payload())
    const body = result?.payload.dataBody as PlanReviewResponse

    expect(result?.status).toBe(200)
    expect(body.overallRating).toBe(4)
    expect(body.body).toBe('둘째 날이 더웠다.')
    expect(body.items).toEqual([])
  })

  it('다녀온 장소 항목을 담으면 제목·placeId 를 현재 항목에서 스냅샷한다', () => {
    const result = call(
      `/plans/${COMPLETED}/reviews`,
      'POST',
      payload(5, [{ planItemId: PLACE_ITEM, rating: 5, comment: '그늘이 많았다.' }]),
    )
    const body = result?.payload.dataBody as PlanReviewResponse

    expect(body.items).toHaveLength(1)
    expect(body.items[0]?.planItemId).toBe(PLACE_ITEM)
    expect(body.items[0]?.title).toBe('제주특별자치도립김창열미술관')
    expect(body.items[0]?.rating).toBe(5)
  })

  it('이미 있으면 409 PLAN_017 이다', () => {
    call(`/plans/${COMPLETED}/reviews`, 'POST', payload())
    const again = call(`/plans/${COMPLETED}/reviews`, 'POST', payload())

    expect(again?.status).toBe(409)
    expect((again?.payload as { dataHeader: { resultCode: string } }).dataHeader.resultCode).toBe(
      'PLAN_017',
    )
  })

  it('WALK 항목은 PLAN_018 이다', () => {
    const result = call(`/plans/${DRAFT}/reviews`, 'POST', {
      overallRating: 4,
      body: null,
      items: [{ planItemId: WALK_ON_DRAFT, rating: 5, comment: null }],
    })

    expect(result?.status).toBe(400)
    expect((result?.payload as { dataHeader: { resultCode: string } }).dataHeader.resultCode).toBe(
      'PLAN_016',
    )
  })
})

describe('후기 mock — 수정', () => {
  beforeEach(resetMockStore)

  it('PUT 은 items 를 전량 교체한다', () => {
    call(
      `/plans/${COMPLETED}/reviews`,
      'POST',
      payload(4, [{ planItemId: PLACE_ITEM, rating: 5, comment: '그늘' }]),
    )
    const updated = call(`/plans/${COMPLETED}/reviews`, 'PUT', payload(3, []))
    const body = updated?.payload.dataBody as PlanReviewResponse

    expect(body.overallRating).toBe(3)
    expect(body.items).toEqual([])
  })

  it('후기가 없는데 PUT 하면 PLAN_015 다', () => {
    const result = call(`/plans/${COMPLETED}/reviews`, 'PUT', payload())

    expect(result?.status).toBe(404)
    expect((result?.payload as { dataHeader: { resultCode: string } }).dataHeader.resultCode).toBe(
      'PLAN_015',
    )
  })
})

import { describe, expect, it } from 'vitest'

import { resolveMock } from '@/lib/api/mock'
import type { ApiResponse } from '@/types/api'
import type { PlaceRecommendationResponse } from '@/types/insight'

/**
 * `GET /places/recommendations` 목 (#1380).
 *
 * 계약 근거는 tour-service `PlaceInsightWebController#getRecommendations` · `PlaceRecommendationResponse`
 * origin/develop 소스와 `backend/docs/weather-insight-integration.md` §6-5 다. 판정 조각은 **기존 적합도
 * 목(`mockSuitability`)을 그대로** 쓴다 — 서버도 후보마다 적합도 한 곳 판정을 부른다.
 */
function recommend(search = '') {
  const result = resolveMock('/places/recommendations', 'GET', search, null)
  if (result === null) throw new Error('mock 이 경로를 처리하지 못했다')
  return result
}

function body(search = ''): PlaceRecommendationResponse {
  const payload = recommend(search).payload as ApiResponse<PlaceRecommendationResponse>
  if (payload.dataBody === null) throw new Error('성공 응답이어야 한다')
  return payload.dataBody
}

describe('resolveMock — 장소 추천 (#1380)', () => {
  /* `/places/{placeId}` 와 같은 깊이다 — 상세로 읽어 400(PLACE_113)을 내면 안 된다 */
  it('상세로 읽지 않고 200 이다', () => {
    expect(recommend().status).toBe(200)
  })

  it('limit 이 없으면 3곳이다 — 계약의 기본값', () => {
    expect(body().items).toHaveLength(3)
  })

  it('limit 만큼 준다 — 후보가 모자라면 그보다 적다', () => {
    expect(body('limit=1').items).toHaveLength(1)
    expect(body('limit=10').items.length).toBeLessThanOrEqual(10)
    expect(body('limit=10').items.length).toBeGreaterThan(3)
  })

  /* `@Min(1)` · `@Max(10)` — `INSIGHT_105` */
  it.each(['limit=0', 'limit=11'])('%s 는 400 이다', (search) => {
    const result = recommend(search)
    const payload = result.payload as ApiResponse<never>

    expect(result.status).toBe(400)
    expect(payload.dataHeader.resultCode).toBe('INSIGHT_105')
  })

  /* 서버 후보 조건 — 동반 미확인을 "가기 좋은 곳" 으로 내밀지 않는다 */
  it('동반 가능 · 일부 허용만 온다', () => {
    for (const item of body('limit=10').items) {
      expect(['ALLOWED', 'PARTIALLY_ALLOWED']).toContain(item.petAllowanceType.code)
    }
  })

  it('사진 · 좌표가 있고 점수를 낸 곳만 온다', () => {
    for (const item of body('limit=10').items) {
      expect(item.firstImage).not.toBe('')
      expect(Number.isFinite(item.lat)).toBe(true)
      expect(Number.isFinite(item.lng)).toBe(true)
      expect(typeof item.score).toBe('number')
      expect(item.suitabilityLevel.code).not.toBe('INSUFFICIENT')
    }
  })

  /* 점수 desc → 동반 `ALLOWED` 먼저 → placeId asc (서버 정렬의 결정적 부분) */
  it('점수 높은 순이고 같은 점수면 동반 가능이 먼저다', () => {
    const items = body('limit=10').items

    for (let i = 1; i < items.length; i += 1) {
      const prev = items[i - 1]
      const next = items[i]
      if (prev === undefined || next === undefined) continue

      expect(prev.score).toBeGreaterThanOrEqual(next.score)
      if (prev.score === next.score && prev.petAllowanceType.code !== next.petAllowanceType.code) {
        expect(prev.petAllowanceType.code).toBe('ALLOWED')
      }
    }
  })

  /* 같은 요청은 같은 답이다 — 새로고침마다 추천이 바뀌면 못 믿는다 */
  it('결정적이다', () => {
    expect(body('limit=10')).toEqual(body('limit=10'))
  })

  /*
    **조건이 없으면 `petConditionApplied` 가 거짓이다.** 게스트 · 반려견 미등록 화면이 "반려견
    조건 반영" 을 말하지 않는지 로컬에서 볼 수 있어야 한다. 조건 판정은 골든타임 목과 같다 —
    FE 는 조건이 있으면 boolean 셋을 늘 명시해 보낸다(`toInsightQuery`).
  */
  it('조건이 없으면 반려견 조건이 반영되지 않았다고 말한다', () => {
    for (const item of body().items) expect(item.petConditionApplied).toBe(false)
  })

  it('조건이 있으면 반영됐다고 말한다', () => {
    const items = body(
      'limit=3&petSizeType=SMALL&heatSensitive=true&coldSensitive=false&noiseSensitive=false',
    ).items

    for (const item of items) expect(item.petConditionApplied).toBe(true)
  })

  /* 머리는 지역 공통 — 특보 · 날씨 출처 · 기준 일자가 한 번 온다 */
  it('머리에 기준 일자 · 날씨 출처 · 특보 자리가 있다', () => {
    const response = body()

    expect(response.targetDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(response.weatherProviderName).toBe('기상청 단기예보')
    expect(response).toHaveProperty('weatherWarning')
  })

  it('POST 는 처리하지 않는다', () => {
    expect(resolveMock('/places/recommendations', 'POST', '', null)).toBeNull()
  })
})

import { beforeEach, describe, expect, it } from 'vitest'

import { resolveMock } from '@/lib/api/mock'
import { resetMockStore } from '@/lib/api/mock/store'
import type { PlanDetail, PlanWeatherResponse } from '@/types/plan'

const TOKEN = 'mock-access-900000000000000001'
/** 3일 일정 (2026-09-12 ~ 09-14), 항목 6개 */
const PLAN = '223456789012000001'
/** 2일 일정인데 3일차 고아 항목이 있다 */
const ORPHAN_PLAN = '223456789012000002'
/** 다른 회원의 일정 */
const OTHERS = '223456789012000099'

function call(path: string, method: string, body: unknown = null, token: string | null = TOKEN) {
  return resolveMock(path, method, '', body === null ? null : JSON.stringify(body), token)
}

function detailOf(planId: string): PlanDetail {
  return call(`/plans/${planId}`, 'GET')?.payload.dataBody as PlanDetail
}

describe('일정 상세 mock — 조회', () => {
  beforeEach(resetMockStore)

  it('숫자가 아닌 planId 는 404 가 아니라 400 이다 — @PathVariable long 이다', () => {
    const result = call('/plans/abc', 'GET')

    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.resultCode).toBe('PLAN_114')
  })

  it('없는 숫자 planId 는 404 PLAN_001 이다', () => {
    const result = call('/plans/223456789012999999', 'GET')

    expect(result?.status).toBe(404)
    expect(result?.payload.dataHeader.resultCode).toBe('PLAN_001')
  })

  it('남의 일정도 404 다 — 존재 여부를 흘리지 않는다', () => {
    expect(call(`/plans/${OTHERS}`, 'GET')?.status).toBe(404)
  })

  it('토큰이 없으면 401 이다', () => {
    expect(call(`/plans/${PLAN}`, 'GET', null, null)?.status).toBe(401)
  })

  it('항목을 day → sequence 순으로 내려준다', () => {
    const detail = detailOf(PLAN)

    const order = detail.items.map((item) => `${item.day}-${item.sequence}`)
    expect(order).toEqual([...order].sort())
  })

  it('totalDays 를 기간에서 계산한다', () => {
    expect(detailOf(PLAN).totalDays).toBe(3)
  })

  it('itemType 을 metadata 로 부풀린다 — 화면이 한국어 매핑을 만들지 않게', () => {
    const walk = detailOf(PLAN).items.find((item) => item.itemType.code === 'WALK')

    expect(walk?.itemType.name).toBe('산책')
  })

  it('기간 밖 항목을 그대로 내려준다 — 서버가 정리하지 않는 상태를 재현한다', () => {
    const detail = detailOf(ORPHAN_PLAN)

    expect(detail.totalDays).toBe(2)
    expect(detail.items.some((item) => item.day > detail.totalDays)).toBe(true)
  })
})

describe('일정 상세 mock — 수정 · 삭제', () => {
  beforeEach(resetMockStore)

  it('부분 수정이다 — 보내지 않은 필드는 유지된다', () => {
    const before = detailOf(PLAN)
    const after = call(`/plans/${PLAN}`, 'PUT', { status: 'CONFIRMED' })?.payload
      .dataBody as PlanDetail

    expect(after.status.code).toBe('CONFIRMED')
    expect(after.title).toBe(before.title)
    expect(after.budget).toBe(before.budget)
  })

  it('budget 0 은 유효하다 — 예산을 비우는 유일한 방법이다', () => {
    const after = call(`/plans/${PLAN}`, 'PUT', { title: '새 이름', budget: 0 })?.payload
      .dataBody as PlanDetail

    expect(after.budget).toBe(0)
    expect(after.title).toBe('새 이름')
  })

  it('빈 제목은 400 PLAN_103 이다', () => {
    const result = call(`/plans/${PLAN}`, 'PUT', { title: '   ' })

    expect(result?.status).toBe(400)
    expect(errorsOf(result)[0]?.code).toBe('PLAN_103')
  })

  it('60자를 넘는 제목은 400 PLAN_104 다', () => {
    const result = call(`/plans/${PLAN}`, 'PUT', { title: '가'.repeat(61) })

    expect(errorsOf(result)[0]?.code).toBe('PLAN_104')
  })

  it('음수 예산은 400 PLAN_107 이다', () => {
    const result = call(`/plans/${PLAN}`, 'PUT', { budget: -1 })

    expect(errorsOf(result)[0]?.code).toBe('PLAN_107')
  })

  it('삭제는 소프트 삭제다 — 이후 조회가 404 다', () => {
    expect(call(`/plans/${PLAN}`, 'DELETE')?.status).toBe(200)
    expect(call(`/plans/${PLAN}`, 'GET')?.status).toBe(404)
  })

  it('남의 일정은 수정·삭제할 수 없다', () => {
    expect(call(`/plans/${OTHERS}`, 'PUT', { title: 'x' })?.status).toBe(404)
    expect(call(`/plans/${OTHERS}`, 'DELETE')?.status).toBe(404)
  })
})

describe('일정 판정 mock — /weather', () => {
  beforeEach(resetMockStore)

  function weatherOf(planId: string): PlanWeatherResponse {
    return call(`/plans/${planId}/weather`, 'GET')?.payload.dataBody as PlanWeatherResponse
  }

  it('days 는 항상 totalDays 길이다 — 길이로 성공을 판단하지 않는다', () => {
    expect(weatherOf(PLAN).days).toHaveLength(3)
    expect(weatherOf(ORPHAN_PLAN).days).toHaveLength(2)
  })

  it('예보 밖 일자는 score 가 null 이고 이유가 문장으로 온다', () => {
    const third = weatherOf(PLAN).days[2]

    expect(third?.score).toBeNull()
    expect(third?.suitabilityLevel).toBeNull()
    expect(third?.unavailableReason).not.toBeNull()
  })

  it('항목이 없는 일자는 판정 기준이 없다 — representativePlaceId 가 null 이다', () => {
    const third = weatherOf(PLAN).days[2]

    expect(third?.representativePlaceId).toBeNull()
  })

  it('WALK 는 판정 기준 장소가 되지 않는다 — targetId 가 walk_course.id 다', () => {
    const second = weatherOf(PLAN).days[1]

    expect(second?.representativePlaceId).not.toBe('777777777777000001')
  })

  it('비 예보 일자에만 실내 대안이 온다', () => {
    const days = weatherOf(PLAN).days

    expect(days[0]?.indoorAlternatives).toEqual([])
    expect(days[1]?.indoorAlternatives.length).toBeGreaterThan(0)
  })

  it('중기예보 구간을 코드로 알린다 — 화면이 대략적인 값임을 밝힐 수 있게', () => {
    const days = weatherOf(PLAN).days

    expect(days[0]?.weather?.forecastSourceCode).toBe('SHORT_TERM')
    expect(days[1]?.weather?.forecastSourceCode).toBe('MID_TERM')
  })

  it('하늘상태·강수형태는 metadata 가 아니라 문자열이다 (실측 계약)', () => {
    const first = weatherOf(PLAN).days[0]

    expect(typeof first?.weather?.skyStateName).toBe('string')
    expect(typeof first?.weather?.precipitationTypeName).toBe('string')
  })

  it('남의 일정 판정도 404 다', () => {
    expect(call(`/plans/${OTHERS}/weather`, 'GET')?.status).toBe(404)
  })
})

function errorsOf(result: ReturnType<typeof call>): { code: string; field: string }[] {
  const message = result?.payload.dataHeader.resultMessage as {
    errors?: { code: string; field: string }[]
  }
  return message.errors ?? []
}

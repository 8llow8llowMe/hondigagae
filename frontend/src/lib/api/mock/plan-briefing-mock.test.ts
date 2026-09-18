import { beforeEach, describe, expect, it } from 'vitest'

import { resolveMock } from '@/lib/api/mock'
import { resetMockStore } from '@/lib/api/mock/store'
import { todayDay } from '@/lib/date/day'
import type { PlanBriefingResponse, PlanDetail } from '@/types/plan'

const TOKEN = 'mock-access-900000000000000001'
/** 3일 일정 (2026-09-12 ~ 09-14) — 고정 날짜라 **오늘이 아닌 갈래**를 재현한다 */
const PLAN = '223456789012000001'
/** 다른 회원의 일정 */
const OTHERS = '223456789012000099'
/** 좌표가 있는 mock 장소 (`MOCK_PLACES` 의 첫 항목) */
const PLACE = '212481712381923328'

function call(path: string, search = '') {
  return resolveMock(path, 'GET', search, null, TOKEN)
}

function briefing(planId: string, date: string): PlanBriefingResponse {
  return call(`/plans/${planId}/briefing`, `date=${date}`)?.payload.dataBody as PlanBriefingResponse
}

/** 오늘을 포함하는 일정을 만들어 `today=true` 갈래를 연다 */
function createTodayPlan(): PlanDetail {
  const today = todayDay(new Date())
  const result = resolveMock(
    '/plans',
    'POST',
    '',
    JSON.stringify({
      petIds: ['123456789012000001'],
      areaCode: '39',
      title: '오늘 출발 일정',
      startDate: today,
      endDate: today,
      items: [
        {
          day: 1,
          sequence: 0,
          itemType: 'PLACE',
          targetId: PLACE,
          title: '협재해수욕장',
          startTime: '10:30:00',
        },
      ],
    }),
    TOKEN,
  )

  return result?.payload.dataBody as PlanDetail
}

describe('브리핑 mock — 계약 경계', () => {
  beforeEach(resetMockStore)

  it('date 가 없으면 400 이다 — @RequestParam 이 필수다', () => {
    expect(call(`/plans/${PLAN}/briefing`)?.status).toBe(400)
  })

  /** **기간 밖은 404 가 아니라 400 `PLAN_002`** 다 (`PlanBriefingProcessor.resolveDay`) */
  it('기간 밖 날짜는 400 PLAN_002 다', () => {
    const before = call(`/plans/${PLAN}/briefing`, 'date=2026-09-11')
    const after = call(`/plans/${PLAN}/briefing`, 'date=2026-09-15')

    expect(before?.status).toBe(400)
    expect(before?.payload.dataHeader.resultCode).toBe('PLAN_002')
    expect(after?.payload.dataHeader.resultCode).toBe('PLAN_002')
  })

  it('남의 일정은 404 PLAN_001 이다 — 존재 여부를 흘리지 않는다', () => {
    const result = call(`/plans/${OTHERS}/briefing`, 'date=2026-09-01')

    expect(result?.status).toBe(404)
    expect(result?.payload.dataHeader.resultCode).toBe('PLAN_001')
  })

  it('토큰이 없으면 401 이다', () => {
    expect(
      resolveMock(`/plans/${PLAN}/briefing`, 'GET', 'date=2026-09-12', null, null)?.status,
    ).toBe(401)
  })

  it('일차를 기간에서 센다', () => {
    expect(briefing(PLAN, '2026-09-12').day).toBe(1)
    expect(briefing(PLAN, '2026-09-14').day).toBe(3)
  })
})

describe('브리핑 mock — 특보·골든타임은 today 가 가른다', () => {
  beforeEach(resetMockStore)

  /*
    **이유가 차 있는 것과 "없음" 은 다른 사실이다.** mock 이 이유를 비우면 화면의 핵심
    갈래(확인 못 함)를 로컬에서 한 번도 못 본다 — 이 이슈의 회귀 감시 대상이다.
  */
  it('오늘이 아니면 두 자리가 비고 이유 문장이 온다', () => {
    const data = briefing(PLAN, '2026-09-13')

    expect(data.today).toBe(false)
    expect(data.weatherWarning).toBeNull()
    expect(data.weatherWarningUnavailableReason).toBe('기상특보는 출발 당일에만 확인합니다.')
    expect(data.walkTimes).toBeNull()
    expect(data.walkTimesUnavailableReason).not.toBeNull()
  })

  it('오늘이면 특보와 골든타임이 차고 이유가 비어 있다', () => {
    const plan = createTodayPlan()
    const data = briefing(plan.planId, todayDay(new Date()))

    expect(data.today).toBe(true)
    expect(data.weatherWarning).not.toBeNull()
    expect(data.weatherWarningUnavailableReason).toBeNull()
    expect(data.walkTimes).not.toBeNull()
    expect(data.walkTimesUnavailableReason).toBeNull()
  })

  /** **좌표가 오는 자리가 `walkTimes` 하나뿐이다** — `schedule` 에는 없다 (명세 D3-3) */
  it('좌표를 walkTimes 안에만 싣는다', () => {
    const plan = createTodayPlan()
    const data = briefing(plan.planId, todayDay(new Date()))

    expect(typeof data.walkTimes?.lat).toBe('number')
    expect(Object.keys(data.schedule)).not.toContain('representativeLat')
    expect(Object.keys(data.schedule)).not.toContain('representativeLng')
  })
})

describe('브리핑 mock — 그날 일정 요약', () => {
  beforeEach(resetMockStore)

  it('그날 항목만 세고 처음·마지막을 sequence 순으로 고른다', () => {
    const data = briefing(PLAN, '2026-09-12')

    expect(data.schedule.itemCount).toBeGreaterThan(0)
    expect(data.schedule.firstItem?.sequence).toBe(0)
    expect(data.schedule.lastItem?.sequence).toBeGreaterThanOrEqual(
      data.schedule.firstItem?.sequence ?? 0,
    )
  })

  /**
   * **`itemType` 이 metadata 가 아니라 enum 문자열이다** — 같은 도메인의
   * `PlanItemDetail.itemType` 과 모양이 다르다 (명세 D9-1). mock 이 모양을 맞추지 않으면
   * 화면이 그 드리프트를 로컬에서 한 번도 못 본다.
   */
  it('itemType 을 metadata 로 부풀리지 않는다', () => {
    const first = briefing(PLAN, '2026-09-12').schedule.firstItem

    expect(typeof first?.itemType).toBe('string')
  })

  it('날씨는 일정 날씨 브리핑의 그 일자와 같은 모양이다', () => {
    const data = briefing(PLAN, '2026-09-12')

    expect(data.weather?.date).toBe('2026-09-12')
    expect(data.weather).toHaveProperty('unavailableReasonCode')
  })
})

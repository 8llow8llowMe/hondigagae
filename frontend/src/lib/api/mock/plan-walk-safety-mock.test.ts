import { beforeEach, describe, expect, it } from 'vitest'

import { resolveMock } from '@/lib/api/mock'
import { MOCK_PLACES } from '@/lib/api/mock/place-data'
import { WALK_SAFETY_LOOKUP_FAILED_MARKER } from '@/lib/api/mock/plan-data'
import { resetMockStore } from '@/lib/api/mock/store'
import { todayDay } from '@/lib/date/day'
import type { PlanDetail, PlanItemWalkSafetyItem, PlanWalkSafetyResponse } from '@/types/plan'

/**
 * 항목 산책 위험도 mock (#625 계약 복제) — 명세 D15-9 "mock" 절.
 *
 * **mock 이 백엔드보다 느슨하거나 엄격해서는 안 된다.** 특히 사유 우선순위(#25)와
 * 예보 지평 4일(#26)은 mock 이 틀리면 화면이 못 만나는 분기가 생긴다.
 *
 * **날짜는 실행 시점의 실제 "오늘" 상대로 짠다** — `ai-plan-mock.test.ts` 와 같은 판단이다.
 * 달력에 고정 날짜를 적으면 이 저장소의 "오늘" 이 그 날짜를 지나는 순간 조용히 깨진다.
 */

const TOKEN = 'mock-access-900000000000000001'
const OTHERS_PLAN = '223456789012000099'

function call(path: string, method: string, body: unknown = null, token: string | null = TOKEN) {
  return resolveMock(path, method, '', body === null ? null : JSON.stringify(body), token)
}

/** 백엔드 `Date.parse(...T00:00:00Z)` 산술과 같은 방식으로 날짜를 민다 — mock 내부 `addDays` 복제 */
function addDays(date: string, days: number): string {
  const time = Date.parse(`${date}T00:00:00Z`)
  return new Date(time + days * 86_400_000).toISOString().slice(0, 10)
}

const TODAY = todayDay(new Date())
const YESTERDAY = addDays(TODAY, -1)
const HORIZON_END = addDays(TODAY, 4)
const BEYOND_HORIZON = addDays(TODAY, 5)

const PAST_PLACE = MOCK_PLACES[0]!.placeId
const NORMAL_PLACE = MOCK_PLACES[1]!.placeId
const LOOKUP_FAILED_PLACE = MOCK_PLACES[2]!.placeId
const BEYOND_PLACE = MOCK_PLACES[3]!.placeId

/**
 * 다섯 사유를 한 번에 갖춘 일정을 만든다.
 *
 * | day | 날짜        | 항목                                             | 기대 사유                |
 * | --- | ----------- | ------------------------------------------------ | ------------------------ |
 * | 1   | 어제        | 장소, 시각 없음                                   | `PAST_DATE`(시각 없음보다 앞선다) |
 * | 2   | 오늘        | 장소, 시각 있음                                   | 정상 판정                |
 * | 2   | 오늘        | `WALK`, 시각 있음                                 | `NOT_PLACE_TARGET`       |
 * | 2   | 오늘        | 장소, 시각 있음, `memo` 마커                      | `LOOKUP_FAILED`          |
 * | 7   | 오늘+5      | 장소, 시각 있음                                   | `BEYOND_FORECAST_RANGE`  |
 */
function createScenarioPlan(): string {
  const created = call('/plans', 'POST', {
    petIds: ['123456789012000001'],
    areaCode: '39',
    title: '산책 위험도 테스트 일정',
    startDate: YESTERDAY,
    endDate: addDays(YESTERDAY, 6), // 어제 ~ 오늘+5, 7일
    items: [
      {
        day: 1,
        sequence: 0,
        itemType: 'PLACE',
        targetId: PAST_PLACE,
        title: '지난 날 장소',
      },
      {
        day: 2,
        sequence: 0,
        itemType: 'PLACE',
        targetId: NORMAL_PLACE,
        title: '오늘 정상 장소',
        startTime: '10:00:00',
      },
      {
        day: 2,
        sequence: 1,
        itemType: 'WALK',
        targetId: '777777777777000001',
        title: '동네 산책',
        startTime: '09:00:00',
      },
      {
        day: 2,
        sequence: 2,
        itemType: 'PLACE',
        targetId: LOOKUP_FAILED_PLACE,
        title: '조회 실패 장소',
        startTime: '11:00:00',
        memo: WALK_SAFETY_LOOKUP_FAILED_MARKER,
      },
      {
        day: 7,
        sequence: 0,
        itemType: 'PLACE',
        targetId: BEYOND_PLACE,
        title: '먼 미래 장소',
        startTime: '09:00:00',
      },
    ],
  })

  expect(created?.status).toBe(200)
  return (created?.payload.dataBody as PlanDetail).planId
}

function itemsOf(planId: string): PlanItemWalkSafetyItem[] {
  const result = call(`/plans/${planId}/walk-safety`, 'GET')
  expect(result?.status).toBe(200)
  return (result?.payload.dataBody as PlanWalkSafetyResponse).items
}

function byTitle(items: PlanItemWalkSafetyItem[], title: string): PlanItemWalkSafetyItem {
  const found = items.find((item) => item.title === title)
  if (found === undefined) throw new Error(`fixture 항목을 찾지 못했다: ${title}`)
  return found
}

describe('항목 산책 위험도 mock — 사유 갈래 (#625)', () => {
  beforeEach(resetMockStore)

  it('정상 판정 — 시각 있는 장소 항목에 walkSafetyLevel 이 온다', () => {
    const items = itemsOf(createScenarioPlan())
    const item = byTitle(items, '오늘 정상 장소')

    expect(item.walkSafetyLevel).not.toBeNull()
    expect(item.unavailableReasonCode).toBeNull()
  })

  it('사유 우선순위 — 지난 날짜 + 시각 없음 항목은 PAST_DATE 다 (NO_START_TIME 이 아니다)', () => {
    const items = itemsOf(createScenarioPlan())
    const item = byTitle(items, '지난 날 장소')

    expect(item.unavailableReasonCode).toBe('PAST_DATE')
  })

  it('지평 — 오늘+5 일자 항목은 BEYOND_FORECAST_RANGE 다', () => {
    const items = itemsOf(createScenarioPlan())
    const item = byTitle(items, '먼 미래 장소')

    expect(item.date).toBe(BEYOND_HORIZON)
    expect(item.unavailableReasonCode).toBe('BEYOND_FORECAST_RANGE')
  })

  it('지평 경계(오늘+4)는 여전히 판정 안이다', () => {
    // 위 fixture 의 endDate 가 오늘+5 까지라 day6(오늘+4)은 별도로 짧게 확인한다
    const created = call('/plans', 'POST', {
      petIds: ['123456789012000001'],
      areaCode: '39',
      title: '지평 경계 테스트',
      startDate: TODAY,
      endDate: HORIZON_END,
      items: [
        {
          day: 5,
          sequence: 0,
          itemType: 'PLACE',
          targetId: NORMAL_PLACE,
          title: '경계 장소',
          startTime: '09:00:00',
        },
      ],
    })
    const planId = (created?.payload.dataBody as PlanDetail).planId
    const item = byTitle(itemsOf(planId), '경계 장소')

    expect(item.date).toBe(HORIZON_END)
    expect(item.unavailableReasonCode).toBeNull()
    expect(item.walkSafetyLevel).not.toBeNull()
  })

  it('WALK 항목은 NOT_PLACE_TARGET 이고 placeId 가 null 이다', () => {
    const items = itemsOf(createScenarioPlan())
    const item = byTitle(items, '동네 산책')

    expect(item.unavailableReasonCode).toBe('NOT_PLACE_TARGET')
    expect(item.placeId).toBeNull()
  })

  it('LOOKUP_FAILED 는 placeId 가 남아 있다 — 장소 상세 링크로 계속 쓴다', () => {
    const items = itemsOf(createScenarioPlan())
    const item = byTitle(items, '조회 실패 장소')

    expect(item.unavailableReasonCode).toBe('LOOKUP_FAILED')
    expect(item.placeId).toBe(LOOKUP_FAILED_PLACE)
  })

  it('항목 하나가 실패해도 전체 응답은 HTTP 200 이다', () => {
    const result = call(`/plans/${createScenarioPlan()}/walk-safety`, 'GET')

    // LOOKUP_FAILED · NOT_PLACE_TARGET 항목이 섞여 있어도 응답 자체는 200 이다
    expect(result?.status).toBe(200)
  })
})

describe('항목 산책 위험도 mock — 소유권 (#625)', () => {
  beforeEach(resetMockStore)

  it('남의 일정은 404 PLAN_001 이다', () => {
    const result = call(`/plans/${OTHERS_PLAN}/walk-safety`, 'GET')

    expect(result?.status).toBe(404)
    expect((result?.payload as { dataHeader: { resultCode: string } }).dataHeader.resultCode).toBe(
      'PLAN_001',
    )
  })

  it('숫자가 아닌 planId 는 400 PLAN_124 다', () => {
    const result = call('/plans/not-a-number/walk-safety', 'GET')

    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader).toMatchObject({
      resultCode: 'PLAN_124',
      resultMessage: 'planId 파라미터 형식이 올바르지 않습니다.',
      fieldErrors: [
        { code: 'PLAN_124', field: 'planId', message: 'planId 파라미터 형식이 올바르지 않습니다.' },
      ],
    })
  })
})

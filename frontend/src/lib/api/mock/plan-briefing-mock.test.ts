import { beforeEach, describe, expect, it } from 'vitest'

import { resolveMock } from '@/lib/api/mock'
import {
  BRIEFING_WALK_LOOKUP_FAILED_MARKER,
  BRIEFING_WARNING_LOOKUP_FAILED_MARKER,
} from '@/lib/api/mock/plan-data'
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
/**
 * 마커를 실은 오늘 일정 — `LOOKUP_FAILED` 갈래 전용 (#751).
 *
 * 항목 둘에 마커를 하나씩 실어 **특보만 / 골든타임만 / 둘 다** 를 모두 고를 수 있다.
 * 기준 항목(sequence 0)은 좌표가 있는 실재 장소 그대로다 — 마커가 좌표를 지우면
 * `NO_PLACE_POINT` 와 구분되지 않고, 이 갈래의 요점인 좌표 폴백을 볼 수 없다.
 */
function createTodayPlanWithMarkers(memos: { walk?: boolean; warning?: boolean }): PlanDetail {
  const today = todayDay(new Date())
  const result = resolveMock(
    '/plans',
    'POST',
    '',
    JSON.stringify({
      petIds: ['123456789012000001'],
      areaCode: '39',
      title: '조회 실패 일정',
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
          ...(memos.walk === true ? { memo: BRIEFING_WALK_LOOKUP_FAILED_MARKER } : {}),
        },
        {
          day: 1,
          sequence: 1,
          itemType: 'MOVE',
          title: '이동',
          ...(memos.warning === true ? { memo: BRIEFING_WARNING_LOOKUP_FAILED_MARKER } : {}),
        },
      ],
    }),
    TOKEN,
  )

  return result?.payload.dataBody as PlanDetail
}

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

  /**
   * **누락과 형식 오류를 서버가 가른다** (#716 실측 · 명세 D9-4). 누락은
   * `MissingServletRequestParameterException` → `PLAN_125`, 형식 오류는
   * `MethodArgumentTypeMismatchException` → `PLAN_124` 다. 예전에는 둘을 `PLAN_100` 하나로
   * 묶고 있었다.
   *
   * **문구까지 단언한다** — 코드만 보면 목이 서버와 다른 문장을 내도 초록불이라, #716 의
   * BE 소스 추정 문구가 dev 실측과 다른 채로 반년을 살아남았다 (#795).
   */
  it('date 가 없으면 400 PLAN_125 다 — @RequestParam 이 필수다', () => {
    const result = call(`/plans/${PLAN}/briefing`)

    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader).toMatchObject({
      resultCode: 'PLAN_125',
      resultMessage: '필수 요청 파라미터가 누락되었습니다. (date)',
      fieldErrors: null,
    })
  })

  /** 빈 값도 누락이다 — dev 는 `?date=` 에도 `PLAN_125` 를 낸다 */
  it('date 가 비어 있어도 400 PLAN_125 다', () => {
    const result = call(`/plans/${PLAN}/briefing`, 'date=')

    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.resultCode).toBe('PLAN_125')
  })

  /**
   * **`fieldErrors` 한 건이 실린다.** 항목 `code` 가 헤더와 같은 `PLAN_124` 다 —
   * `failValidation`(헤더 `PLAN_100` + 항목별 코드) 모양이 아니다 (dev 실측, #795).
   */
  it('date 형식이 틀리면 400 PLAN_124 + fieldErrors 한 건이다', () => {
    const result = call(`/plans/${PLAN}/briefing`, 'date=2026-9-12')

    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader).toMatchObject({
      resultCode: 'PLAN_124',
      resultMessage: 'date 파라미터 형식이 올바르지 않습니다.',
      fieldErrors: [
        { code: 'PLAN_124', field: 'date', message: 'date 파라미터 형식이 올바르지 않습니다.' },
      ],
    })
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

  /**
   * **`date` 바인딩이 인증보다 먼저다** (#795 · 명세 D12-5). 스프링은 `@RequestParam` 을
   * 인자로 푸는 단계에서 400 을 내고 `@PreAuthorize` 는 그 뒤에 걸린다 — dev 실측
   * (2026-09-21, 토큰 없는 GET)에서 `date` 누락은 400 `PLAN_125`, 날짜가 온전하면
   * 401 이다. 목이 401 을 먼저 내면 서버보다 엄격해진다.
   */
  it('토큰이 없어도 date 누락이 먼저 400 PLAN_125 로 떨어진다', () => {
    const result = resolveMock(`/plans/${PLAN}/briefing`, 'GET', '', null, null)

    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.resultCode).toBe('PLAN_125')
  })

  /**
   * 그보다도 `planId` 형식이 앞이다 — 첫 인자를 먼저 푼다 (같은 실측).
   *
   * **`PLAN_114` 가 아니라 `PLAN_124` 다** — #795 가 별건으로 남겼던 드리프트를 #803 이
   * 고쳤다. 모양은 일정상세 명세 D5-1 이 정본이다.
   */
  it('planId 형식 오류는 date 누락보다 앞이다', () => {
    const result = resolveMock('/plans/abc/briefing', 'GET', '', null, null)

    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader).toMatchObject({
      resultCode: 'PLAN_124',
      resultMessage: 'planId 파라미터 형식이 올바르지 않습니다.',
      fieldErrors: [
        { code: 'PLAN_124', field: 'planId', message: 'planId 파라미터 형식이 올바르지 않습니다.' },
      ],
    })
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

  /**
   * **좌표는 `schedule` 에도 온다** (#716 · 명세 D9-3). 예전에는 `walkTimes` 안이 유일한
   * 자리라 골든타임을 못 낸 날에는 곡선도 지도도 부를 수 없었다.
   */
  it('좌표를 schedule 과 walkTimes 양쪽에 싣고 두 값이 같다', () => {
    const plan = createTodayPlan()
    const data = briefing(plan.planId, todayDay(new Date()))

    expect(typeof data.walkTimes?.lat).toBe('number')
    expect(data.schedule.representativeLat).toBe(data.walkTimes?.lat)
    expect(data.schedule.representativeLng).toBe(data.walkTimes?.lng)
  })
})

/*
  ── `LOOKUP_FAILED` 갈래 (#751) ────────────────────────────────────────────

  **넷 중 이 사유만 데이터로 만들 수 없다** — 원격 조회의 시간차 장애라 일정에 그 상태가
  없다. 마커로 결정적으로 재현한다. 이 갈래를 로컬에서 못 보던 대가가 실제로 있었다:
  #751 검토에서 여기 걸린 버그 둘이 코드로만 잡혔다.
*/
describe('브리핑 mock — LOOKUP_FAILED 마커', () => {
  beforeEach(resetMockStore)

  it('골든타임 마커는 walkTimes 를 비우고 LOOKUP_FAILED 를 낸다', () => {
    const plan = createTodayPlanWithMarkers({ walk: true })
    const data = briefing(plan.planId, todayDay(new Date()))

    expect(data.walkTimes).toBeNull()
    expect(data.walkTimesUnavailableReasonCode).toBe('LOOKUP_FAILED')
    expect(data.walkTimesUnavailableReason).toContain('가져오지 못했습니다')
  })

  /**
   * **이 갈래의 요점이다.** `LOOKUP_FAILED` 는 대표 장소가 멀쩡한데 조회만 실패한 상태라
   * 좌표가 남는다 — 그래야 화면이 `schedule` 좌표로 곡선을 부르는 폴백(명세 D9-3)이
   * 로컬에서 실제로 돈다. 마커가 좌표까지 지우면 `NO_PLACE_POINT` 와 구분되지 않는다.
   */
  it('마커가 대표 장소 좌표를 지우지 않는다', () => {
    const plan = createTodayPlanWithMarkers({ walk: true })
    const data = briefing(plan.planId, todayDay(new Date()))

    expect(typeof data.schedule.representativeLat).toBe('number')
    expect(typeof data.schedule.representativeLng).toBe('number')
  })

  it('특보 마커는 weatherWarning 을 비우고 LOOKUP_FAILED 를 낸다', () => {
    const plan = createTodayPlanWithMarkers({ warning: true })
    const data = briefing(plan.planId, todayDay(new Date()))

    expect(data.weatherWarning).toBeNull()
    expect(data.weatherWarningUnavailableReasonCode).toBe('LOOKUP_FAILED')
    // 골든타임은 멀쩡하다 — 두 축이 따로 고를 수 있어야 각각을 화면에서 본다
    expect(data.walkTimesUnavailableReasonCode).toBeNull()
  })

  /** 게이트웨이 장애는 둘을 함께 때린다 — 재시도 버튼이 둘 서는 갈래다 */
  it('마커 둘을 함께 실으면 두 사유가 같이 LOOKUP_FAILED 다', () => {
    const plan = createTodayPlanWithMarkers({ walk: true, warning: true })
    const data = briefing(plan.planId, todayDay(new Date()))

    expect(data.weatherWarningUnavailableReasonCode).toBe('LOOKUP_FAILED')
    expect(data.walkTimesUnavailableReasonCode).toBe('LOOKUP_FAILED')
  })

  /** 오늘이 아니면 서버가 조회 자체를 안 한다 — 마커가 `NOT_TODAY` 를 덮으면 안 된다 */
  it('오늘이 아닌 날에는 마커가 NOT_TODAY 를 이기지 않는다', () => {
    const data = briefing(PLAN, '2026-09-13')

    expect(data.walkTimesUnavailableReasonCode).toBe('NOT_TODAY')
    expect(data.weatherWarningUnavailableReasonCode).toBe('NOT_TODAY')
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
   * **`itemType` 이 metadata 다** (#716 · 명세 D9-1) — 같은 도메인의
   * `PlanItemDetail.itemType` 과 모양이 같아졌다. 한국어는 서버가 채우므로 화면은 `name`
   * 을 그대로 그린다.
   */
  it('itemType 을 code·name·description metadata 로 낸다', () => {
    const first = briefing(PLAN, '2026-09-12').schedule.firstItem

    expect(first?.itemType).toEqual({
      code: 'PLACE',
      name: '장소',
      description: '관광지·카페 등 방문 장소 항목입니다.',
    })
  })

  it('날씨는 일정 날씨 브리핑의 그 일자와 같은 모양이다', () => {
    const data = briefing(PLAN, '2026-09-12')

    expect(data.weather?.date).toBe('2026-09-12')
    expect(data.weather).toHaveProperty('unavailableReasonCode')
  })
})

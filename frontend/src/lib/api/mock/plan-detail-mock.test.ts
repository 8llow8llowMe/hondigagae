import { beforeEach, describe, expect, it } from 'vitest'

import { resolveMock } from '@/lib/api/mock'
import { resetMockStore } from '@/lib/api/mock/store'
import type { PlanDetail, PlanWeatherResponse } from '@/types/plan'

const TOKEN = 'mock-access-900000000000000001'
/** 3일 일정 (2026-09-12 ~ 09-14), 항목 7개 — WALK 1개와 delisted 장소 1개를 포함한다 */
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

  it('장소 항목에 place 요약을 실어 준다 — FE 가 항목마다 조회하지 않게 (#86)', () => {
    const museum = detailOf(PLAN).items.find(
      (item) => item.title === '제주특별자치도립김창열미술관',
    )

    expect(museum?.place?.addr1).toContain('한림읍')
    expect(museum?.place?.indoor).toBe(true)
    expect(museum?.place?.lat).not.toBeNull()
  })

  it('WALK 는 place 가 null 이다 — targetId 가 walk_course.id 라 물어볼 장소가 없다', () => {
    const walk = detailOf(PLAN).items.find((item) => item.itemType.code === 'WALK')

    expect(walk).toBeDefined()
    expect(walk?.place).toBeNull()
  })

  it('사라진(delisted) 장소는 place 가 null 이지만 항목은 남는다', () => {
    const delisted = detailOf(PLAN).items.find((item) => item.title === '사라진 전시관')

    expect(delisted).toBeDefined()
    expect(delisted?.targetId).not.toBeNull()
    expect(delisted?.place).toBeNull()
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

describe('일자별 항목 일괄 교체 mock', () => {
  beforeEach(resetMockStore)

  /** 3일 일정의 1일차 항목 3개를 그대로 되돌려 보내는 본문 */
  function currentDayItems(day: number) {
    return detailOf(PLAN)
      .items.filter((item) => item.day === day)
      .map((item, index) => ({
        day,
        sequence: index,
        itemType: item.itemType.code,
        ...(item.targetId === null ? {} : { targetId: item.targetId }),
        title: item.title,
        ...(item.memo === null ? {} : { memo: item.memo }),
        ...(item.startTime === null ? {} : { startTime: item.startTime }),
      }))
  }

  function replace(day: number, items: unknown[], planId = PLAN) {
    return call(`/plans/${planId}/days/${day}/items`, 'PUT', { items })
  }

  it('그 일자를 통째로 교체한다 — 다른 일자는 건드리지 않는다', () => {
    const before = detailOf(PLAN)
    const day2Before = before.items.filter((item) => item.day === 2).length

    const after = replace(1, currentDayItems(1).slice(0, 1))?.payload.dataBody as PlanDetail

    expect(after.items.filter((item) => item.day === 1)).toHaveLength(1)
    expect(after.items.filter((item) => item.day === 2)).toHaveLength(day2Before)
  })

  it('저장하면 planItemId 가 전부 새로 발급된다 — 삭제 후 재삽입이다', () => {
    const before = detailOf(PLAN)
      .items.filter((item) => item.day === 1)
      .map((item) => item.planItemId)

    const after = (replace(1, currentDayItems(1))?.payload.dataBody as PlanDetail).items
      .filter((item) => item.day === 1)
      .map((item) => item.planItemId)

    expect(after).toHaveLength(before.length)
    expect(after.some((id) => before.includes(id))).toBe(false)
  })

  it('memo · startTime 이 보존된다 — 빼먹으면 순서만 바꿔도 지워진다', () => {
    const after = replace(1, currentDayItems(1))?.payload.dataBody as PlanDetail
    const first = after.items.find((item) => item.day === 1 && item.sequence === 0)

    expect(first?.memo).toBe('실내라 비가 와도 괜찮아요')
    expect(first?.startTime).toBe('10:00:00')
  })

  it('빈 목록을 보내면 그 일자가 비워진다 — 서버가 허용하는 동작이다', () => {
    const after = replace(1, [])?.payload.dataBody as PlanDetail

    expect(after.items.filter((item) => item.day === 1)).toEqual([])
  })

  it('기간 밖 일자는 400 PLAN_002 다', () => {
    const result = replace(9, currentDayItems(1))

    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.resultCode).toBe('PLAN_002')
  })

  it('존재하지 않는 장소가 섞이면 400 PLAN_004 다 — delisting 도 걸린다', () => {
    const result = replace(1, [
      {
        day: 1,
        sequence: 0,
        itemType: 'PLACE',
        targetId: '999999999999999999',
        title: '사라진 곳',
      },
    ])

    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.resultCode).toBe('PLAN_004')
  })

  it('PLAN_004 로 막히면 기존 항목이 그대로 남는다 — 검증이 삭제보다 먼저다', () => {
    const before = detailOf(PLAN).items.filter((item) => item.day === 1).length

    replace(1, [
      {
        day: 1,
        sequence: 0,
        itemType: 'PLACE',
        targetId: '999999999999999999',
        title: '사라진 곳',
      },
    ])

    expect(detailOf(PLAN).items.filter((item) => item.day === 1)).toHaveLength(before)
  })

  it('day 가 0 이면 @Min(1) 에 걸린다 — 경로값 덮어쓰기보다 검증이 먼저다', () => {
    const result = replace(1, [
      { day: 0, sequence: 0, itemType: 'PLACE', targetId: '212481712381923328', title: '미술관' },
    ])

    expect(result?.status).toBe(400)
    expect(errorsOf(result)[0]?.code).toBe('PLAN_110')
  })

  it('빈 제목은 400 PLAN_105 다', () => {
    const result = replace(1, [{ day: 1, sequence: 0, itemType: 'PLACE', title: '  ' }])

    expect(errorsOf(result)[0]?.code).toBe('PLAN_105')
  })

  it('100자를 넘는 제목은 400 PLAN_106 이다', () => {
    const result = replace(1, [{ day: 1, sequence: 0, itemType: 'PLACE', title: '가'.repeat(101) }])

    expect(errorsOf(result)[0]?.code).toBe('PLAN_106')
  })

  it('500자를 넘는 메모는 400 PLAN_108 이다', () => {
    const result = replace(1, [
      { day: 1, sequence: 0, itemType: 'PLACE', title: '미술관', memo: '가'.repeat(501) },
    ])

    expect(errorsOf(result)[0]?.code).toBe('PLAN_108')
  })

  it('WALK 는 장소 검증 대상이 아니다 — targetId 가 walk_course.id 다', () => {
    const result = replace(1, [
      { day: 1, sequence: 0, itemType: 'WALK', targetId: '777777777777000001', title: '산책' },
    ])

    expect(result?.status).toBe(200)
  })

  it('숫자가 아닌 day 는 400 PLAN_114 다', () => {
    const result = call(`/plans/${PLAN}/days/abc/items`, 'PUT', { items: [] })

    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.resultCode).toBe('PLAN_114')
  })

  it('남의 일정은 교체할 수 없다', () => {
    expect(replace(1, [], OTHERS)?.status).toBe(404)
  })

  it('토큰이 없으면 401 이다', () => {
    expect(call(`/plans/${PLAN}/days/1/items`, 'PUT', { items: [] }, null)?.status).toBe(401)
  })
})

/**
 * 항목 방문 체크 — 이슈 #124.
 *
 * **계약의 핵심은 마지막 케이스다**: 일자 항목을 일괄 교체하면 그 날의 체크가 초기화된다.
 * mock 이 체크를 이어받으면 화면이 경고 문구로 말하는 사실을 로컬에서 검증할 수 없다.
 */
describe('일정 상세 mock — 항목 방문 체크 (#124)', () => {
  beforeEach(resetMockStore)

  /** 1일차 첫 항목. 시드에서 `visited: true` 로 시작한다 */
  const VISITED_ITEM = '323456789012000001'
  /** 1일차 세 번째 항목(숙소). 시드에서 꺼진 상태다 */
  const UNVISITED_ITEM = '323456789012000003'

  function visit(planItemId: string, visited: boolean, planId = PLAN) {
    return call(`/plans/${planId}/items/${planItemId}/visited`, 'PUT', { visited })
  }

  function itemOf(planId: string, planItemId: string) {
    return detailOf(planId).items.find((item) => item.planItemId === planItemId)
  }

  it('상세 응답이 visited 를 함께 준다 — 시드가 켠 항목과 끈 항목을 둘 다 낸다', () => {
    expect(itemOf(PLAN, VISITED_ITEM)?.visited).toBe(true)
    expect(itemOf(PLAN, UNVISITED_ITEM)?.visited).toBe(false)
  })

  it('체크하면 상세에 반영된다', () => {
    expect(visit(UNVISITED_ITEM, true)?.status).toBe(200)
    expect(itemOf(PLAN, UNVISITED_ITEM)?.visited).toBe(true)
  })

  it('해제도 같은 API 다 — visited=false 를 보낸다', () => {
    expect(visit(VISITED_ITEM, false)?.status).toBe(200)
    expect(itemOf(PLAN, VISITED_ITEM)?.visited).toBe(false)
  })

  it('응답이 Response<Void> 다 — dataBody 가 null 이다', () => {
    const result = visit(UNVISITED_ITEM, true)

    expect(result?.payload.dataHeader.success).toBe(true)
    expect(result?.payload.dataBody).toBeNull()
  })

  it('visited 가 빠지면 400 PLAN_100 이다 — @NotNull Boolean 이다', () => {
    const result = call(`/plans/${PLAN}/items/${UNVISITED_ITEM}/visited`, 'PUT', {})

    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.resultCode).toBe('PLAN_100')
  })

  it('없는 항목은 404 PLAN_005 다', () => {
    const result = visit('323456789012999999', true)

    expect(result?.status).toBe(404)
    expect(result?.payload.dataHeader.resultCode).toBe('PLAN_005')
  })

  it('다른 일정의 항목을 내 planId 로 체크할 수 없다 — 404 PLAN_005 다', () => {
    // 소유권은 일정 기준으로 보고, 항목이 그 일정의 것인지 다시 확인한다
    const result = visit(VISITED_ITEM, true, ORPHAN_PLAN)

    expect(result?.status).toBe(404)
    expect(result?.payload.dataHeader.resultCode).toBe('PLAN_005')
  })

  it('숫자가 아닌 planItemId 는 404 가 아니라 400 PLAN_114 다', () => {
    const result = visit('abc', true)

    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.resultCode).toBe('PLAN_114')
  })

  it('남의 일정 항목은 404 PLAN_001 이다 — 일정 판정이 먼저다', () => {
    const result = visit(VISITED_ITEM, true, OTHERS)

    expect(result?.status).toBe(404)
    expect(result?.payload.dataHeader.resultCode).toBe('PLAN_001')
  })

  it('토큰이 없으면 401 이다', () => {
    const result = call(
      `/plans/${PLAN}/items/${VISITED_ITEM}/visited`,
      'PUT',
      { visited: true },
      null,
    )

    expect(result?.status).toBe(401)
  })

  it('일괄 교체하면 그 날의 체크가 초기화된다 — 항목이 새로 발급되기 때문이다', () => {
    expect(itemOf(PLAN, VISITED_ITEM)?.visited).toBe(true)

    // 1일차를 항목 하나로 교체한다. 새 planItemId 가 발급된다
    const replaced = call(`/plans/${PLAN}/days/1/items`, 'PUT', {
      items: [
        { day: 1, sequence: 0, itemType: 'PLACE', targetId: '212481712381923328', title: '미술관' },
      ],
    })
    expect(replaced?.status).toBe(200)

    const dayOne = detailOf(PLAN).items.filter((item) => item.day === 1)

    expect(dayOne).toHaveLength(1)
    // 낡은 id 는 사라졌고, 새 항목은 꺼진 상태다
    expect(itemOf(PLAN, VISITED_ITEM)).toBeUndefined()
    expect(dayOne[0]?.visited).toBe(false)
  })

  it('교체 뒤 낡은 planItemId 로 체크하면 404 PLAN_005 다 — 재시도로 풀리지 않는 실패다', () => {
    call(`/plans/${PLAN}/days/1/items`, 'PUT', { items: [] })

    expect(visit(VISITED_ITEM, true)?.status).toBe(404)
  })
})

import { beforeEach, describe, expect, it } from 'vitest'

import { resolveMock } from '@/lib/api/mock'
import { resetMockStore } from '@/lib/api/mock/store'
import type { AiPlanJob, AiPlanSubmitResult } from '@/types/ai-plan'
import type { ApiResponse } from '@/types/api'

/** 데모 계정(`900000000000000001`)의 토큰. `auth-data.ts` 가 이 형식을 발급한다 */
const TOKEN = 'mock-access-900000000000000001'
const OTHER = 'mock-access-900000000000000777'

const VALID = {
  areaCode: '39',
  startDate: '2026-11-01',
  endDate: '2026-11-03',
  petId: '123456789012000001',
}

function submit(body: Record<string, unknown> = VALID, token: string | null = TOKEN) {
  return resolveMock('/ai-plans', 'POST', '', JSON.stringify(body), token)
}

function job(jobId: string, token: string | null = TOKEN) {
  return resolveMock(`/ai-plans/jobs/${jobId}`, 'GET', '', null, token)
}

function submitted(result: ReturnType<typeof submit>): AiPlanSubmitResult {
  return (result?.payload as ApiResponse<AiPlanSubmitResult>).dataBody!
}

function status(result: ReturnType<typeof job>): AiPlanJob {
  return (result?.payload as ApiResponse<AiPlanJob>).dataBody!
}

/** 제출 후 지정 횟수만큼 조회해 마지막 응답을 돌려준다 */
function pollTimes(jobId: string, times: number): AiPlanJob {
  let last = status(job(jobId))
  for (let index = 1; index < times; index += 1) last = status(job(jobId))
  return last
}

function newJob(body: Record<string, unknown> = VALID): string {
  return submitted(submit(body)).jobId
}

beforeEach(resetMockStore)

describe('AI 일정 mock — 인증', () => {
  it('토큰이 없으면 401 이다 — 게이트웨이로 넘기지 않는다', () => {
    expect(submit(VALID, null)?.status).toBe(401)
    expect(job('아무거나', null)?.status).toBe(401)
  })

  it('남의 작업은 404 다 — 존재를 노출하지 않는다 (403 이 아니다)', () => {
    const jobId = newJob()
    const result = job(jobId, OTHER)

    expect(result?.status).toBe(404)
    expect((result?.payload as ApiResponse<null>).dataHeader.resultCode).toBe('AIPLAN_002')
  })

  it('없는 작업도 404 AIPLAN_002 다', () => {
    expect(job('없는-작업')?.status).toBe(404)
  })
})

describe('AI 일정 mock — 제출은 202 다', () => {
  it('접수되면 202 와 jobId 를 준다', () => {
    const result = submit()

    expect(result?.status).toBe(202)
    expect(submitted(result).jobId).not.toBe('')
    expect(submitted(result).submissionStatus.code).toBe('ACCEPTED')
  })

  it('멱등하다 — 같은 조건이 진행 중이면 같은 jobId 를 준다', () => {
    expect(newJob()).toBe(newJob())
  })

  it('조건이 다르면 다른 작업이다', () => {
    const first = newJob()
    const second = newJob({ ...VALID, endDate: '2026-11-04' })

    expect(second).not.toBe(first)
  })
})

describe('AI 일정 mock — 제출 검증 (백엔드와 같은 경계)', () => {
  it('areaCode 가 없으면 AIPLAN_101 이다', () => {
    const result = submit({ ...VALID, areaCode: '' })
    expect(result?.status).toBe(400)
    expect((result?.payload as ApiResponse<null>).dataHeader.resultCode).toBe('AIPLAN_100')
  })

  it('날짜 서식이 어긋나면 400 이다', () => {
    expect(submit({ ...VALID, startDate: '2026/11/01' })?.status).toBe(400)
  })

  it('날짜 역전은 필드 오류가 아니라 AIPLAN_001 이다', () => {
    const result = submit({ ...VALID, startDate: '2026-11-05' })

    expect(result?.status).toBe(400)
    expect((result?.payload as ApiResponse<null>).dataHeader.resultCode).toBe('AIPLAN_001')
  })

  it('budget 0 은 400 이다 — @Positive 라 일정 생성(@PositiveOrZero)과 다르다', () => {
    expect(submit({ ...VALID, budget: 0 })?.status).toBe(400)
  })

  it('budget 양수는 통과한다', () => {
    expect(submit({ ...VALID, budget: 300000 })?.status).toBe(202)
  })

  it('budget 을 생략하면 통과한다 — "상관없음" 의 표현이다', () => {
    const { petId, ...rest } = VALID
    expect(submit({ ...rest, petId })?.status).toBe(202)
  })

  it('petId 를 생략해도 통과한다 — @NotNull 이 없고 워커가 대표 반려견으로 대신한다', () => {
    const rest: Record<string, unknown> = { ...VALID }
    delete rest.petId
    expect(submit(rest)?.status).toBe(202)
  })

  it('petId 가 양수가 아니면 AIPLAN_105 다', () => {
    expect(submit({ ...VALID, petId: '0' })?.status).toBe(400)
  })

  it('requestNote 가 500자를 넘으면 400 이다', () => {
    expect(submit({ ...VALID, requestNote: '가'.repeat(501) })?.status).toBe(400)
  })
})

describe('POST /ai-plans — petIds (#128)', () => {
  const MULTI: Record<string, unknown> = {
    areaCode: '39',
    startDate: '2026-11-01',
    endDate: '2026-11-03',
    petIds: ['123456789012000001', '123456789012000002'],
  }

  it('petIds 로만 보내도 통과한다 — FE 는 한 마리여도 배열로 보낸다', () => {
    expect(submit(MULTI)?.status).toBe(202)
  })

  it('원소가 양수가 아니면 AIPLAN_105 다', () => {
    expect(submit({ ...MULTI, petIds: ['0'] })?.status).toBe(400)
  })

  it('5마리를 넘으면 400 이다 — @Size(max = 5)', () => {
    expect(submit({ ...MULTI, petIds: ['1', '2', '3', '4', '5', '6'] })?.status).toBe(400)
  })

  /*
    서버 `effectivePetIds()` 의 우선순위다. mock 이 이것을 지키지 않으면 FE 가
    두 경로를 남겨도 로컬에서 통과해 버린다.
  */
  it('petIds 가 petId 를 이긴다 — 조건이 달라지면 다른 jobId 다', () => {
    const one = submitted(submit({ ...MULTI, petId: '999999999999999999' }))
    const two = submitted(submit({ ...MULTI, petIds: ['123456789012000001'] }))

    expect(one.jobId).not.toBe(two.jobId)
  })

  it('같은 반려견 조합이 진행 중이면 같은 jobId 다 — 멱등하다', () => {
    const first = submitted(submit(MULTI))
    const second = submitted(submit(MULTI))

    expect(second.jobId).toBe(first.jobId)
  })
})

describe('AI 일정 mock — 상태 전이', () => {
  it('첫 조회는 PENDING 이고 초안이 없다', () => {
    const first = pollTimes(newJob(), 1)

    expect(first.status.code).toBe('PENDING')
    expect(first.planDraft).toBeNull()
  })

  it('두 번째 조회는 RUNNING 이다', () => {
    expect(pollTimes(newJob(), 2).status.code).toBe('RUNNING')
  })

  it('세 번째 조회에서 COMPLETED 가 되고 초안이 온다', () => {
    const done = pollTimes(newJob(), 3)

    expect(done.status.code).toBe('COMPLETED')
    expect(done.planDraft?.days.length).toBe(3)
    expect(done.planDraft?.reasons.length).toBeGreaterThan(0)
  })

  it('완료에 닿으면 그 상태에 머문다 — 새로고침해도 같은 결과다', () => {
    const jobId = newJob()
    pollTimes(jobId, 3)

    expect(status(job(jobId)).status.code).toBe('COMPLETED')
  })

  it('status 는 metadata 객체다 — 화면이 name/description 을 그대로 쓴다', () => {
    const running = pollTimes(newJob(), 2)

    expect(running.status.name).not.toBe('')
    expect(running.status.description).not.toBeNull()
  })
})

describe('AI 일정 mock — 실패는 HTTP 200 이다', () => {
  it('실패 시나리오는 200 + status=FAILED + errorCode 다', () => {
    const failed = pollTimes(newJob({ ...VALID, requestNote: '실패 시나리오' }), 3)

    expect(failed.status.code).toBe('FAILED')
    expect(failed.errorCode).toBe('AIPLAN_012')
    expect(failed.errorMessage).not.toBeNull()
    expect(failed.planDraft).toBeNull()
  })
})

describe('AI 일정 mock — 일수가 부족한 완료 (명세 S6)', () => {
  it('COMPLETED 인데 days 가 여행 일수보다 적을 수 있다', () => {
    const partial = pollTimes(newJob({ ...VALID, requestNote: '일부만' }), 3)

    expect(partial.status.code).toBe('COMPLETED')
    // 2026-11-01 ~ 11-03 = 3일인데 2일만 만든다
    expect(partial.planDraft?.days.length).toBe(2)
  })
})

describe('AI 일정 mock — 초안 항목', () => {
  it('WALK 항목에도 placeId 가 실려 온다 — FE 가 targetId 를 빼는지 확인해야 한다', () => {
    const done = pollTimes(newJob(), 3)
    const walk = done.planDraft?.days[0]?.items.find((item) => item.itemType === 'WALK')

    expect(walk?.placeId).not.toBeNull()
  })

  it('MOVE 항목은 placeId 가 null 이다', () => {
    const done = pollTimes(newJob(), 3)
    const move = done.planDraft?.days[0]?.items.find((item) => item.itemType === 'MOVE')

    expect(move?.placeId).toBeNull()
  })

  it('보강 대상 placeId 는 장소 mock 이 실제로 아는 값이다', () => {
    const done = pollTimes(newJob(), 3)
    const placeId = done.planDraft?.days[0]?.items[0]?.placeId

    expect(resolveMock(`/places/${placeId}`, 'GET', '', null, TOKEN)?.status).toBe(200)
  })

  it('itemType 은 metadata 가 아니라 문자열이다', () => {
    const done = pollTimes(newJob(), 3)

    expect(typeof done.planDraft?.days[0]?.items[0]?.itemType).toBe('string')
  })
})

describe('AI 일정 mock — 사라진 장소 시나리오 (PLAN_004 복구 경로)', () => {
  it('첫 항목이 장소 mock 이 모르는 id 라 404 를 낸다', () => {
    const done = pollTimes(newJob({ ...VALID, requestNote: '사라진 장소 확인' }), 3)
    const placeId = done.planDraft?.days[0]?.items[0]?.placeId

    expect(placeId).not.toBeNull()
    expect(resolveMock(`/places/${placeId}`, 'GET', '', null, TOKEN)?.status).toBe(404)
  })

  it('나머지 항목은 정상 장소다 — 하나만 빼면 담을 수 있어야 한다', () => {
    const done = pollTimes(newJob({ ...VALID, requestNote: '사라진 장소 확인' }), 3)
    const second = done.planDraft?.days[0]?.items[1]?.placeId

    expect(resolveMock(`/places/${second}`, 'GET', '', null, TOKEN)?.status).toBe(200)
  })
})

describe('AI 일정 mock — 초안의 nullable 필드', () => {
  it('note 가 null 인 항목을 포함한다 — DTO 에 제약이 없어 실제로 올 수 있다', () => {
    const done = pollTimes(newJob(), 3)
    const notes = done.planDraft?.days[0]?.items.map((item) => item.note)

    expect(notes).toContain(null)
  })
})

describe('준비물 mock — POST /ai-plans/packing-list/{planId} (#155)', () => {
  function packing(planId: string, token: string | null = TOKEN) {
    return resolveMock(`/ai-plans/packing-list/${planId}`, 'POST', '', null, token)
  }

  it('토큰이 없으면 401 이다', () => {
    expect(packing('223456789012000001', null)?.status).toBe(401)
  })

  it('분류와 이유를 갖춘 목록을 준다', () => {
    const body = packing('223456789012000001')?.payload.dataBody as {
      items: { category: string; name: string; reason: string }[]
      totalCount: number
    }

    expect(body.totalCount).toBe(body.items.length)
    expect(body.items.every((item) => item.reason !== '')).toBe(true)
    expect(body.items.map((item) => item.category)).toContain('날씨 대비')
  })

  /*
    일정이 없을 때와 남의 일정일 때가 **같은 코드**다. 남의 일정을 가리켜도 "없다" 고
    답하는 쪽이라 mock 도 두 경우를 구분하지 않는다.
  */
  it('없는 일정과 남의 일정이 모두 AIPLAN_016 이다', () => {
    expect(JSON.stringify(packing('999999999999999999')?.payload)).toContain('AIPLAN_016')
    // 223456789012000099 는 다른 회원의 일정이다 (store.ts fixture)
    expect(JSON.stringify(packing('223456789012000099')?.payload)).toContain('AIPLAN_016')
  })
})

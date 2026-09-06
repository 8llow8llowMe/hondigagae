import { beforeEach, describe, expect, it } from 'vitest'

import { resolveMock } from '@/lib/api/mock'
import { resetMockStore } from '@/lib/api/mock/store'
import type { AiPlanJob, AiPlanSubmitResult } from '@/types/ai-plan'
import type { ApiResponse } from '@/types/api'

/** 데모 계정(`900000000000000001`)의 토큰. `auth-data.ts` 가 이 형식을 발급한다 */
const TOKEN = 'mock-access-900000000000000001'
const OTHER = 'mock-access-900000000000000777'

/**
 * 오늘부터 `offset` 일 뒤 (`YYYY-MM-DD`).
 *
 * **고정 날짜를 쓸 수 없다.** mock 이 `START_DATE_IN_PAST`(`AIPLAN_017`)를 판정하면서
 * 시계를 보게 되었으므로(#128), 박아 둔 날짜는 그 날이 지나는 순간 이 파일의 제출
 * 대부분을 400 으로 만든다. mock 이 로컬 날짜로 읽으므로 같은 기준으로 만든다.
 */
function fromToday(offset: number): string {
  const now = new Date()
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
  const month = String(target.getMonth() + 1).padStart(2, '0')
  const day = String(target.getDate()).padStart(2, '0')

  return `${target.getFullYear()}-${month}-${day}`
}

const VALID = {
  areaCode: '39',
  startDate: fromToday(30),
  endDate: fromToday(32),
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
    const second = newJob({ ...VALID, endDate: fromToday(33) })

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
    const result = submit({ ...VALID, startDate: fromToday(40) })

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
    startDate: fromToday(30),
    endDate: fromToday(32),
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

describe('AI 일정 mock — sigunguCode (#251)', () => {
  it('시군구를 실어 보내면 접수된다', () => {
    expect(submit({ ...VALID, sigunguCode: '4' })?.status).toBe(202)
  })

  it('10자를 넘으면 400 이다 — @Size(max = 10) · AIPLAN_115', () => {
    const result = submit({ ...VALID, sigunguCode: '12345678901' })

    expect(result?.status).toBe(400)
    expect((result?.payload as ApiResponse<null>).dataHeader.resultCode).toBe('AIPLAN_100')
  })

  /** 백엔드가 빈 문자열을 null 로 접는다 — 그러지 않으면 "빈 시군구" 로 걸러져 후보가 0건이다 */
  it('빈 문자열은 제주 전체와 같다', () => {
    expect(newJob({ ...VALID, sigunguCode: '' })).toBe(newJob(VALID))
  })

  /*
    **멱등 키에 들어 있다.** 빼면 "제주 전체" 로 만들던 작업이 진행 중일 때 "제주시만"
    제출이 그 작업을 그대로 되받아, 좁힌 조건이 무시된 초안을 보게 된다.
  */
  it('좁힌 지역이 다르면 다른 작업이다', () => {
    expect(newJob({ ...VALID, sigunguCode: '4' })).not.toBe(newJob({ ...VALID, sigunguCode: '3' }))
    expect(newJob({ ...VALID, sigunguCode: '4' })).not.toBe(newJob(VALID))
  })

  it('좁히면 그 시군구 장소만 초안에 온다', () => {
    const done = pollTimes(newJob({ ...VALID, sigunguCode: '3' }), 3)
    const titles = (done.planDraft?.days ?? []).flatMap((day) =>
      day.items.map((item) => item.title ?? ''),
    )

    // 서귀포시 seed 는 `가세오름` 하나다 — 장소 항목은 전부 그것에서 나온다
    expect(titles.some((title) => title.includes('가세오름'))).toBe(true)
    expect(titles.some((title) => title.includes('동문재래시장'))).toBe(false)
  })

  /*
    **좁혀서 후보가 없으면 지역 전체로 넓히지 않는다.** 조건을 무시한 일정보다 실패가 낫다는
    백엔드 판단이고, **제출 400 이 아니라 작업 실패(HTTP 200 + FAILED)** 다 — 후보 수집은
    워커가 하기 때문이다.
  */
  it('좁혀서 후보가 없으면 AIPLAN_012 로 실패한다 — 전체로 넓히지 않는다', () => {
    const result = submit({ ...VALID, sigunguCode: '9' })
    expect(result?.status).toBe(202)

    const failed = pollTimes(submitted(result).jobId, 3)

    expect(failed.status.code).toBe('FAILED')
    expect(failed.errorCode).toBe('AIPLAN_012')
    expect(failed.planDraft).toBeNull()
  })
})

describe('AI 일정 mock — 세부 단계 (#250)', () => {
  it('PENDING 이면 step 이 null 이다 — 아직 시작하지 않았다', () => {
    const first = pollTimes(newJob(), 1)

    expect(first.step).toBeNull()
    expect(first.stepOrder).toBeNull()
  })

  it('RUNNING 이면 step metadata 와 1부터의 순서가 온다', () => {
    const running = pollTimes(newJob(), 2)

    expect(running.step?.code).toBe('CONDITIONS')
    expect(running.stepOrder).toBe(1)
  })

  /** 종결 상태에는 마지막으로 밟은 단계가 남는다 — 실패 지점을 아는 것이 진단이다 */
  it('완료돼도 마지막 단계가 남는다', () => {
    const done = pollTimes(newJob(), 3)

    expect(done.step?.code).toBe('DRAFTING')
    expect(done.stepOrder).toBe(done.totalSteps)
  })

  /*
    **총 단계 수는 값의 개수에서 나온다.** 손으로 적으면 단계를 더할 때 한쪽만 고쳐져
    `5 / 4 단계` 가 나간다 — 백엔드도 `values().length` 로 내린다.
  */
  it('totalSteps 는 언제나 실리고 stepOrder 를 넘지 않는다', () => {
    const running = pollTimes(newJob(), 2)

    expect(running.totalSteps).toBeGreaterThan(0)
    expect(running.stepOrder).toBeLessThanOrEqual(running.totalSteps)
  })
})

describe('AI 일정 mock — 작업 취소 (#250)', () => {
  function cancel(jobId: string, token: string | null = TOKEN) {
    return resolveMock(`/ai-plans/jobs/${jobId}/cancel`, 'POST', '', null, token)
  }

  it('진행 중인 작업을 취소하면 200 + status=CANCELED 다', () => {
    const jobId = newJob()

    const result = cancel(jobId)

    expect(result?.status).toBe(200)
    expect(status(result).status.code).toBe('CANCELED')
  })

  /*
    **취소는 실패가 아니다.** `errorCode` 를 채우면 화면이 "실패했습니다" 를 띄우고
    지표에서도 장애와 섞인다 — 백엔드가 일부러 비운 자리다.
  */
  it('취소 응답에는 errorCode 가 없다', () => {
    const canceled = status(cancel(newJob()))

    expect(canceled.errorCode).toBeNull()
    expect(canceled.errorMessage).toBeNull()
  })

  it('취소는 종결이다 — 다시 조회해도 CANCELED 에 머문다', () => {
    const jobId = newJob()
    cancel(jobId)

    expect(status(job(jobId)).status.code).toBe('CANCELED')
    // 조회 횟수가 늘어도 완료로 살아나지 않는다
    expect(pollTimes(jobId, 3).status.code).toBe('CANCELED')
  })

  it('이미 취소된 작업은 멱등 200 이다 — 두 번 눌러도 오류가 아니다', () => {
    const jobId = newJob()
    cancel(jobId)

    expect(cancel(jobId)?.status).toBe(200)
  })

  /*
    **완료·실패는 409 `AIPLAN_019` 다. 400 이 아니다** — 요청이 잘못된 것이 아니라 대상의
    상태가 지나간 것이고, 화면은 그때 결과를 보여 주면 된다.
  */
  it('완료된 작업 취소는 409 AIPLAN_019 다', () => {
    const jobId = newJob()
    pollTimes(jobId, 3)

    const result = cancel(jobId)

    expect(result?.status).toBe(409)
    expect((result?.payload as ApiResponse<null>).dataHeader.resultCode).toBe('AIPLAN_019')
  })

  it('실패한 작업 취소도 409 다', () => {
    const jobId = newJob({ ...VALID, requestNote: '실패 시나리오' })
    pollTimes(jobId, 3)

    expect(cancel(jobId)?.status).toBe(409)
  })

  it('타인의 작업은 404 다 — 존재를 노출하지 않는다', () => {
    expect(cancel(newJob(), OTHER)?.status).toBe(404)
  })

  it('토큰이 없으면 401 이다', () => {
    expect(cancel(newJob(), null)?.status).toBe(401)
  })

  /*
    **멱등 키를 함께 풀어 준다.** 취소 후 같은 조건 재제출이 취소의 주된 쓰임인데, 키가
    남아 있으면 취소된 잡을 그대로 돌려받아 화면이 "취소됨" 에서 벗어나지 못한다.
  */
  it('취소한 뒤 같은 조건으로 제출하면 새 작업이 나온다', () => {
    const first = newJob()
    cancel(first)

    expect(newJob()).not.toBe(first)
  })

  it('취소 시점의 단계가 남는다 — 대기 중 취소면 단계가 없다', () => {
    const canceled = status(cancel(newJob()))

    expect(canceled.step).toBeNull()
    expect(canceled.stepOrder).toBeNull()
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
    // VALID = fromToday(30) ~ fromToday(32) = 3일인데 2일만 만든다
    expect(partial.planDraft?.days.length).toBe(2)
  })
})

describe('AI 일정 mock — 초안 항목', () => {
  /*
    #89 · #252. ai-service 는 산책 코스 후보를 보지 않아 `walk_course.id` 를 알 수 없고,
    그래서 초안 스키마에서 `WALK` 를 뺐다. **BE 가 안 내리는 것을 mock 이 내리면** FE 가
    우회를 걷은 뒤 화면이 로컬에서만 다르게 돈다 — 산책은 `PLACE` 로 오고 성격은 title 에 담긴다.
  */
  it('초안에 WALK 는 오지 않는다 — 산책 항목도 placeId 를 실은 PLACE 다', () => {
    const done = pollTimes(newJob(), 3)
    const items = done.planDraft?.days.flatMap((day) => day.items) ?? []

    expect(items.some((item) => item.itemType === 'WALK')).toBe(false)

    const walkish = items.find((item) => (item.title ?? '').includes('산책'))
    expect(walkish?.itemType).toBe('PLACE')
    expect(walkish?.placeId).not.toBeNull()
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

describe('하루 재생성 (#128)', () => {
  const PLAN_ID = '223456789012000001'

  function base() {
    return {
      areaCode: '39',
      startDate: fromToday(8),
      endDate: fromToday(10),
      petIds: ['123456789012000001'],
    }
  }

  /*
    `AiPlanJobProcessor:187-197` — 둘 중 하나만 오면 `REGENERATE_REQUEST_INVALID`
    (`AIPLAN_014`)로 막는다. **평평한 바디다** — `AiPlanExceptionHandler` 가 도메인
    예외를 `Response.fail(errorCode.getCode(), message)` 로 응답하는 것이지 Bean
    Validation 배치(`AIPLAN_100`/`errors[]`)가 아니다. 날짜 역전(`AIPLAN_001`)과 같은
    형태이므로 `dataHeader.resultCode` 를 직접 확인한다.
  */
  it('planId 만 오면 400 이고 평평한 AIPLAN_014 다', () => {
    const result = submit({ ...base(), planId: PLAN_ID })
    expect(result?.status).toBe(400)
    expect((result?.payload as ApiResponse<null>).dataHeader.resultCode).toBe('AIPLAN_014')
  })

  it('regenerateDay 만 와도 400 이고 평평한 AIPLAN_014 다', () => {
    const result = submit({ ...base(), regenerateDay: 2 })
    expect(result?.status).toBe(400)
    expect((result?.payload as ApiResponse<null>).dataHeader.resultCode).toBe('AIPLAN_014')
  })

  /*
    `AiPlanCreateRequest.regenerateDay:65-67` 의 `@Positive` — 실제 상수는
    `AiPlanValidationMessage.REGENERATE_DAY_POSITIVE` = `AIPLAN_112`. 이건 Bean
    Validation 필드 오류라 `AIPLAN_015`(범위 초과)와 다른 코드이고, `errors[]` 배치를
    거친다.
  */
  it('regenerateDay 가 0 이면 400 이고 AIPLAN_112 다 (@Positive)', () => {
    const result = submit({ ...base(), planId: PLAN_ID, regenerateDay: 0 })
    expect(result?.status).toBe(400)
    expect(JSON.stringify(result?.payload)).toContain('AIPLAN_112')
  })

  it('일차가 기간을 넘으면 400 이고 평평한 AIPLAN_015 다', () => {
    const result = submit({ ...base(), planId: PLAN_ID, regenerateDay: 99 })
    expect(result?.status).toBe(400)
    expect((result?.payload as ApiResponse<null>).dataHeader.resultCode).toBe('AIPLAN_015')
  })

  it('짝으로 오면 접수한다', () => {
    expect(submit({ ...base(), planId: PLAN_ID, regenerateDay: 2 })?.status).toBe(202)
  })

  it('일차 범위 문구를 백엔드 그대로 쓴다 — 화면이 서버 문자열을 그린다', () => {
    const result = submit({ ...base(), planId: PLAN_ID, regenerateDay: 99 })

    expect(JSON.stringify(result?.payload)).toContain('재생성할 일차가 여행 기간을 벗어났습니다.')
  })

  /*
    **재생성이 조용히 물려받는 두 전제다.** `AiPlanJobProcessor:55-62` 가
    `validateRegenerateRequest` **앞에서** 본다 — 재생성 제출도 예외가 아니고, 제출 본문은
    저장된 일정의 기간을 그대로 싣는다. 그래서 **이미 시작한 여행과 11일 이상 일정은
    재생성이 영원히 막힌다** (`dayRegenerateBlock` 이 화면 쪽 짝이다).

    **날짜를 박아 두지 않는다** — 이 판정이 시계를 보므로 고정 날짜는 그 날이 지나면서
    뜻을 잃는다 (과거 판정만 예외다: 2020년은 앞으로도 과거다).
  */
  it('이미 시작한 여행은 400 이고 AIPLAN_017 이다', () => {
    const result = submit({ ...base(), startDate: '2020-01-01', endDate: '2020-01-03' })

    expect(result?.status).toBe(400)
    expect((result?.payload as ApiResponse<null>).dataHeader.resultCode).toBe('AIPLAN_017')
  })

  it('짝이 멀쩡한 재생성도 시작일이 과거면 AIPLAN_017 이다 — 재생성 검증보다 앞이다', () => {
    const result = submit({
      ...base(),
      startDate: '2020-01-01',
      endDate: '2020-01-03',
      planId: PLAN_ID,
      regenerateDay: 2,
    })

    expect(result?.status).toBe(400)
    expect((result?.payload as ApiResponse<null>).dataHeader.resultCode).toBe('AIPLAN_017')
  })

  it('10일은 통과하고 11일은 AIPLAN_018 이다 — plan-service 상한(30일)과 다르다', () => {
    const tenDays = {
      ...base(),
      startDate: fromToday(1),
      endDate: fromToday(10),
      planId: PLAN_ID,
      regenerateDay: 2,
    }
    expect(submit(tenDays)?.status).toBe(202)

    const elevenDays = submit({ ...tenDays, endDate: fromToday(11) })
    expect(elevenDays?.status).toBe(400)
    expect((elevenDays?.payload as ApiResponse<null>).dataHeader.resultCode).toBe('AIPLAN_018')
  })

  /*
    **멱등 술어가 재생성 대상을 봐야 한다.** 실제 멱등 키는 `toParams` 해시이고 그 map 에
    `planId`·`regenerateDay` 가 들어 있다 (`AiPlanJobProcessor:167-179`). 빠뜨리면 1일차
    재생성이 진행 중일 때 2일차 제출이 **그 작업의 jobId** 를 받아, 비교 화면이 2일차가
    그대로인 초안을 보여 준다 — 화면 결함으로 오진하기 쉬운 함정이다.
  */
  it('같은 날을 다시 제출하면 진행 중인 작업을 그대로 준다', () => {
    const first = newJob({ ...base(), planId: PLAN_ID, regenerateDay: 2 })
    const second = newJob({ ...base(), planId: PLAN_ID, regenerateDay: 2 })

    expect(second).toBe(first)
  })

  it('다른 일차 제출은 다른 작업이다 — 1일차가 진행 중이어도 그렇다', () => {
    const firstDay = newJob({ ...base(), planId: PLAN_ID, regenerateDay: 1 })
    const secondDay = newJob({ ...base(), planId: PLAN_ID, regenerateDay: 2 })

    expect(secondDay).not.toBe(firstDay)
  })

  it('같은 기간의 새 일정 생성이 진행 중이어도 재생성은 다른 작업이다', () => {
    const plain = newJob(base())
    const regenerated = newJob({ ...base(), planId: PLAN_ID, regenerateDay: 2 })

    expect(regenerated).not.toBe(plain)
  })

  /*
    이 작업이 존재하는 이유인 속성이다 (Interfaces 절, Task 7 브라우저 실렌더가 여기
    기댄다) — 코드 검사만으로는 증명되지 않으므로 실제로 완료까지 폴링해 초안을
    비교한다. 목표 일자(2일차)는 `regeneratedDayItems()` 의 고정 항목으로 바뀌고,
    나머지 일자는 같은 조건의 일반 제출과 **완전히 같아야** 한다.
  */
  it('완료된 초안에서 목표 일자만 다르고 나머지는 그대로다 (R4)', () => {
    // 두 제출은 `planId`·`regenerateDay` 가 달라 멱등 술어가 섞지 않는다 (위 테스트).
    const regenerated = pollTimes(newJob({ ...base(), planId: PLAN_ID, regenerateDay: 2 }), 3)
    const plain = pollTimes(newJob(base()), 3)

    const regeneratedDays = regenerated.planDraft?.days ?? []
    const plainDays = plain.planDraft?.days ?? []

    expect(regeneratedDays.length).toBe(3)
    expect(plainDays.length).toBe(3)

    const targetItems = regeneratedDays.find((day) => day.day === 2)?.items ?? []
    expect(targetItems).toHaveLength(2)
    expect(targetItems[0]).toMatchObject({ itemType: 'PLACE', title: '오설록 티뮤지엄 카페' })
    expect(targetItems[1]).toMatchObject({ itemType: 'PLACE', title: '사려니숲길 산책' })

    for (const plainDay of plainDays) {
      if (plainDay.day === 2) continue
      const regeneratedDay = regeneratedDays.find((day) => day.day === plainDay.day)
      expect(regeneratedDay?.items).toEqual(plainDay.items)
    }
  })
})

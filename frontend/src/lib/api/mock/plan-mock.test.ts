import { beforeEach, describe, expect, it } from 'vitest'

import { resolveMock } from '@/lib/api/mock'
import { resetMockStore } from '@/lib/api/mock/store'
import type { ApiResponse, SliceResponse } from '@/types/api'
import type { PlanDetail, PlanSummaryItem } from '@/types/plan'

/** 데모 계정(`900000000000000001`)의 토큰. `auth-data.ts` 가 이 형식을 발급한다 */
const TOKEN = 'mock-access-900000000000000001'
const OTHER = 'mock-access-900000000000000777'

function list(search: string, token: string | null = TOKEN) {
  return resolveMock('/plans', 'GET', search, null, token)
}

function create(body: Record<string, unknown>, token: string | null = TOKEN) {
  return resolveMock('/plans', 'POST', '', JSON.stringify(body), token)
}

function slice(result: ReturnType<typeof list>): SliceResponse<PlanSummaryItem> {
  return (result?.payload as ApiResponse<SliceResponse<PlanSummaryItem>>).dataBody!
}

const VALID = {
  petId: '123456789012000001',
  areaCode: '39',
  title: '새 일정',
  startDate: '2026-11-01',
  endDate: '2026-11-03',
}

beforeEach(resetMockStore)

describe('일정 mock — 인증과 소유권', () => {
  it('토큰이 없으면 401 이다 — 게이트웨이로 넘기지 않는다', () => {
    expect(list('', null)?.status).toBe(401)
    expect(create(VALID, null)?.status).toBe(401)
  })

  it('남의 일정은 목록에 섞이지 않는다', () => {
    const titles = slice(list('')).contents.map((plan) => plan.title)
    expect(titles).not.toContain('남의 일정')
  })

  it('남의 반려견으로는 만들 수 없다', () => {
    expect(create({ ...VALID, petId: '123456789012000099' })?.status).toBe(400)
  })

  it('다른 회원은 자기 일정만 본다', () => {
    const contents = slice(list('', OTHER)).contents
    expect(contents.map((plan) => plan.title)).toEqual(['남의 일정'])
  })
})

describe('일정 mock — 커서 목록', () => {
  it('id 내림차순이다 — 백엔드 OrderByIdDesc 와 같아야 한다', () => {
    const ids = slice(list('')).contents.map((plan) => plan.planId)
    expect(ids).toEqual([...ids].sort().reverse())
  })

  it('size 를 넘으면 hasNext 가 참이고 커서로 이어받는다', () => {
    const first = slice(list('?size=2'))
    expect(first.contents).toHaveLength(2)
    expect(first.hasNext).toBe(true)

    const cursor = first.contents.at(-1)!.planId
    const second = slice(list(`?size=2&lastPlanId=${cursor}`))

    expect(second.contents.map((plan) => plan.planId)).not.toContain(cursor)
    expect(second.hasNext).toBe(false)
  })

  it('size 범위 밖은 400 PLAN_113 이다', () => {
    expect(list('?size=0')?.status).toBe(400)
    expect(list('?size=51')?.status).toBe(400)
  })
})

describe('일정 mock — 생성', () => {
  it('만든 일정은 초안이고 목록 맨 앞에 온다', () => {
    const result = create(VALID)
    const detail = (result?.payload as ApiResponse<PlanDetail>).dataBody!

    expect(detail.status.code).toBe('DRAFT')
    expect(detail.totalDays).toBe(3)
    expect(slice(list('')).contents[0]?.planId).toBe(detail.planId)
  })

  it('petId 를 문자열로 보내도 받는다 — Snowflake 라 FE 가 숫자로 바꾸지 않는다', () => {
    expect(create({ ...VALID, petId: '123456789012000001' })?.status).toBe(200)
  })

  it('제목이 60자를 넘으면 PLAN_104 다', () => {
    const result = create({ ...VALID, title: 'ㄱ'.repeat(61) })
    const raw = (result?.payload.dataHeader.resultMessage ?? {}) as {
      errors?: { code: string }[]
    }
    expect(result?.status).toBe(400)
    expect(raw.errors?.[0]?.code).toBe('PLAN_104')
  })

  it('음수 예산은 PLAN_107 이다', () => {
    const result = create({ ...VALID, budget: -1 })
    expect(result?.status).toBe(400)
  })

  it('예산을 생략해도 만들어진다 — 선택 입력이다', () => {
    expect(create(VALID)?.status).toBe(200)
  })

  it('날짜 역전은 필드 오류가 아니라 PLAN_003 도메인 예외다', () => {
    const result = create({ ...VALID, startDate: '2026-11-03', endDate: '2026-11-01' })

    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.resultCode).toBe('PLAN_003')
  })
})

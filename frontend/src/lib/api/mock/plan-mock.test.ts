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

  /*
    **plan-service 는 petId 소유권을 검사하지 않는다.** `createPlan` 이 값을 그대로 저장하고,
    auth-service 는 나중에 날씨 판정의 특성 조회에서만 소유권을 본다 — 남의 아이디를 넣으면
    특성이 빠질 뿐 일정은 만들어진다. 예전 mock 은 여기서 400 을 냈는데, 프로덕션에 없는
    오류 분기를 FE 가 만들게 하는 거짓이었다 (#152 계약 대조).
  */
  it('남의 반려견이어도 서버가 막지 않는다 — 소유권 검사가 없다', () => {
    expect(create({ ...VALID, petId: '123456789012000099' })?.status).toBe(200)
  })

  it('다른 회원은 자기 일정만 본다', () => {
    const contents = slice(list('', OTHER)).contents
    expect(contents.map((plan) => plan.title)).toEqual(['남의 일정'])
  })
})

describe('일정 mock — 동행 반려견 (#152)', () => {
  function detailOf(result: ReturnType<typeof create>): PlanDetail {
    return (result?.payload as ApiResponse<PlanDetail>).dataBody!
  }

  it('petIds 가 petId 를 이기고, 첫 번째가 대표가 된다', () => {
    const detail = detailOf(
      create({
        ...VALID,
        petId: '123456789012000001',
        petIds: ['123456789012000002', '123456789012000001'],
      }),
    )

    expect(detail.petIds).toEqual(['123456789012000002', '123456789012000001'])
    expect(detail.petId).toBe('123456789012000002')
  })

  it('중복은 순서를 지켜 한 마리로 접는다', () => {
    const detail = detailOf(
      create({ ...VALID, petIds: ['123456789012000002', '123456789012000002'] }),
    )

    expect(detail.petIds).toEqual(['123456789012000002'])
  })

  it('한 마리 일정도 petIds 가 원소 하나로 온다 — 빈 배열이 아니다', () => {
    expect(detailOf(create(VALID)).petIds).toEqual(['123456789012000001'])
  })

  it('반려견을 지정하지 않으면 대표 반려견으로 대신한다', () => {
    const detail = detailOf(create({ ...VALID, petId: undefined }))

    // 데모 계정의 대표는 몽실이(...001) 다 — `store.ts` fixture
    expect(detail.petIds).toEqual(['123456789012000001'])
  })

  it('여섯 마리는 PLAN_115 다', () => {
    const result = create({ ...VALID, petIds: ['1', '2', '3', '4', '5', '6'] })

    expect(result?.status).toBe(400)
    expect(JSON.stringify(result?.payload)).toContain('PLAN_115')
  })

  it('양수가 아닌 아이디는 PLAN_101 이다 — 필수가 아니라 양수 제약이다', () => {
    const result = create({ ...VALID, petId: '0' })

    expect(result?.status).toBe(400)
    expect(JSON.stringify(result?.payload)).toContain('PLAN_101')
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
    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.fieldErrors?.[0]?.code).toBe('PLAN_104')
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

describe('일정 mock — items 를 함께 받는다 (AI 초안 담기, 이슈 #84)', () => {
  function detail(result: ReturnType<typeof create>): PlanDetail {
    return (result?.payload as ApiResponse<PlanDetail>).dataBody!
  }

  const ITEM = {
    day: 1,
    sequence: 0,
    itemType: 'PLACE',
    targetId: '212481712381923328',
    title: '협재해수욕장',
    memo: '오전이라 노면이 덜 뜨거워요.',
  }

  it('items 를 생략하면 빈 배열이다 — 직접 만들기 경로다', () => {
    expect(detail(create(VALID)).items).toEqual([])
  })

  it('보낸 항목을 되돌려 준다 — 버리면 담은 직후 빈 일정이 보인다', () => {
    const items = detail(create({ ...VALID, items: [ITEM] })).items

    expect(items).toHaveLength(1)
    expect(items[0]?.title).toBe('협재해수욕장')
    expect(items[0]?.memo).toBe('오전이라 노면이 덜 뜨거워요.')
  })

  it('응답의 itemType 은 metadata 객체다 — 요청은 enum 값 문자열이었다', () => {
    const items = detail(create({ ...VALID, items: [ITEM] })).items

    expect(items[0]?.itemType.code).toBe('PLACE')
    expect(items[0]?.itemType.name).toBe('장소')
  })

  it('targetId 를 문자열로 보존한다 — Snowflake 정밀도', () => {
    const items = detail(create({ ...VALID, items: [ITEM] })).items
    expect(items[0]?.targetId).toBe('212481712381923328')
  })

  it('planItemId 를 새로 발급한다 — 요청에는 없는 값이다', () => {
    const items = detail(create({ ...VALID, items: [ITEM] })).items
    expect(items[0]?.planItemId).toMatch(/^\d+$/)
  })

  it('targetId 가 없는 항목(이동)도 받는다', () => {
    const items = detail(
      create({ ...VALID, items: [{ ...ITEM, itemType: 'MOVE', targetId: undefined }] }),
    ).items

    expect(items[0]?.targetId).toBeNull()
  })

  it('PlanItemType 에 없는 itemType 은 400 이다 — 하나가 어긋나면 요청 전체가 막힌다', () => {
    expect(create({ ...VALID, items: [{ ...ITEM, itemType: 'CAFE' }] })?.status).toBe(400)
  })

  it('항목 이름이 비면 400 이다 (@NotBlank)', () => {
    expect(create({ ...VALID, items: [{ ...ITEM, title: '   ' }] })?.status).toBe(400)
  })

  it('항목 이름이 100자를 넘으면 400 이다', () => {
    expect(create({ ...VALID, items: [{ ...ITEM, title: '가'.repeat(101) }] })?.status).toBe(400)
  })

  it('메모가 500자를 넘으면 400 이다', () => {
    expect(create({ ...VALID, items: [{ ...ITEM, memo: '나'.repeat(501) }] })?.status).toBe(400)
  })

  it('일차가 1 미만이면 400 이다 (@Min(1))', () => {
    expect(create({ ...VALID, items: [{ ...ITEM, day: 0 }] })?.status).toBe(400)
  })

  it('여러 일자의 항목을 순서대로 저장한다', () => {
    const items = detail(
      create({
        ...VALID,
        items: [
          { ...ITEM, day: 1, sequence: 0, title: '가' },
          { ...ITEM, day: 1, sequence: 1, title: '나' },
          { ...ITEM, day: 2, sequence: 0, title: '다' },
        ],
      }),
    ).items

    expect(items.map((item) => [item.day, item.sequence, item.title])).toEqual([
      [1, 0, '가'],
      [1, 1, '나'],
      [2, 0, '다'],
    ])
  })
})

describe('일정 mock — 도메인 검증도 백엔드와 같이 돈다', () => {
  const ITEM = {
    day: 1,
    sequence: 0,
    itemType: 'PLACE',
    targetId: '212481712381923328',
    title: '협재해수욕장',
  }

  function code(result: ReturnType<typeof create>): unknown {
    return (result?.payload as ApiResponse<null>).dataHeader.resultCode
  }

  it('일차가 여행 기간을 넘으면 PLAN_002 다 — validateItemDays', () => {
    // 2026-11-01 ~ 11-03 = 3일
    const result = create({ ...VALID, items: [{ ...ITEM, day: 4 }] })

    expect(result?.status).toBe(400)
    expect(code(result)).toBe('PLAN_002')
  })

  it('경계값(day === totalDays)은 통과한다', () => {
    expect(create({ ...VALID, items: [{ ...ITEM, day: 3 }] })?.status).toBe(200)
  })

  it('모르는 장소를 targetId 로 보내면 PLAN_004 다 — verifyPlaceTargets', () => {
    const result = create({ ...VALID, items: [{ ...ITEM, targetId: '999999999999999999' }] })

    expect(result?.status).toBe(400)
    expect(code(result)).toBe('PLAN_004')
  })

  it('WALK 은 장소 검증 대상이 아니다 — targetId 가 walk_course.id 다', () => {
    const result = create({
      ...VALID,
      items: [{ ...ITEM, itemType: 'WALK', targetId: '999999999999999999' }],
    })

    expect(result?.status).toBe(200)
  })

  it('targetId 가 없는 항목은 장소 검증을 건너뛴다', () => {
    const result = create({
      ...VALID,
      items: [{ ...ITEM, itemType: 'MOVE', targetId: undefined, title: '이동' }],
    })

    expect(result?.status).toBe(200)
  })

  it('Bean Validation 이 도메인 검증보다 먼저 돈다 — 둘 다 어긋나면 PLAN_100 이다', () => {
    const result = create({ ...VALID, items: [{ ...ITEM, day: 4, itemType: 'CAFE' }] })

    expect(code(result)).toBe('PLAN_100')
  })
})

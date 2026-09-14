import { beforeEach, describe, expect, it } from 'vitest'

import { resolveMock } from '@/lib/api/mock'
import { resetMockStore } from '@/lib/api/mock/store'
import type { PlanPackingListResponse } from '@/types/plan'

/**
 * 여행 준비물 저장 mock (#586).
 *
 * **mock 이 백엔드보다 느슨하거나 엄격해서는 안 된다** (`plan-data.ts` 머리주석).
 * 여기서 잠그는 것은 화면이 실제로 갈리는 규칙들이다 — `generatedAt` 의 두 갈래,
 * `PUT` 이 사용자 항목을 남기고 체크를 승계하는 것, `PLAN_012`/`PLAN_013`.
 */

const TOKEN = 'mock-access-900000000000000001'
const PLAN = '223456789012000001'
const OTHERS = '223456789012000099'

function call(path: string, method: string, body: unknown = null, token: string | null = TOKEN) {
  return resolveMock(path, method, '', body === null ? null : JSON.stringify(body), token)
}

function items(planId = PLAN): PlanPackingListResponse {
  return call(`/plans/${planId}/packing-items`, 'GET')?.payload.dataBody as PlanPackingListResponse
}

const AI_ITEMS = [
  { category: '필수', name: '리드줄', reason: '야외 장소가 포함돼 있습니다.' },
  { category: '날씨 대비', name: '우비', reason: '2일차 강수확률 80% 예보입니다.' },
]

function saveAi(body: unknown = { items: AI_ITEMS }) {
  return call(`/plans/${PLAN}/packing-items`, 'PUT', body)
}

describe('준비물 mock — 조회', () => {
  beforeEach(resetMockStore)

  it('저장된 것이 없으면 빈 목록이고 generatedAt 이 null 이다 — 생성을 권하는 갈래다', () => {
    const list = items()

    expect(list.items).toEqual([])
    expect(list.generatedAt).toBeNull()
    expect(list.totalCount).toBe(0)
    expect(list.checkedCount).toBe(0)
  })

  it('남의 일정은 404 다 — 존재 여부를 흘리지 않는다', () => {
    expect(call(`/plans/${OTHERS}/packing-items`, 'GET')?.status).toBe(404)
  })

  it('토큰이 없으면 401 이다', () => {
    expect(call(`/plans/${PLAN}/packing-items`, 'GET', null, null)?.status).toBe(401)
  })
})

describe('준비물 mock — AI 결과 저장 (PUT)', () => {
  beforeEach(resetMockStore)

  it('저장하면 목록이 돌아오고 generatedAt 이 채워진다', () => {
    const saved = saveAi()?.payload.dataBody as PlanPackingListResponse

    expect(saved.items.map((item) => item.name)).toEqual(['리드줄', '우비'])
    expect(saved.generatedAt).not.toBeNull()
    expect(saved.items[0]?.source.code).toBe('AI')
  })

  it('표시 순서(sortOrder)가 0부터 붙는다', () => {
    const saved = saveAi()?.payload.dataBody as PlanPackingListResponse

    expect(saved.items.map((item) => item.sortOrder)).toEqual([0, 1])
  })

  /** **재생성이 직접 적어 둔 것을 말없이 지우지 않는다** — 이것이 서버 규칙의 핵심이다 */
  it('사용자 항목은 남는다', () => {
    call(`/plans/${PLAN}/packing-items`, 'POST', { category: '필수', name: '배변봉투' })
    saveAi()

    const names = items().items.map((item) => item.name)
    expect(names).toContain('배변봉투')
    expect(names).toContain('리드줄')
  })

  /** 짐을 반쯤 싸 두고 `다시 만들기` 를 눌러도 체크가 날아가지 않는다 */
  it('같은 이름의 챙김 체크를 승계한다', () => {
    saveAi()
    const leash = items().items.find((item) => item.name === '리드줄')
    call(`/plans/${PLAN}/packing-items/${leash?.packingItemId}/checked`, 'PUT', { checked: true })

    saveAi()

    expect(items().items.find((item) => item.name === '리드줄')?.checked).toBe(true)
  })

  it('사용자 항목과 이름이 겹치는 AI 항목은 버려진다 — 같은 이름이 두 줄로 서지 않는다', () => {
    call(`/plans/${PLAN}/packing-items`, 'POST', { category: '필수', name: '리드줄' })
    saveAi()

    expect(items().items.filter((item) => item.name === '리드줄')).toHaveLength(1)
  })

  it('보낸 목록 안의 중복은 첫 것만 남는다', () => {
    saveAi({
      items: [
        { category: '필수', name: '리드줄', reason: '첫 번째' },
        { category: '이동', name: '리드줄', reason: '두 번째' },
      ],
    })

    const saved = items().items.filter((item) => item.name === '리드줄')
    expect(saved).toHaveLength(1)
    expect(saved[0]?.reason).toBe('첫 번째')
  })

  /*
    전부 지운 뒤의 조회는 **빈 목록 + generatedAt null 이 아니다** — 화면이 그 둘을
    가르지 못하면 상세를 열 때마다 지운 것을 되살린다. mock 도 같은 값을 내야 한다.
  */
  it('AI 항목을 전부 지우면 generatedAt 이 다시 null 이 된다', () => {
    saveAi()
    for (const item of items().items) {
      call(`/plans/${PLAN}/packing-items/${item.packingItemId}`, 'DELETE')
    }

    expect(items().generatedAt).toBeNull()
  })
})

describe('준비물 mock — 직접 추가 (POST)', () => {
  beforeEach(resetMockStore)

  it('source 가 USER 이고 이유는 null 이다 — 서버가 reason 을 받지 않는다', () => {
    const added = call(`/plans/${PLAN}/packing-items`, 'POST', {
      category: '필수',
      name: '배변봉투',
      reason: '무시돼야 한다',
    })?.payload.dataBody as PlanPackingListResponse

    expect(added.items[0]?.source.code).toBe('USER')
    expect(added.items[0]?.reason).toBeNull()
  })

  it('중복 이름은 409 PLAN_012 다', () => {
    call(`/plans/${PLAN}/packing-items`, 'POST', { category: '필수', name: '배변봉투' })
    const again = call(`/plans/${PLAN}/packing-items`, 'POST', {
      category: '이동',
      name: ' 배변봉투 ',
    })

    expect(again?.status).toBe(409)
    expect(again?.payload.dataHeader.resultCode).toBe('PLAN_012')
  })

  it('50개를 넘기면 400 PLAN_013 이다', () => {
    for (let i = 0; i < 50; i += 1) {
      call(`/plans/${PLAN}/packing-items`, 'POST', { category: '필수', name: `물건 ${i}` })
    }
    const over = call(`/plans/${PLAN}/packing-items`, 'POST', { category: '필수', name: '하나 더' })

    expect(over?.status).toBe(400)
    expect(over?.payload.dataHeader.resultCode).toBe('PLAN_013')
  })

  it('분류·이름이 비면 필드 오류로 돌아온다', () => {
    const result = call(`/plans/${PLAN}/packing-items`, 'POST', { category: ' ', name: '' })

    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.fieldErrors?.map((error) => error.field)).toEqual([
      'category',
      'name',
    ])
  })
})

describe('준비물 mock — 삭제 · 챙김 체크', () => {
  beforeEach(resetMockStore)

  it('없는 항목은 404 PLAN_014 다', () => {
    const result = call(`/plans/${PLAN}/packing-items/423456789012999999`, 'DELETE')

    expect(result?.status).toBe(404)
    expect(result?.payload.dataHeader.resultCode).toBe('PLAN_014')
  })

  /** 응답이 `Response<Void>` 라 화면이 캐시를 직접 손본다 — 그 계약을 잠근다 */
  it('체크 응답은 목록이 아니라 Void 다', () => {
    saveAi()
    const target = items().items[0]
    const result = call(`/plans/${PLAN}/packing-items/${target?.packingItemId}/checked`, 'PUT', {
      checked: true,
    })

    expect(result?.status).toBe(200)
    expect(result?.payload.dataBody).toBeNull()
    expect(items().checkedCount).toBe(1)
  })

  it('해제도 같은 경로다 — checked 가 방향을 정한다', () => {
    saveAi()
    const target = items().items[0]
    const path = `/plans/${PLAN}/packing-items/${target?.packingItemId}/checked`
    call(path, 'PUT', { checked: true })
    call(path, 'PUT', { checked: false })

    expect(items().checkedCount).toBe(0)
  })
})

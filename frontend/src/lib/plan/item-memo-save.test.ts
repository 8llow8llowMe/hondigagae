import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api/error'
import { messages } from '@/lib/messages'
import { type ItemMemoSaveDeps, runItemMemoSave } from '@/lib/plan/item-memo-save'
import { planDetail, planItem } from '@/test/fixtures/plan'
import type { PlanDayItemsReplacePayload, PlanDetail, PlanItemDetail } from '@/types/plan'

/**
 * 메모 저장 흐름 — 이슈 #1460 리뷰 · `일정상세-세부명세.md` D30-3.
 *
 * 훅(`use-plan-item-memo.ts`)은 node 환경에서 돌지 않아 흐름을 `runItemMemoSave` 로 뺐다.
 * 전송 · 캐시는 가짜로 꽂고 **부른 순서와 대상**을 기록해 단언한다.
 */
const DAY_ITEMS: PlanItemDetail[] = [
  planItem({ planItemId: 'a', day: 1, sequence: 0, title: '미술관', memo: '실내', visited: true }),
  planItem({
    planItemId: 'b',
    day: 1,
    sequence: 1,
    title: '시장',
    targetId: '212481712381923334',
    memo: '줄이 길어요',
  }),
]

/** 교체 응답 — 그 일자가 새 id 로 다시 만들어지고 다녀옴이 풀린다. 다른 일자 항목도 섞여 온다 */
function replacedDetail(items: PlanItemDetail[] = DAY_ITEMS): PlanDetail {
  return {
    ...planDetail,
    items: [
      planItem({ planItemId: 'other', day: 2, sequence: 0, visited: true }),
      ...[...items].reverse().map((item) => ({
        ...item,
        planItemId: `new-${item.planItemId}`,
        visited: false,
      })),
    ],
  }
}

function fakeDeps(
  overrides: Partial<{
    replace: ItemMemoSaveDeps['replace']
    markVisited: ItemMemoSaveDeps['markVisited']
  }> = {},
) {
  const calls: string[] = []
  const payloads: PlanDayItemsReplacePayload[] = []
  const deps: ItemMemoSaveDeps = {
    replace: (payload) => {
      calls.push('replace')
      payloads.push(payload)
      return overrides.replace === undefined
        ? Promise.resolve(replacedDetail())
        : overrides.replace(payload)
    },
    markVisited: (id) => {
      calls.push(`visit:${id}`)
      return overrides.markVisited === undefined ? Promise.resolve() : overrides.markVisited(id)
    },
    onReplaced: () => {
      calls.push('replaced')
    },
    refetchDetail: () => {
      calls.push('refetch')
      return Promise.resolve()
    },
  }
  return { deps, calls, payloads }
}

const INPUT = { day: 1, dayItems: DAY_ITEMS, planItemId: 'b', memo: '오픈런 추천' }

describe('runItemMemoSave', () => {
  it('교체 → 갈아끼우기 → 응답의 새 id 로 되살리기 → 재조회 순서다', async () => {
    const { deps, calls } = fakeDeps()

    const result = await runItemMemoSave(INPUT, deps)

    expect(calls).toEqual(['replace', 'replaced', 'visit:new-a', 'refetch'])
    expect(result).toEqual({
      kind: 'saved',
      toast: messages.plan.itemMemoSavedToast.replace('{title}', '시장'),
      restored: ['new-a'],
      restoreFailed: false,
    })
  })

  it('다른 일자의 다녀옴 항목은 되살리기 대상이 아니다 — 응답에 섞여 와도', async () => {
    const { deps, calls } = fakeDeps()

    await runItemMemoSave(INPUT, deps)

    expect(calls).not.toContain('visit:other')
  })

  it('본문은 고른 항목의 메모만 바꾼다', async () => {
    const { deps, payloads } = fakeDeps()

    await runItemMemoSave(INPUT, deps)

    expect(payloads[0]?.items.map((item) => item.memo)).toEqual(['실내', '오픈런 추천'])
  })

  it('되살릴 것이 없으면 다녀옴 요청도 재조회도 하지 않는다', async () => {
    const unvisited = DAY_ITEMS.map((item) => ({ ...item, visited: false }))
    const { deps, calls } = fakeDeps()

    await runItemMemoSave({ ...INPUT, dayItems: unvisited }, deps)

    expect(calls).toEqual(['replace', 'replaced'])
  })

  it('되살리기가 일부 실패해도 저장됨이다 — 안내 토스트로 말한다', async () => {
    const twoVisited = DAY_ITEMS.map((item) => ({ ...item, visited: true }))
    const { deps, calls } = fakeDeps({
      replace: () => Promise.resolve(replacedDetail(twoVisited)),
      markVisited: (id) =>
        id === 'new-a'
          ? Promise.reject(new ApiError(500, 'COMMON_500', '서버 오류'))
          : Promise.resolve(),
    })

    const result = await runItemMemoSave({ ...INPUT, dayItems: twoVisited }, deps)

    // 하나가 실패해도 나머지는 보낸다
    expect(calls).toEqual(['replace', 'replaced', 'visit:new-a', 'visit:new-b', 'refetch'])
    expect(result).toMatchObject({
      kind: 'saved',
      toast: messages.plan.itemMemoVisitRestoreFailedToast,
      restoreFailed: true,
    })
  })

  it('지우기면 지웠다고 말한다', async () => {
    const { deps } = fakeDeps()

    const result = await runItemMemoSave({ ...INPUT, memo: null }, deps)

    expect(result).toMatchObject({
      kind: 'saved',
      toast: messages.plan.itemMemoClearedToast.replace('{title}', '시장'),
    })
  })

  it('교체가 5xx 면 재시도 문구로 실패한다 — 후처리는 하지 않는다', async () => {
    const { deps, calls } = fakeDeps({
      replace: () => Promise.reject(new ApiError(503, 'COMMON_503', '일시 장애')),
    })

    const result = await runItemMemoSave(INPUT, deps)

    expect(result).toEqual({
      kind: 'failed',
      error: { message: messages.plan.itemMemoErrorDescription, retriable: true },
    })
    expect(calls).toEqual(['replace'])
  })

  it('PLAN_004 는 그 일자의 사라진 장소를 말한다', async () => {
    const { deps } = fakeDeps({
      replace: () => Promise.reject(new ApiError(400, 'PLAN_004', '장소를 찾을 수 없습니다.')),
    })

    const result = await runItemMemoSave(INPUT, deps)

    expect(result).toEqual({
      kind: 'failed',
      error: { message: messages.plan.itemMemoMissingPlaceError, retriable: false },
    })
  })

  it('들고 있는 상세에 그 항목이 없으면 보내지 않고 stale 이다', async () => {
    const { deps, calls } = fakeDeps()

    const result = await runItemMemoSave({ ...INPUT, planItemId: 'gone' }, deps)

    expect(result).toEqual({
      kind: 'stale',
      error: { message: messages.plan.saveStaleError, retriable: false },
    })
    expect(calls).toEqual([])
  })

  it('갈아끼우기에서 던져도 저장 실패가 아니다', async () => {
    const { deps } = fakeDeps()

    const result = await runItemMemoSave(INPUT, {
      ...deps,
      onReplaced: () => {
        throw new Error('cache')
      },
    })

    expect(result.kind).toBe('saved')
  })

  it('되살리기 · 재조회가 끝난 뒤에야 끝난다 — 호출부는 그때 모달을 닫는다(onSaved)', async () => {
    let refetchDone = false
    const { deps } = fakeDeps()

    await runItemMemoSave(INPUT, {
      ...deps,
      refetchDetail: async () => {
        await Promise.resolve()
        refetchDone = true
      },
    })

    expect(refetchDone).toBe(true)
  })
})

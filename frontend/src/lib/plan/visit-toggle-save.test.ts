import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api/error'
import { runItemMemoSave } from '@/lib/plan/item-memo-save'
import { dayVisitPending, runVisitToggle } from '@/lib/plan/visit-toggle-save'
import { planDetail, planItem } from '@/test/fixtures/plan'
import type { PlanDetail, PlanItemDetail } from '@/types/plan'

/**
 * `다녀옴` 토글 한 번의 흐름 — 이슈 #1489 · `일정상세-세부명세.md` D30-2.
 *
 * 훅(`use-plan-visit.ts`)은 node 환경에서 돌지 않아 흐름을 `runVisitToggle` 로 뺐다. 훅은 이
 * 약속이 끝날 때 그 행의 `pending` 을 푼다 — 그래서 **약속이 재조회까지 기다리는지**가 핵심이다.
 */

function deferred() {
  let resolve: () => void = () => undefined
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

/** 마이크로태스크를 충분히 비운다 — 기다리지 않는 흐름이면 이 사이에 끝난다 */
async function flush() {
  for (let index = 0; index < 10; index += 1) await Promise.resolve()
}

describe('runVisitToggle', () => {
  it('PUT 이 성공해도 상세 재조회가 끝나기 전에는 끝나지 않는다', async () => {
    const refetch = deferred()
    let settled = false

    void runVisitToggle({
      mark: () => Promise.resolve(),
      afterMarked: () => undefined,
      refetchDetail: () => refetch.promise,
    }).then(() => {
      settled = true
    })

    await flush()
    expect(settled).toBe(false)

    refetch.resolve()
    await flush()
    expect(settled).toBe(true)
  })

  it('PUT → 후처리 → 재조회 순서로 부르고 saved 로 끝난다', async () => {
    const calls: string[] = []

    const result = await runVisitToggle({
      mark: () => {
        calls.push('mark')
        return Promise.resolve()
      },
      afterMarked: () => {
        calls.push('after')
      },
      refetchDetail: () => {
        calls.push('refetch')
        return Promise.resolve()
      },
    })

    expect(calls).toEqual(['mark', 'after', 'refetch'])
    expect(result).toEqual({ kind: 'saved' })
  })

  it('재조회가 실패해도 저장은 됐다 — saved 다', async () => {
    const result = await runVisitToggle({
      mark: () => Promise.resolve(),
      afterMarked: () => undefined,
      refetchDetail: () => Promise.reject(new Error('offline')),
    })

    expect(result).toEqual({ kind: 'saved' })
  })

  it('후처리에서 던져도 저장 실패가 아니다', async () => {
    const result = await runVisitToggle({
      mark: () => Promise.resolve(),
      afterMarked: () => {
        throw new Error('boom')
      },
      refetchDetail: () => Promise.resolve(),
    })

    expect(result).toEqual({ kind: 'saved' })
  })

  it('PUT 이 실패하면 분류한 오류로 끝나고 재조회하지 않는다', async () => {
    const calls: string[] = []

    const result = await runVisitToggle({
      mark: () => Promise.reject(new ApiError(503, 'PLAN_900', null)),
      afterMarked: () => {
        calls.push('after')
      },
      refetchDetail: () => {
        calls.push('refetch')
        return Promise.resolve()
      },
    })

    expect(calls).toEqual([])
    expect(result.kind).toBe('failed')
    if (result.kind === 'failed') expect(result.error.retriable).toBe(true)
  })
})

describe('dayVisitPending', () => {
  const items = [
    planItem({ planItemId: 'a', day: 1, sequence: 0 }),
    planItem({ planItemId: 'b', day: 1, sequence: 1 }),
  ]

  it('그 일자 항목 중 하나라도 토글이 진행 중이면 true', () => {
    expect(dayVisitPending(items, new Set(['b']))).toBe(true)
  })

  it('다른 일자 항목의 토글은 보지 않는다', () => {
    expect(dayVisitPending(items, new Set(['other']))).toBe(false)
  })
})

/*
  재현 (#1489) — `다녀옴` PUT 직후, 상세 재조회가 늦는 동안 메모를 저장한다.

  캐시 · 서버를 가짜로 들고, 훅과 같은 배선(흐름이 끝나면 `pending` 을 푼다 · 메모 저장은
  `dayVisitPending` 이 false 일 때만 그 순간의 캐시 항목으로 보낸다)으로 묶는다. 고치기 전에는
  PUT 직후 잠금이 풀려 캐시가 `visited=false` 인 채로 메모가 나갔고, 되살리기가 체크를 잃었다.
*/
describe('#1489 다녀옴 직후 메모 저장', () => {
  it('재조회가 늦는 동안 메모 저장이 잠기고, 풀린 뒤 저장하면 체크가 남는다', async () => {
    const before = planItem({ planItemId: 'a', day: 1, sequence: 0, title: '미술관' })
    let cache: PlanItemDetail[] = [before]
    let server: PlanItemDetail[] = [before]
    const pending = new Set<string>()
    const refetch = deferred()

    pending.add('a')
    const toggled = runVisitToggle({
      mark: () => {
        server = server.map((item) => ({ ...item, visited: true }))
        return Promise.resolve()
      },
      afterMarked: () => undefined,
      refetchDetail: async () => {
        await refetch.promise
        cache = server
      },
    }).finally(() => pending.delete('a'))

    await flush()
    // PUT 은 끝났지만 캐시는 아직 옛 값이다 — 이때 메모 저장은 잠겨야 한다
    expect(cache[0]?.visited).toBe(false)
    expect(dayVisitPending(cache, pending)).toBe(true)

    refetch.resolve()
    await toggled
    expect(dayVisitPending(cache, pending)).toBe(false)

    const restored: string[] = []
    const result = await runItemMemoSave(
      { day: 1, dayItems: cache, planItemId: 'a', memo: '오픈런' },
      {
        replace: (): Promise<PlanDetail> =>
          Promise.resolve({
            ...planDetail,
            items: server.map((item) => ({ ...item, planItemId: 'new-a', visited: false })),
          }),
        markVisited: (id) => {
          restored.push(id)
          return Promise.resolve()
        },
        onReplaced: () => undefined,
        refetchDetail: () => Promise.resolve(),
      },
    )

    expect(result.kind).toBe('saved')
    expect(restored).toEqual(['new-a'])
  })
})

import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api/error'
import { dayItemsLock } from '@/lib/plan/day-items-lock'
import { runItemMemoSave } from '@/lib/plan/item-memo-save'
import { itemTimeLocks, runItemTimeSave } from '@/lib/plan/item-time-save'
import { planDetail, planItem } from '@/test/fixtures/plan'
import type { PlanDayItemsReplacePayload, PlanDetail, PlanItemDetail } from '@/types/plan'

/**
 * 항목 시각 저장 한 번의 흐름 — 이슈 #1501 · `일정상세-세부명세.md` D30-2.
 *
 * 훅(`use-plan-item-time.ts`)은 node 환경에서 돌지 않아 흐름을 `runItemTimeSave` 로 뺐다. 결과는
 * **모달을 닫는 시점**(재조회 · 상한 중 먼저)에 오고, 재조회 자체는 `refetched` 로 따로 남는다 —
 * 훅은 그것이 끝날 때까지 그 일자를 일괄 교체 잠금에 둔다.
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

describe('runItemTimeSave', () => {
  it('재조회가 상한 안에 끝나면 재조회 뒤에 끝난다', async () => {
    const refetch = deferred()
    const cap = deferred()
    let settled = false

    void runItemTimeSave({
      change: () => Promise.resolve(),
      afterChanged: () => undefined,
      refetchDetail: () => refetch.promise,
      waitCap: () => cap.promise,
    }).then(() => {
      settled = true
    })

    await flush()
    expect(settled).toBe(false)

    refetch.resolve()
    await flush()
    expect(settled).toBe(true)
  })

  it('재조회가 늦으면 상한에서 끝나되 refetched 는 재조회가 끝나야 풀린다', async () => {
    const refetch = deferred()
    let refetchedDone = false

    const result = await runItemTimeSave({
      change: () => Promise.resolve(),
      afterChanged: () => undefined,
      refetchDetail: () => refetch.promise,
      waitCap: () => Promise.resolve(),
    })

    expect(result.kind).toBe('saved')
    if (result.kind !== 'saved') return
    void result.refetched.then(() => {
      refetchedDone = true
    })

    await flush()
    expect(refetchedDone).toBe(false)

    refetch.resolve()
    await flush()
    expect(refetchedDone).toBe(true)
  })

  it('재조회가 실패해도 저장 성공이고 refetched 는 거부되지 않는다', async () => {
    const result = await runItemTimeSave({
      change: () => Promise.resolve(),
      afterChanged: () => undefined,
      refetchDetail: () => Promise.reject(new Error('network')),
      waitCap: () => new Promise<void>(() => undefined),
    })

    expect(result.kind).toBe('saved')
    if (result.kind === 'saved') await expect(result.refetched).resolves.toBeUndefined()
  })

  it('후처리가 던져도 저장 실패로 말하지 않는다', async () => {
    const result = await runItemTimeSave({
      change: () => Promise.resolve(),
      afterChanged: () => {
        throw new Error('boom')
      },
      refetchDetail: () => Promise.resolve(),
      waitCap: () => Promise.resolve(),
    })

    expect(result.kind).toBe('saved')
  })

  it('PUT 이 실패하면 후처리 · 재조회를 하지 않는다', async () => {
    const calls: string[] = []

    const result = await runItemTimeSave({
      change: () => Promise.reject(new ApiError(503, 'PLAN_900', null)),
      afterChanged: () => {
        calls.push('after')
      },
      refetchDetail: () => {
        calls.push('refetch')
        return Promise.resolve()
      },
      waitCap: () => Promise.resolve(),
    })

    expect(calls).toEqual([])
    expect(result.kind).toBe('failed')
    if (result.kind === 'failed') expect(result.error.retriable).toBe(true)
  })
})

describe('itemTimeLocks', () => {
  it('저장 중이면 모달의 일자를 잠근다', () => {
    expect(itemTimeLocks({ saving: true, day: 2, refetchingDays: [] })).toEqual([
      { saving: true, day: 2 },
    ])
  })

  it('저장이 끝나도 재조회 중인 일자는 잠금에 남는다', () => {
    const lock = dayItemsLock(itemTimeLocks({ saving: false, day: null, refetchingDays: [3] }))

    expect(lock.busy).toBe(true)
    expect(lock.blocksEntry(3)).toBe(true)
    expect(lock.blocksEntry(1)).toBe(false)
  })

  it('저장 · 재조회가 없으면 잠그지 않는다', () => {
    expect(dayItemsLock(itemTimeLocks({ saving: false, day: null, refetchingDays: [] })).busy).toBe(
      false,
    )
  })
})

/*
  재현 (#1501) — 시각 저장 뒤 상세 재조회가 상한(1500ms)보다 늦는 동안 메모를 저장한다.

  캐시 · 서버를 가짜로 들고, 훅과 같은 배선(결과가 오면 모달을 닫아 `saving` 을 풀고 그 일자를
  `refetchingDays` 에 둔다 · `refetched` 가 끝나면 뺀다 · 메모 저장은 잠금이 없을 때만 그 순간의
  캐시 항목으로 보낸다)으로 묶는다. 고치기 전에는 상한에서 잠금이 통째로 풀려 캐시가 옛 시각인
  채로 메모가 나갔고, 일괄 교체가 서버의 새 시각을 옛 값으로 덮었다.
*/
describe('#1501 시각 저장 직후 메모 저장', () => {
  it('재조회가 늦는 동안 메모 저장이 잠기고, 풀린 뒤 저장하면 새 시각을 되싣는다', async () => {
    const before = planItem({ planItemId: 'a', day: 1, sequence: 0, startTime: '10:00:00' })
    let cache: PlanItemDetail[] = [before]
    let server: PlanItemDetail[] = [before]
    let refetchingDays: number[] = []
    const refetch = deferred()

    const result = await runItemTimeSave({
      change: () => {
        server = server.map((item) => ({ ...item, startTime: '14:30:00' }))
        return Promise.resolve()
      },
      afterChanged: () => undefined,
      refetchDetail: async () => {
        await refetch.promise
        cache = server
      },
      // 상한이 먼저 온다 — 재조회가 늦은 경우다
      waitCap: () => Promise.resolve(),
    })

    expect(result.kind).toBe('saved')
    if (result.kind !== 'saved') return
    refetchingDays = [1]
    const unlocked = result.refetched.then(() => {
      refetchingDays = []
    })

    // 모달은 닫혔다(saving=false). 캐시는 아직 옛 시각이다 — 이때 메모 저장은 잠겨야 한다
    expect(cache[0]?.startTime).toBe('10:00:00')
    expect(dayItemsLock(itemTimeLocks({ saving: false, day: null, refetchingDays })).busy).toBe(
      true,
    )

    refetch.resolve()
    await unlocked
    expect(dayItemsLock(itemTimeLocks({ saving: false, day: null, refetchingDays })).busy).toBe(
      false,
    )

    const sent: PlanDayItemsReplacePayload[] = []
    const saved = await runItemMemoSave(
      { day: 1, dayItems: cache, planItemId: 'a', memo: '오픈런' },
      {
        replace: (payload): Promise<PlanDetail> => {
          sent.push(payload)
          return Promise.resolve({ ...planDetail, items: server })
        },
        markVisited: () => Promise.resolve(),
        onReplaced: () => undefined,
        refetchDetail: () => Promise.resolve(),
      },
    )

    expect(saved.kind).toBe('saved')
    expect(sent[0]?.items[0]?.startTime).toBe('14:30:00')
  })
})

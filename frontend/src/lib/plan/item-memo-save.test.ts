import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api/error'
import { messages } from '@/lib/messages'
import { dayItemsLock, dayItemsSaveLocks } from '@/lib/plan/day-items-lock'
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
    // 상한은 오지 않는다 — 재조회가 결과를 정한다. 늦는 재조회는 그 테스트가 따로 꽂는다
    waitCap: () => new Promise<void>(() => undefined),
  }
  return { deps, calls, payloads }
}

const INPUT = { day: 1, dayItems: DAY_ITEMS, planItemId: 'b', memo: '오픈런 추천' }

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

describe('runItemMemoSave', () => {
  it('교체 → 갈아끼우기 → 응답의 새 id 로 되살리기 → 재조회 순서다', async () => {
    const { deps, calls } = fakeDeps()

    const result = await runItemMemoSave(INPUT, deps)

    expect(calls).toEqual(['replace', 'replaced', 'visit:new-a', 'refetch'])
    expect(result).toMatchObject({
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

  it('재조회가 늦으면 상한에서 끝나되 refetched 는 재조회가 끝나야 풀린다 (#1505)', async () => {
    const refetch = deferred()
    const { deps } = fakeDeps()
    let result: Awaited<ReturnType<typeof runItemMemoSave>> | undefined

    void runItemMemoSave(INPUT, {
      ...deps,
      refetchDetail: () => refetch.promise,
      waitCap: () => Promise.resolve(),
    }).then((settled) => {
      result = settled
    })

    // 상한에서 끝난다 — 모달을 닫는 시점이다
    await flush()
    expect(result?.kind).toBe('saved')
    if (result?.kind !== 'saved') return

    let refetchedDone = false
    void result.refetched.then(() => {
      refetchedDone = true
    })
    await flush()
    expect(refetchedDone).toBe(false)

    refetch.resolve()
    await flush()
    expect(refetchedDone).toBe(true)
  })

  it('재조회가 실패해도 저장됨이고 refetched 는 거부되지 않는다', async () => {
    const { deps } = fakeDeps()

    const result = await runItemMemoSave(INPUT, {
      ...deps,
      refetchDetail: () => Promise.reject(new ApiError(503, 'COMMON_503', '일시 장애')),
    })

    expect(result.kind).toBe('saved')
    if (result.kind === 'saved') await expect(result.refetched).resolves.toBeUndefined()
  })

  it('되살릴 것이 없으면 refetched 는 곧바로 풀린다 — 잠금을 남기지 않는다', async () => {
    const unvisited = DAY_ITEMS.map((item) => ({ ...item, visited: false }))
    const { deps } = fakeDeps()

    const result = await runItemMemoSave({ ...INPUT, dayItems: unvisited }, deps)

    expect(result.kind).toBe('saved')
    if (result.kind === 'saved') await expect(result.refetched).resolves.toBeUndefined()
  })
})

/*
  재현 (#1505) — 메모 저장이 `다녀옴` 을 되살린 뒤 상세 재조회가 상한(1500ms)보다 늦는 동안 메모를
  또 저장한다.

  캐시 · 서버를 가짜로 들고, 훅과 같은 배선(결과가 오면 모달을 닫아 `saving` 을 풀고 그 일자를
  `refetchingDays` 에 둔다 · `refetched` 가 끝나면 뺀다 · 다음 메모 저장은 잠금이 없을 때만 그 순간의
  캐시 항목으로 보낸다)으로 묶는다. 고치기 전에는 재조회가 상한에서 끊기면 잠금이 통째로 풀려, 캐시가
  교체 응답(`다녀옴` 풀림)인 채로 다음 교체가 나갔고 되살릴 체크가 없다고 판정해 서버의 체크를 잃었다.
*/
describe('#1505 다녀옴을 되살린 메모 저장 직후 다른 메모 저장', () => {
  it('재조회가 늦는 동안 잠기고, 풀린 뒤 저장하면 되살린 다녀옴을 다시 되살린다', async () => {
    let cache: PlanItemDetail[] = DAY_ITEMS
    let server: PlanItemDetail[] = DAY_ITEMS
    let refetchingDays: number[] = []
    let round = 0
    const refetch = deferred()

    const replace = (payload: PlanDayItemsReplacePayload): Promise<PlanDetail> => {
      // 교체는 id 를 새로 발급하고 다녀옴을 전부 푼다 (D30-3)
      round += 1
      server = payload.items.map((sent, index) => ({
        ...(server[index] as PlanItemDetail),
        planItemId: `r${round}-${index}`,
        memo: sent.memo ?? null,
        visited: false,
      }))
      return Promise.resolve({ ...planDetail, items: server })
    }
    const markVisited = (planItemId: string) => {
      server = server.map((item) =>
        item.planItemId === planItemId ? { ...item, visited: true } : item,
      )
      return Promise.resolve()
    }

    let first: Awaited<ReturnType<typeof runItemMemoSave>> | undefined
    void runItemMemoSave(
      { day: 1, dayItems: cache, planItemId: 'b', memo: '오픈런' },
      {
        replace,
        markVisited,
        onReplaced: (next) => {
          cache = next.items
        },
        refetchDetail: async () => {
          await refetch.promise
          cache = server
        },
        // 상한이 먼저 온다 — 재조회가 늦은 경우다
        waitCap: () => Promise.resolve(),
      },
    ).then((settled) => {
      first = settled
    })

    await flush()
    expect(first?.kind).toBe('saved')
    if (first?.kind !== 'saved') return
    refetchingDays = [1]
    const unlocked = first.refetched.then(() => {
      refetchingDays = []
    })

    // 모달은 닫혔다(saving=false). 서버는 되살렸지만 캐시는 아직 교체 응답(풀림)이다 — 잠겨야 한다
    expect(server[0]?.visited).toBe(true)
    expect(cache[0]?.visited).toBe(false)
    const locks = () => dayItemsSaveLocks({ saving: false, day: null, refetchingDays })
    expect(dayItemsLock(locks()).busy).toBe(true)
    expect(dayItemsLock(locks()).blocksEntry(1)).toBe(true)

    refetch.resolve()
    await unlocked
    expect(dayItemsLock(locks()).busy).toBe(false)

    const second = await runItemMemoSave(
      { day: 1, dayItems: cache, planItemId: cache[1]?.planItemId ?? '', memo: '줄 서기' },
      {
        replace,
        markVisited,
        onReplaced: () => undefined,
        refetchDetail: () => Promise.resolve(),
        waitCap: () => new Promise<void>(() => undefined),
      },
    )

    expect(second).toMatchObject({ kind: 'saved', restored: ['r2-0'] })
    expect(server[0]?.visited).toBe(true)
  })
})

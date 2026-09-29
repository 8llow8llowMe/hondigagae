import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, describe, expect, it } from 'vitest'

import { invalidateAfterPetDeleted } from '@/features/pet/pet-delete-invalidation'
import { PET_INVALIDATE_KEY, petKeys } from '@/features/pet/queries'
import { planKeys } from '@/features/plan/queries'

/**
 * 삭제 직후 `GET /members/me/pets/{id}` 404 가 한 번 나던 것 (#1042).
 *
 * **근본원인**: 삭제 성공 뒤 `invalidateQueries({ queryKey: petKeys.all })` 가 방금 지운
 * 아이의 상세(`petKeys.detail(petId)`)까지 무효화한다. `router.replace('/pets')` 가 화면을
 * 내리기 **전**이라 `PetEditView` 의 `usePetDetail` 이 아직 그 상세를 관찰하고 있고,
 * 관찰 중인(active) 쿼리는 무효화되는 즉시 다시 받는다 — 지운 아이를 다시 묻는 404 다.
 *
 * node 환경이라 React 로 렌더하지 않고 **`QueryObserver` 로 "화면이 관찰 중" 을 만든다** —
 * `useQuery` 가 안에서 쓰는 것이 이것이다.
 */

const PET_ID = '123456789012000002'
const OTHER_PET_ID = '123456789012000001'
const PLAN_ID = '223456789012000001'

const clients: QueryClient[] = []
const unsubscribes: (() => void)[] = []

afterEach(() => {
  unsubscribes.splice(0).forEach((unsubscribe) => unsubscribe())
  clients.splice(0).forEach((client) => client.clear())
})

function client(): QueryClient {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(queryClient)
  return queryClient
}

/** 데이터를 채운 뒤 관찰을 붙인다 — 화면이 그 쿼리를 그리고 있는 상태다. 받은 횟수를 센다 */
function observed(queryClient: QueryClient, queryKey: readonly unknown[]): { calls: number } {
  const counter = { calls: 0 }
  queryClient.setQueryData(queryKey, { seeded: true })

  const observer = new QueryObserver(queryClient, {
    queryKey,
    queryFn: () => {
      counter.calls += 1
      return { refetched: true }
    },
    // 채워 둔 값이 신선해야 관찰을 붙이는 순간 받지 않는다 — 센 횟수가 무효화 몫만 남는다
    staleTime: Infinity,
  })
  unsubscribes.push(observer.subscribe(() => undefined))

  return counter
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('반려견 삭제 뒤 무효화 (#1042)', () => {
  it('원인 재현 — 도메인 전체를 그대로 무효화하면 지운 아이의 상세를 다시 받는다', async () => {
    const queryClient = client()
    const detail = observed(queryClient, petKeys.detail(PET_ID))

    await queryClient.invalidateQueries({ queryKey: PET_INVALIDATE_KEY })
    await settle()

    // 이 1회가 404 였다
    expect(detail.calls).toBe(1)
  })

  it('지운 아이의 상세는 다시 받지 않는다 — 404 재조회가 없다', async () => {
    const queryClient = client()
    const detail = observed(queryClient, petKeys.detail(PET_ID))

    await invalidateAfterPetDeleted(queryClient, PET_ID)
    await settle()

    expect(detail.calls).toBe(0)
  })

  /*
    받지 않을 뿐 **낡았다고는 표시한다.** 표시조차 안 하면 10분(gcTime) 안에 같은 key 를
    다시 관찰하는 화면이 지운 아이를 신선한 값으로 그린다.
  */
  it('지운 아이의 상세는 낡은 것으로 표시해 둔다', async () => {
    const queryClient = client()
    observed(queryClient, petKeys.detail(PET_ID))

    await invalidateAfterPetDeleted(queryClient, PET_ID)

    expect(queryClient.getQueryState(petKeys.detail(PET_ID))?.isInvalidated).toBe(true)
  })

  it('목록과 다른 아이의 상세는 다시 받는다 — 대표견이 옮겨 갔을 수 있다', async () => {
    const queryClient = client()
    const list = observed(queryClient, petKeys.list())
    const other = observed(queryClient, petKeys.detail(OTHER_PET_ID))

    await invalidateAfterPetDeleted(queryClient, PET_ID)
    await settle()

    expect(list.calls).toBe(1)
    expect(other.calls).toBe(1)
  })

  /*
    삭제 응답이 온 시점에 다견 일정의 `petIds` 에서는 이미 빠져 있다 (plan-service 삭제
    트리거, #972). 일정 캐시를 그대로 두면 30초(staleTime) 동안 지운 아이가 일정에 남아 보인다.
  */
  it('일정 목록·상세를 다시 받는다', async () => {
    const queryClient = client()
    const list = observed(queryClient, planKeys.list())
    const detail = observed(queryClient, planKeys.detail(PLAN_ID))

    await invalidateAfterPetDeleted(queryClient, PET_ID)
    await settle()

    expect(list.calls).toBe(1)
    expect(detail.calls).toBe(1)
  })

  /*
    확인창은 삭제 응답이 올 때까지 열려 있고 그 집계를 관찰하고 있다. 다시 받으면 지운 뒤의
    0 / 0 / 0 이 와서 **확인창의 문장이 스피너 옆에서 사라진다.**
  */
  it('지운 아이의 동행 일정 집계는 다시 받지 않는다', async () => {
    const queryClient = client()
    const summary = observed(queryClient, planKeys.companions(PET_ID))

    await invalidateAfterPetDeleted(queryClient, PET_ID)
    await settle()

    expect(summary.calls).toBe(0)
    expect(queryClient.getQueryState(planKeys.companions(PET_ID))?.isInvalidated).toBe(true)
  })
})

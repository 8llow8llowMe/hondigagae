import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { aiPlanJobQueryFn } from '@/features/ai-plan/job-query'
import { aiPlanKeys } from '@/features/ai-plan/queries'
import { mergeJobUpdate } from '@/lib/ai-plan/job-stream'
import type * as AiPlanApi from '@/lib/api/ai-plan'
import { aiPlanJob } from '@/test/fixtures/ai-plan'
import type { AiPlanJob } from '@/types/ai-plan'

const fetchAiPlanJob = vi.hoisted(() => vi.fn<(jobId: string) => Promise<AiPlanJob>>())

vi.mock('@/lib/api/ai-plan', async (importOriginal) => ({
  ...(await importOriginal<typeof AiPlanApi>()),
  fetchAiPlanJob,
}))

const JOB_ID = 'job-1'

function running(stepOrder: number): AiPlanJob {
  return aiPlanJob('RUNNING', { jobId: JOB_ID, stepOrder })
}

/** 응답을 손으로 풀어 주는 조회 — "SSE 가 먼저, 조회가 나중" 순서를 테스트가 정한다 */
function deferredFetch(): (job: AiPlanJob) => void {
  let resolve: (job: AiPlanJob) => void = () => undefined
  fetchAiPlanJob.mockImplementationOnce(
    () =>
      new Promise<AiPlanJob>((done) => {
        resolve = done
      }),
  )
  return (job) => resolve(job)
}

let queryClient: QueryClient

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  fetchAiPlanJob.mockReset()
})

afterEach(() => queryClient.clear())

/*
  **첫 조회가 SSE 가 먼저 넣은 새 단계를 덮던 것 (#1057).** `useAiPlanJob` 의 첫 조회는 구독과
  무관하게 한 번 돌고, 구독은 그 조회가 떠 있는 동안 열려 스냅샷을 먼저 넣을 수 있다. 조회 응답은
  **떠난 시점**의 상태라 도착했을 때 이미 옛 값일 수 있다.

  node 환경이라 훅을 렌더하지 않고, 훅이 쓰는 `queryFn` 과 스트림 훅이 쓰는 `setQueryData` 를 실제
  `QueryClient` 에서 그 순서대로 부른다.
*/
describe('aiPlanJobQueryFn — 늦게 온 조회 응답 (#1057)', () => {
  it('원인 재현 — 조회가 떠 있는 동안 SSE 가 DRAFTING 을 넣으면, 늦게 온 WEATHER 가 덮지 않는다', async () => {
    const respond = deferredFetch()
    const key = aiPlanKeys.job(JOB_ID)

    const pending = queryClient.fetchQuery({
      queryKey: key,
      queryFn: aiPlanJobQueryFn(queryClient, JOB_ID),
    })

    // 스트림 훅과 같은 쓰기 (`use-ai-plan-job-stream.ts`)
    queryClient.setQueryData<AiPlanJob>(key, (cached) => mergeJobUpdate(cached, running(4)))
    respond(running(3))
    await pending

    expect(queryClient.getQueryData<AiPlanJob>(key)?.stepOrder).toBe(4)
  })

  it('조회가 더 앞서 있으면 조회 값을 쓴다 — SSE 가 흘린 전이를 조회가 메운다', async () => {
    const respond = deferredFetch()
    const key = aiPlanKeys.job(JOB_ID)

    const pending = queryClient.fetchQuery({
      queryKey: key,
      queryFn: aiPlanJobQueryFn(queryClient, JOB_ID),
    })

    queryClient.setQueryData<AiPlanJob>(key, (cached) => mergeJobUpdate(cached, running(2)))
    respond(running(3))
    await pending

    expect(queryClient.getQueryData<AiPlanJob>(key)?.stepOrder).toBe(3)
  })

  it('캐시가 비어 있으면 조회 값을 그대로 쓴다', async () => {
    fetchAiPlanJob.mockResolvedValueOnce(running(1))
    const key = aiPlanKeys.job(JOB_ID)

    await queryClient.fetchQuery({ queryKey: key, queryFn: aiPlanJobQueryFn(queryClient, JOB_ID) })

    expect(fetchAiPlanJob).toHaveBeenCalledWith(JOB_ID)
    expect(queryClient.getQueryData<AiPlanJob>(key)?.stepOrder).toBe(1)
  })
})

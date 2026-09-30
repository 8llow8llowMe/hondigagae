import type { QueryClient } from '@tanstack/react-query'

import { aiPlanKeys } from '@/features/ai-plan/queries'
import { mergeJobUpdate } from '@/lib/ai-plan/job-stream'
import { fetchAiPlanJob } from '@/lib/api/ai-plan'
import type { AiPlanJob } from '@/types/ai-plan'

/**
 * 작업 조회 `queryFn` — `useAiPlanJob` 이 쓴다.
 *
 * **응답을 그대로 캐시에 두지 않고 `mergeJobUpdate` 로 거른다.** SSE 가 같은 캐시에 쓰므로, 조회가
 * 떠 있는 동안 구독이 더 앞선 상태를 넣었을 수 있다 — 조회 응답은 **떠난 시점**의 상태다. 캐시는
 * 응답이 도착한 뒤에 읽는다(떠날 때 읽으면 그 사이 SSE 가 쓴 값을 못 본다).
 *
 * 훅 밖으로 뺀 이유는 테스트다 (#1057) — node 환경이라 훅을 렌더하지 않고, 이 함수와 스트림 훅의
 * `setQueryData` 를 실제 `QueryClient` 에서 경합 순서대로 불러 본다 (`job-query.test.ts`).
 */
export function aiPlanJobQueryFn(queryClient: QueryClient, jobId: string) {
  return async (): Promise<AiPlanJob> => {
    const fetched = await fetchAiPlanJob(jobId)
    const cached = queryClient.getQueryData<AiPlanJob>(aiPlanKeys.job(jobId))
    return mergeJobUpdate(cached, fetched)
  }
}

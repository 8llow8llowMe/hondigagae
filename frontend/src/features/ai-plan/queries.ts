/**
 * AI 일정 생성 query key.
 *
 * **key 에 조건을 넣지 않는다.** 조건은 제출로 이미 서버에 넘어갔고 화면이 다시 보는
 * 것은 `jobId` 하나다 (`api-integration-guide.md` §7).
 */
export const aiPlanKeys = {
  all: ['ai-plans'] as const,
  job: (jobId: string) => [...aiPlanKeys.all, 'job', jobId] as const,
}

/**
 * 작업 조회는 **캐시하지 않는다.**
 *
 * `staleTime: 0` 인 이유는 폴링이 목적이기 때문이다 — 신선하다고 판단되면
 * `refetchInterval` 이 돌아도 요청을 건너뛴다. `gcTime` 은 짧게 둔다: 완료된 초안을
 * 오래 들고 있어야 할 이유가 없고, 담으면 어차피 일정 캐시로 넘어간다.
 *
 * **`retry: false` 다.** 폴링이라 실패한 주기는 다음 주기가 자연히 다시 시도한다
 * (명세 S4). 재시도를 겹치면 2초 간격이 무의미해진다.
 */
export const AI_PLAN_JOB_QUERY_OPTIONS = {
  staleTime: 0,
  gcTime: 60_000,
  retry: false,
} as const

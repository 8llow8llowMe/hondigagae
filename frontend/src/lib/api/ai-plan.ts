import { clientFetch } from '@/lib/api/client'
import { paths } from '@/lib/api/paths'
import type { AiPlanJob, AiPlanSubmitPayload, AiPlanSubmitResult } from '@/types/ai-plan'

/**
 * AI 일정 생성 API — 경로와 브라우저 호출부.
 *
 * **두 화면 모두 클라이언트에서 부른다.** 조건 입력은 폼이고 대기 화면은 폴링이라
 * 서버 프리페치가 의미가 없다 (architecture-guide.md §9).
 *
 * 계약 상세는 docs/features/ai-plan/공통명세.md.
 */

/**
 * 제출. **응답이 HTTP 202 다** — `unwrap()` 은 `dataHeader.success` 로 판정하므로
 * 200 이 아니어도 정상 처리된다.
 *
 * **멱등하다.** 같은 사용자의 같은 요청이 진행 중이면 기존 `jobId` 를 그대로 준다
 * (컨트롤러 설명) — 중복 제출을 화면이 따로 막을 필요가 없다.
 */
export function submitAiPlan(payload: AiPlanSubmitPayload): Promise<AiPlanSubmitResult> {
  return clientFetch<AiPlanSubmitResult>(paths.aiPlans.submit, { method: 'POST', body: payload })
}

/**
 * 작업 조회.
 *
 * **작업 실패는 여기서 던지지 않는다** — HTTP 200 + `status.code === 'FAILED'` 로 오므로
 * 정상 응답이다 (api-integration-guide.md §5). 화면이 `isJobFailed()` 로 판정한다.
 *
 * 던지는 경우는 조회 자체가 실패했을 때다: 타인·없는 `jobId` 는 **404 `AIPLAN_002`**.
 */
export function fetchAiPlanJob(jobId: string): Promise<AiPlanJob> {
  return clientFetch<AiPlanJob>(paths.aiPlans.job(jobId))
}

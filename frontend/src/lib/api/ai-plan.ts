import { bffUrl, clientFetch } from '@/lib/api/client'
import { paths } from '@/lib/api/paths'
import type {
  AiPlanJob,
  AiPlanSubmitPayload,
  AiPlanSubmitResult,
  PackingListResult,
} from '@/types/ai-plan'

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

/**
 * 작업 취소 (#250).
 *
 * **협조적 취소다.** 실행 중인 LLM 호출을 끊지 못하고, 서버가 상태를 `CANCELED` 로 못
 * 박으면 워커가 **단계 경계마다** 그것을 읽어 스스로 선다 — 실익은 가장 비싼 `DRAFTING`
 * 에 들어가기 전에 서는 것이고, 이미 들어갔다면 돌아온 초안을 버리는 것까지가 전부다.
 * **즉시 중단을 전제로 화면을 짜면 안 된다.**
 *
 * 응답은 취소된 작업이라 **호출부가 그대로 작업 캐시에 쓴다** — 다음 폴링을 기다릴 필요가
 * 없다.
 *
 * 던지는 경우:
 *  - **409 `AIPLAN_019`** — 이미 완료·실패한 작업. 요청이 잘못된 것이 아니라 대상의 상태가
 *    지나간 것이므로 **오류로 띄우지 않고 결과 화면으로 넘긴다**
 *  - 404 `AIPLAN_002` — 타인·없는 `jobId`
 *
 * **이미 취소된 작업은 던지지 않는다** — 200 멱등이다.
 */
export function cancelAiPlanJob(jobId: string): Promise<AiPlanJob> {
  return clientFetch<AiPlanJob>(paths.aiPlans.jobCancel(jobId), { method: 'POST' })
}

/**
 * 작업 상태 SSE 구독을 연다 (#91).
 *
 * **전송만 여기서 만든다.** 구독 수명·이벤트 해석·폴백 판단은 호출부(`use-ai-plan-job-stream.ts`)가
 * 한다 — 경로와 전송을 이 계층에 두는 규칙은 `architecture-guide.md` §8 이다.
 *
 * **`EventSource` 로 충분하다.** 백엔드 스키마는 `Authorization` 헤더 때문에 fetch 기반 SSE
 * 클라이언트를 권하지만, 이 저장소는 BFF 가 토큰을 붙이므로 브라우저는 같은 오리진에 세션
 * 쿠키만 실어 보낸다.
 *
 * `clientFetch` 를 쓸 수 없어 `bffUrl` 로 base 를 맞춘다 — **호출부가 base 를 다시 적으면 안 된다.**
 */
export function openAiPlanJobStream(jobId: string): EventSource {
  return new globalThis.EventSource(bffUrl(paths.aiPlans.jobStream(jobId)))
}

/**
 * 반려견 여행 준비물 생성 (#155).
 *
 * **동기 호출이고 수십 초가 걸릴 수 있다** (컨트롤러 설명). AI 일정 생성과 달리 잡·폴링이
 * 없으므로 호출부가 대기 상태를 스스로 그려야 한다.
 *
 * **본문이 없다.** 근거는 서버가 `planId` 로 모은다 — 일정 개요, 여행 기간의 예보,
 * 반려견 특성이다.
 *
 * 실패는 **`AIPLAN_016` 하나다** — 일정이 없거나 본인 소유가 아니면 같은 코드로 온다.
 * 남의 일정을 가리켜도 "없다" 고 답하는 쪽이라 화면이 두 경우를 구분해 말하면 안 된다.
 */
export function generatePackingList(planId: string): Promise<PackingListResult> {
  return clientFetch<PackingListResult>(paths.aiPlans.packingList(planId), { method: 'POST' })
}

/**
 * AI 일정 생성 작업 상태 판정 — 명세 S4(폴링) · S7(상태 화면).
 *
 * 근거: backend ai-service `AiPlanJobStatus` · `AiPlanJobStatusResponse` **소스 실측**
 * (`origin/develop` `af86c98`). 상태는 `PENDING`·`RUNNING`·`COMPLETED`·`FAILED` **넷뿐이고
 * 세부 단계가 계약에 없다** — 화면이 단계 목록을 지어내면 거짓 진행률이 된다 (명세 S2).
 *
 * 작업 타입 정본은 `src/types/ai-plan.ts` 다. 여기서는 판정만 한다.
 */

/**
 * 판정에 필요한 최소 모양.
 *
 * 실제 응답의 `status` 는 항상 metadata 객체지만 **문자열도 받는다** — SSE 이벤트나 mock 이
 * 코드만 실어 보내도 판정이 깨지지 않아야 한다.
 */
type StatusLike =
  string | { code: string; name?: string; description?: string | null } | null | undefined
type JobLike = { status: StatusLike }

/** status 가 문자열이든 metadata 객체든 코드 문자열을 꺼낸다 */
export function statusCodeOf(status: StatusLike): string | null {
  if (status === null || status === undefined) return null
  if (typeof status === 'string') return status
  return status.code
}

/**
 * 작업이 실패했는가.
 *
 * 백엔드는 작업 실패를 HTTP 5xx 가 아니라 **HTTP 200 + `status=FAILED`** 로 응답한다
 * (api-integration-guide.md §5). `dataHeader.success` 만 보면 실패를 놓친다.
 */
export function isJobFailed(job: JobLike | null | undefined): boolean {
  return statusCodeOf(job?.status) === 'FAILED'
}

export function isJobCompleted(job: JobLike | null | undefined): boolean {
  return statusCodeOf(job?.status) === 'COMPLETED'
}

/**
 * 폴링을 계속해야 하는가.
 * 완료·실패에서 반드시 멈춘다. 멈추지 않는 폴링이 대표 사고다.
 */
export function shouldKeepPolling(job: JobLike | null | undefined): boolean {
  if (job === null || job === undefined) return true
  return !isJobCompleted(job) && !isJobFailed(job)
}

/** 폴링 간격(ms) — 아트보드 02 */
export const JOB_POLL_INTERVAL_MS = 2000

/**
 * 안내를 덧붙이는 시점(ms). 이 전에는 아무 말도 하지 않는다 — 정상 소요 시간이다
 * (제출 화면이 "20초쯤 걸려요" 로 이미 기대를 맞춰 뒀다).
 */
export const JOB_POLL_SLOW_MS = 30_000

/**
 * 폴링 상한(ms). 넘으면 멈추고 수동 확인을 준다 (명세 S8 미결 3).
 *
 * 근거: 백엔드 스키마가 "로컬 LLM 기준 수십 초" 라 한다. 90초는 그 3배 여유다.
 * **무제한이면 죽은 작업을 영원히 두드린다.**
 *
 * `AIPLAN_006 JOB_TIMEOUT`(504) 은 서버 쪽 타임아웃이라 이 상한과 별개다.
 */
export const JOB_POLL_LIMIT_MS = 90_000

/** 대기 화면이 말해야 하는 국면 — 명세 S7 */
export type JobPollPhase = 'normal' | 'slow' | 'exceeded'

export function jobPollPhase(elapsedMs: number): JobPollPhase {
  if (elapsedMs >= JOB_POLL_LIMIT_MS) return 'exceeded'
  if (elapsedMs >= JOB_POLL_SLOW_MS) return 'slow'
  return 'normal'
}

/**
 * 폴링 간격. 멈춰야 하면 false — React Query `refetchInterval` 에 그대로 넘긴다.
 *
 * **상한을 넘기면 진행 중이어도 멈춘다.** `elapsedMs` 를 생략하면 상한을 보지 않는다
 * (상한 판단이 필요 없는 호출부를 위해 남겨 둔다).
 */
export function jobPollInterval(
  job: JobLike | null | undefined,
  elapsedMs?: number,
): number | false {
  if (elapsedMs !== undefined && jobPollPhase(elapsedMs) === 'exceeded') return false
  return shouldKeepPolling(job) ? JOB_POLL_INTERVAL_MS : false
}

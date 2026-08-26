import type { EnumMetadata } from '@/types/api'

/**
 * AI 일정 생성 작업 상태.
 *
 * TODO(BE 확인): 실제 enum 값은 http://localhost:8085/v3/api-docs 로 확인한다.
 * 아래는 backend/docs/api-design-guide.md §7 의 서술(status / FAILED)을 기준으로 둔 것이다.
 */
export const JOB_STATUSES = ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

export type AiPlanJob<TResult> = {
  jobId: string
  status: JobStatus | EnumMetadata
  result: TResult | null
  errorCode: string | null
  errorMessage: string | null
}

/** status 가 문자열이든 metadata 객체든 코드 문자열을 꺼낸다 */
export function statusCodeOf(status: JobStatus | EnumMetadata | null | undefined): string | null {
  if (status === null || status === undefined) return null
  if (typeof status === 'string') return status
  return status.code
}

/**
 * 작업이 실패했는가.
 *
 * 백엔드는 작업 실패를 HTTP 5xx 가 아니라 **HTTP 200 + status=FAILED** 로 응답한다
 * (backend/docs/api-design-guide.md §7). dataHeader.success 만 보면 실패를 놓친다.
 */
export function isJobFailed<T>(job: Pick<AiPlanJob<T>, 'status'> | null | undefined): boolean {
  return statusCodeOf(job?.status) === 'FAILED'
}

export function isJobCompleted<T>(job: Pick<AiPlanJob<T>, 'status'> | null | undefined): boolean {
  return statusCodeOf(job?.status) === 'COMPLETED'
}

/**
 * 폴링을 계속해야 하는가.
 * 완료·실패에서 반드시 멈춘다. 멈추지 않는 폴링이 대표 사고다.
 */
export function shouldKeepPolling<T>(
  job: Pick<AiPlanJob<T>, 'status'> | null | undefined,
): boolean {
  if (job === null || job === undefined) return true
  return !isJobCompleted(job) && !isJobFailed(job)
}

/** 폴링 간격(ms). 멈춰야 하면 false — React Query refetchInterval 에 그대로 넘긴다 */
export const JOB_POLL_INTERVAL_MS = 2000

export function jobPollInterval<T>(
  job: Pick<AiPlanJob<T>, 'status'> | null | undefined,
): number | false {
  return shouldKeepPolling(job) ? JOB_POLL_INTERVAL_MS : false
}

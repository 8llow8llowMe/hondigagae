/** 에러 종류. UI 분기의 단일 기준이다 — docs/api-integration-guide.md §3 */
export type ErrorKind = 'validation' | 'unauthorized' | 'not-found' | 'forbidden' | 'temporary'

/** 네트워크 무응답을 나타내는 status */
export const NO_RESPONSE_STATUS = 0

export class ApiError extends Error {
  readonly status: number
  readonly resultCode: string | null
  readonly rawMessage: unknown

  constructor(status: number, resultCode: string | null, rawMessage: unknown) {
    super(typeof rawMessage === 'string' ? rawMessage : `API 오류 (status ${status})`)
    this.name = 'ApiError'
    this.status = status
    this.resultCode = resultCode
    this.rawMessage = rawMessage
  }

  get kind(): ErrorKind {
    return classify(this.status)
  }
}

/**
 * HTTP 상태를 UI 분기용 종류로 변환한다.
 *
 * 백엔드는 타인 리소스 접근도 404 로 응답한다(존재 노출 차단). 403을 기대하면 안 된다.
 */
export function classify(status: number): ErrorKind {
  if (status === 404) return 'not-found'
  if (status === 401) return 'unauthorized'
  if (status === 400) return 'validation'
  if (status >= 500 || status === NO_RESPONSE_STATUS) return 'temporary'
  return 'forbidden'
}

/**
 * 조회 실패를 UI 분기용 HTTP 상태로 바꾼다. 성공이면 `null`.
 * `ApiError` 가 아니면 전송 단계 실패로 보고 무응답(0)으로 취급한다.
 */
export function toErrorStatus(error: unknown): number | null {
  if (error === null || error === undefined) return null
  if (error instanceof ApiError) return error.status
  return NO_RESPONSE_STATUS
}

/** 재시도해도 결과가 달라질 수 있는 실패인가. 5xx·무응답만 true */
export function isRetriable(error: unknown): boolean {
  if (error instanceof ApiError) return error.kind === 'temporary'
  // ApiError 가 아니면 전송 단계 실패로 본다
  return true
}

/** 화면에 재시도 버튼을 노출해야 하는가. 404 에는 절대 노출하지 않는다 */
export function shouldOfferRetry(error: unknown): boolean {
  return isRetriable(error)
}

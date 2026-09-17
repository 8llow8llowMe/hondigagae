import type { ValidationErrorItem } from '@/types/api'

/** 에러 종류. UI 분기의 단일 기준이다 — docs/api-integration-guide.md §3 */
export type ErrorKind =
  | 'validation' // 400 — 입력 수정 유도
  | 'unauthorized' // 401 — 재발급 1회 → 로그인 유도
  | 'not-found' // 404 — 데이터 부재 또는 타인 리소스
  | 'gone' // 410 — 있었지만 만료됐다 (PLAN_024 공유 링크)
  | 'conflict' // 409 — 이미 존재 (MEMBER_001 이메일 중복)
  | 'rate-limited' // 429 — 쿨다운·잠금 (AUTH_003 / AUTH_015)
  | 'forbidden' // 그 외 4xx
  | 'temporary' // 5xx · 무응답

/** 네트워크 무응답을 나타내는 status */
export const NO_RESPONSE_STATUS = 0

export class ApiError extends Error {
  readonly status: number
  readonly resultCode: string | null
  readonly rawMessage: unknown
  /**
   * 필드 단위 검증 오류 (#491 · #501). 검증 실패가 아니면 `null` 이다.
   *
   * **`rawMessage` 와 자리를 나눈다.** 서버가 대표 메시지와 필드 목록을
   * `resultMessage` / `fieldErrors` 두 키로 분리했으므로 여기서도 합치지 않는다 —
   * 합치면 `toFormErrors()` 가 다시 갈라야 하고, 그 과정에서 대표 메시지가
   * 문자열이라는 사실이 필드 목록을 가려 버린다(이 이슈가 난 원인).
   */
  readonly fieldErrors: ValidationErrorItem[] | null

  constructor(
    status: number,
    resultCode: string | null,
    rawMessage: unknown,
    fieldErrors: ValidationErrorItem[] | null = null,
  ) {
    super(typeof rawMessage === 'string' ? rawMessage : `API 오류 (status ${status})`)
    this.name = 'ApiError'
    this.status = status
    this.resultCode = resultCode
    this.rawMessage = rawMessage
    this.fieldErrors = fieldErrors
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
  /*
    **410 을 404 와 합치지 않는다** (#628). 백엔드가 일부러 갈랐다 — 공유 링크의
    없음·폐기·삭제는 전부 404 로 **같게** 답해 "이 토큰은 있었다" 를 흘리지 않고,
    만료만 410 이다. 받은 사람이 "새 링크를 달라" 고 말할 수 있는 경우가 그것뿐이라
    화면이 다른 말을 해야 한다 (`PlanErrorCode.SHARE_LINK_EXPIRED`).

    `'forbidden'` 으로 떨어뜨려도 재시도 버튼은 안 뜨지만(둘 다 `temporary` 가 아니다)
    문구가 일반 4xx 것이 된다. 분기 기준은 이 타입 하나다.
  */
  if (status === 410) return 'gone'
  if (status === 401) return 'unauthorized'
  if (status === 400) return 'validation'
  if (status === 409) return 'conflict'
  // 시간이 지나면 풀리지만 즉시 재시도는 무의미하다. 재시도 버튼을 주면 잠금이 연장된다
  if (status === 429) return 'rate-limited'
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

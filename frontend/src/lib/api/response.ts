import { ApiError } from '@/lib/api/error'
import type { ApiResponse } from '@/types/api'

/**
 * 공통 래퍼인가 (#203).
 *
 * **매개변수 타입은 약속이고 이 검사는 사실이다.** 전송 계층은 `response.json()` 결과를
 * `ApiResponse<T>` 로 단정해서 넘기지만, 실제로 래퍼가 오는 것은 **서비스가 응답을
 * 만들었을 때뿐**이다. 게이트웨이가 대신 답하면 Spring 기본 오류 본문이 온다:
 *
 * ```json
 * {"timestamp":"...","path":"/api/v1/plans","status":503,"error":"Service Unavailable"}
 * ```
 *
 * dev 실측으로 확인한 세 갈래다 — 라우트 미등록(404), 서비스 미기동(503),
 * 게이트웨이 인증 거절(403). 반대로 서비스까지 닿은 실패는 401 `SECURITY_004`,
 * 404 `PLACE_002` 처럼 **성공과 같은 래퍼**로 온다.
 *
 * `dataHeader` 없이 구조분해하면 `TypeError` 가 나고, 그것은 `ApiError` 가 아니라서
 * `classify()` 를 거치지 못한다 — `toErrorStatus()` 가 무응답(0)으로 떨어뜨려
 * **서비스 장애를 "네트워크 연결 확인" 으로 안내한다.** 이 검사가 막는 것이 그것이다.
 */
function hasEnvelope(response: unknown): boolean {
  if (typeof response !== 'object' || response === null) return false

  const { dataHeader } = response as { dataHeader?: unknown }
  return typeof dataHeader === 'object' && dataHeader !== null
}

/**
 * 래퍼가 아닌 본문의 실패.
 *
 * **`resultCode` · `rawMessage` 를 `null` 로 둔다.** 게이트웨이 본문의 `error` 는
 * `"Service Unavailable"` 같은 영문이라 그대로 실으면 `toMessage()` 가 문자열로 인정해
 * 화면에 영어가 나간다. 상태코드만 살리면 `classify()` 가 종류를 정하고 문구는
 * `messages` 가 담당한다.
 */
function envelopeMissing(status: number): ApiError {
  return new ApiError(status, null, null)
}

/**
 * 공통 래퍼에서 dataBody 를 꺼낸다.
 * dataHeader.success 판별을 건너뛰고 dataBody 를 바로 쓰지 않는다
 * (docs/api-integration-guide.md §2).
 */
export function unwrap<T>(response: ApiResponse<T>, status: number): T {
  if (!hasEnvelope(response)) throw envelopeMissing(status)

  const { success, resultCode, resultMessage } = response.dataHeader

  if (!success || response.dataBody === null) {
    throw new ApiError(status, resultCode, resultMessage)
  }

  return response.dataBody
}

/**
 * `dataBody` 가 없는 성공 응답을 판정한다.
 *
 * signup / logout / email 인증 계열은 `dataBody: null` 로 성공한다
 * (`docs/features/auth/공통명세.md` S3). `unwrap()` 은 null 을 실패로 보므로
 * 이 호출들에 쓰면 성공을 에러로 만든다.
 */
export function unwrapVoid(response: ApiResponse<unknown>, status: number): void {
  if (!hasEnvelope(response)) throw envelopeMissing(status)

  const { success, resultCode, resultMessage } = response.dataHeader
  if (!success) throw new ApiError(status, resultCode, resultMessage)
}

/**
 * resultMessage 를 화면에 쓸 문자열로 정규화한다.
 * 백엔드 타입이 Object 이므로 문자열이 아닐 수 있다.
 */
export function toMessage(raw: unknown, fallback: string): string {
  if (typeof raw === 'string' && raw.trim().length > 0) return raw
  return fallback
}

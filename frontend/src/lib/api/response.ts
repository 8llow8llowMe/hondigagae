import { ApiError } from '@/lib/api/error'
import type { ApiResponse } from '@/types/api'

/**
 * 공통 래퍼에서 dataBody 를 꺼낸다.
 * dataHeader.success 판별을 건너뛰고 dataBody 를 바로 쓰지 않는다
 * (docs/api-integration-guide.md §2).
 */
export function unwrap<T>(response: ApiResponse<T>, status: number): T {
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

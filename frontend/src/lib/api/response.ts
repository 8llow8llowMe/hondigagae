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
 * resultMessage 를 화면에 쓸 문자열로 정규화한다.
 * 백엔드 타입이 Object 이므로 문자열이 아닐 수 있다.
 */
export function toMessage(raw: unknown, fallback: string): string {
  if (typeof raw === 'string' && raw.trim().length > 0) return raw
  return fallback
}

/**
 * Bean Validation 실패 응답(필드별 구조)을 필드 → 메시지 맵으로 정규화한다.
 * 형태가 아니면 빈 객체를 반환한다.
 */
export function toFieldErrors(raw: unknown): Record<string, string> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {}

  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string') result[key] = value
  }
  return result
}

import type { ApiResponse } from '@/types/api'

/** 성공 응답 빌더 */
export function ok<T>(dataBody: T): ApiResponse<T> {
  return { dataHeader: { success: true, resultCode: null, resultMessage: null }, dataBody }
}

/** 실패 응답 빌더 */
export function fail(resultCode: string, resultMessage: unknown = null): ApiResponse<never> {
  return { dataHeader: { success: false, resultCode, resultMessage }, dataBody: null }
}

/**
 * Bean Validation 실패처럼 resultMessage 가 문자열이 아닌 경우.
 * 백엔드 타입이 Object 라서 실제로 발생한다.
 */
export function failWithFields(
  resultCode: string,
  fields: Record<string, string>,
): ApiResponse<never> {
  return fail(resultCode, fields)
}

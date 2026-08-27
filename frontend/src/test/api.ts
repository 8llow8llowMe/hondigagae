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
 * Bean Validation 실패 응답.
 * resultMessage 는 문자열이 아니라 ValidationErrorBody 객체다
 * — backend/core `ValidationErrorSupport` 실측.
 */
export function failWithFields(
  resultCode: string,
  errors: { code: string; field: string; message: string }[],
): ApiResponse<never> {
  return fail(resultCode, { message: errors[0]?.message ?? '', errors })
}

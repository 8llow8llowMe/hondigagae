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

/**
 * 게이트웨이 레벨 오류 본문 (#203).
 *
 * **공통 래퍼가 아니다.** 라우트 미등록(404)·서비스 미기동(503)·게이트웨이 인증
 * 거절(403)은 서비스에 닿지 못해 Spring 기본 오류 본문으로 온다. dev 실측 모양이다.
 *
 * 반환 타입을 `ApiResponse` 로 단정하는 것은 **전송 계층이 하는 거짓말과 같다** —
 * `client.ts` / `server.ts` 가 `response.json()` 결과를 그렇게 캐스팅해서 넘긴다.
 */
export function gatewayError(status: number, error: string, path = '/api/v1/plans') {
  return {
    timestamp: '2026-09-03T14:06:36.650+00:00',
    path,
    status,
    error,
  } as unknown as ApiResponse<never>
}

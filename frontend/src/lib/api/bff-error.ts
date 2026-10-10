/**
 * BFF가 게이트웨이에 닿지 못했을 때의 응답.
 *
 * 예외를 그대로 던지면 Next 가 빈 500 을 내보내고, 클라이언트는 공통 래퍼가 아닌
 * 응답을 받아 원인을 분류할 수 없다. 503 + 공통 래퍼로 변환해
 * `classify()` 가 'temporary' 로 판정하고 재시도 UI 가 뜨게 한다.
 *
 * env·transport 의존이 없는 순수 함수라 테스트할 수 있다.
 */
import type { ApiResponse } from '@/types/api'

export const GATEWAY_UNREACHABLE_STATUS = 503
export const GATEWAY_UNREACHABLE_CODE = 'BFF_GATEWAY_UNREACHABLE'

export function gatewayUnreachablePayload(cause: unknown): ApiResponse<never> {
  return {
    dataHeader: {
      success: false,
      resultCode: GATEWAY_UNREACHABLE_CODE,
      resultMessage: cause instanceof Error ? cause.message : null,
    },
    dataBody: null,
  }
}

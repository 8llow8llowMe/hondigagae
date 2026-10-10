import { describe, expect, it } from 'vitest'

import {
  GATEWAY_UNREACHABLE_CODE,
  GATEWAY_UNREACHABLE_STATUS,
  gatewayUnreachablePayload,
} from '@/lib/api/bff-error'
import { classify } from '@/lib/api/error'
import { unwrap } from '@/lib/api/response'

describe('gatewayUnreachablePayload', () => {
  it('공통 래퍼 형태를 유지해 클라이언트가 판별할 수 있게 한다', () => {
    const payload = gatewayUnreachablePayload(new Error('ECONNREFUSED'))

    expect(payload.dataHeader.success).toBe(false)
    expect(payload.dataHeader.resultCode).toBe(GATEWAY_UNREACHABLE_CODE)
    expect(payload.dataBody).toBeNull()
  })

  it('unwrap 이 ApiError 로 변환한다', () => {
    expect(() =>
      unwrap(gatewayUnreachablePayload(new Error('x')), GATEWAY_UNREACHABLE_STATUS),
    ).toThrow()
  })

  it('503 은 일시 장애로 분류되어 재시도 UI 가 뜬다', () => {
    expect(classify(GATEWAY_UNREACHABLE_STATUS)).toBe('temporary')
  })

  it('Error 가 아닌 원인도 처리한다', () => {
    expect(gatewayUnreachablePayload('boom').dataHeader.resultMessage).toBeNull()
  })
})

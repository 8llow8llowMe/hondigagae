import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api/error'
import { toMessage, unwrap, unwrapVoid } from '@/lib/api/response'
import { fail, gatewayError, ok } from '@/test/api'

describe('unwrap', () => {
  it('성공 응답에서 dataBody 를 꺼낸다', () => {
    expect(unwrap(ok({ id: '1' }), 200)).toEqual({ id: '1' })
  })

  it('success 가 false 면 ApiError 를 던진다', () => {
    expect(() => unwrap(fail('PET_001', '존재하지 않는 반려견입니다.'), 404)).toThrow(ApiError)
  })

  it('success 가 true 여도 dataBody 가 null 이면 ApiError 를 던진다', () => {
    expect(() => unwrap(ok(null), 200)).toThrow(ApiError)
  })

  it('던진 ApiError 에 status 와 resultCode 를 담는다', () => {
    try {
      unwrap(fail('PET_001', '없음'), 404)
      expect.unreachable('예외가 발생해야 한다')
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).status).toBe(404)
      expect((error as ApiError).resultCode).toBe('PET_001')
    }
  })
})

describe('toMessage', () => {
  it('문자열 resultMessage 를 그대로 반환한다', () => {
    expect(toMessage('조건에 맞는 장소가 없습니다.', '폴백')).toBe('조건에 맞는 장소가 없습니다.')
  })

  it('객체 resultMessage 에는 폴백을 반환한다', () => {
    expect(toMessage({ email: '형식이 올바르지 않습니다.' }, '폴백')).toBe('폴백')
  })

  it('null 에는 폴백을 반환한다', () => {
    expect(toMessage(null, '폴백')).toBe('폴백')
  })

  it('공백만 있는 문자열에는 폴백을 반환한다', () => {
    expect(toMessage('   ', '폴백')).toBe('폴백')
  })
})

describe('unwrapVoid', () => {
  it('dataBody 가 null 이어도 success 면 던지지 않는다', () => {
    const response = {
      dataHeader: { success: true, resultCode: null, resultMessage: null },
      dataBody: null,
    }
    expect(() => unwrapVoid(response, 200)).not.toThrow()
  })

  it('success 가 false 면 ApiError 를 던진다', () => {
    expect(() => unwrapVoid(fail('MEMBER_006', '이메일 인증이 완료되지 않았습니다.'), 400)).toThrow(
      ApiError,
    )
  })

  it('던진 ApiError 가 status 와 resultCode 를 보존한다', () => {
    try {
      unwrapVoid(fail('AUTH_015', '로그인 시도가 너무 많습니다.'), 429)
      expect.unreachable('던져야 한다')
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).status).toBe(429)
      expect((error as ApiError).resultCode).toBe('AUTH_015')
    }
  })
})

/**
 * 게이트웨이 레벨 오류 (#203).
 *
 * **`TypeError` 가 아니라 `ApiError` 여야 한다.** `TypeError` 는 `classify()` 를 거치지
 * 못해 `toErrorStatus()` 가 무응답(0)으로 떨어뜨리고, 화면이 서비스 장애를
 * "네트워크 연결 확인" 으로 안내한다. dev 에서 plan-service 503 으로 실제로 관측했다.
 */
describe('공통 래퍼가 아닌 본문', () => {
  const cases = [
    { status: 503, error: 'Service Unavailable', kind: 'temporary', label: '서비스 미기동' },
    { status: 404, error: 'Not Found', kind: 'not-found', label: '라우트 미등록' },
    { status: 403, error: 'Forbidden', kind: 'forbidden', label: '게이트웨이 인증 거절' },
  ] as const

  for (const { status, error, kind, label } of cases) {
    it(`${label}(${status}) 을 ApiError 로 던지고 kind 를 ${kind} 로 정한다`, () => {
      try {
        unwrap(gatewayError(status, error), status)
        expect.unreachable('던져야 한다')
      } catch (thrown) {
        expect(thrown).toBeInstanceOf(ApiError)
        expect((thrown as ApiError).status).toBe(status)
        expect((thrown as ApiError).kind).toBe(kind)
      }
    })
  }

  it('unwrapVoid 도 같은 경로를 탄다', () => {
    try {
      unwrapVoid(gatewayError(503, 'Service Unavailable'), 503)
      expect.unreachable('던져야 한다')
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(ApiError)
      expect((thrown as ApiError).kind).toBe('temporary')
    }
  })

  /*
    게이트웨이 본문의 `error` 는 `"Service Unavailable"` 같은 영문이다. `resultCode` 나
    `rawMessage` 로 실으면 `toMessage()` 가 문자열로 인정해 화면에 영어가 나간다.
  */
  it('게이트웨이의 영문 문구를 resultCode·rawMessage 로 싣지 않는다', () => {
    try {
      unwrap(gatewayError(503, 'Service Unavailable'), 503)
      expect.unreachable('던져야 한다')
    } catch (thrown) {
      expect((thrown as ApiError).resultCode).toBeNull()
      expect(toMessage((thrown as ApiError).rawMessage, '폴백')).toBe('폴백')
    }
  })

  it('본문이 배열·문자열이어도 ApiError 로 떨어진다', () => {
    for (const payload of [[] as unknown, 'Service Unavailable' as unknown]) {
      expect(() => unwrap(payload as never, 502)).toThrow(ApiError)
    }
  })

  /* dataHeader 가 있는 실패는 기존 경로 그대로다 — 회귀 방지 */
  it('서비스가 만든 실패는 resultCode 를 보존한다', () => {
    try {
      unwrap(fail('PLACE_002', '존재하지 않는 장소입니다.'), 404)
      expect.unreachable('던져야 한다')
    } catch (thrown) {
      expect((thrown as ApiError).resultCode).toBe('PLACE_002')
    }
  })
})

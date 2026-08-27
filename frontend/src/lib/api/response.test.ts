import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api/error'
import { toMessage, unwrap, unwrapVoid } from '@/lib/api/response'
import { fail, ok } from '@/test/api'

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

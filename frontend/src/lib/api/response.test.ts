import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api/error'
import { toFieldErrors, toMessage, unwrap } from '@/lib/api/response'
import { fail, failWithFields, ok } from '@/test/api'

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

describe('toFieldErrors', () => {
  it('필드별 검증 오류를 맵으로 정규화한다', () => {
    const response = failWithFields('PET_100', { name: '이름은 필수입니다.' })
    expect(toFieldErrors(response.dataHeader.resultMessage)).toEqual({
      name: '이름은 필수입니다.',
    })
  })

  it('문자열 resultMessage 에는 빈 객체를 반환한다', () => {
    expect(toFieldErrors('요청 값이 올바르지 않습니다.')).toEqual({})
  })

  it('배열에는 빈 객체를 반환한다', () => {
    expect(toFieldErrors(['a', 'b'])).toEqual({})
  })
})

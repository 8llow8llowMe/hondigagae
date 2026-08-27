import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api/error'
import { apiErrorToFormErrors, toFormErrors } from '@/lib/form/field-errors'

const FALLBACK = '요청을 처리하지 못했어요.'

/** 백엔드 ValidationErrorBody 실측 형태 */
function validationBody(errors: { code: string; field: string; message: string }[]) {
  return { message: errors[0]?.message ?? '', errors }
}

describe('toFormErrors — Bean Validation 응답', () => {
  it('errors[] 를 필드 맵으로 만든다', () => {
    const raw = validationBody([
      { code: 'MEMBER_108', field: 'nickname', message: '닉네임은 필수입니다.' },
    ])

    expect(toFormErrors(raw, FALLBACK)).toEqual({
      fields: { nickname: '닉네임은 필수입니다.' },
      form: null,
    })
  })

  it('같은 필드에 오류가 여러 개면 첫 오류만 채택한다', () => {
    // 백엔드가 (선언 순서 → 제약 우선순위 → 메시지)로 이미 정렬해서 내려준다.
    // 뒤 항목으로 덮어쓰면 그 정렬이 무의미해진다 — docs/form-guide.md §4.2
    const raw = validationBody([
      {
        code: 'MEMBER_104',
        field: 'password',
        message: '비밀번호는 8자 이상 20자 이하여야 합니다.',
      },
      {
        code: 'MEMBER_105',
        field: 'password',
        message: '비밀번호는 공백 없이 영문자, 숫자, 특수문자를 각각 1자 이상 포함해야 합니다.',
      },
    ])

    expect(toFormErrors(raw, FALLBACK).fields.password).toBe(
      '비밀번호는 8자 이상 20자 이하여야 합니다.',
    )
  })

  it('필드 오류가 있으면 form 은 null 이다 (중복 노출 방지)', () => {
    const raw = validationBody([
      { code: 'MEMBER_101', field: 'email', message: '이메일은 필수입니다.' },
    ])

    expect(toFormErrors(raw, FALLBACK).form).toBeNull()
  })

  it('field 가 request 면 필드가 아니라 form 으로 보낸다', () => {
    const raw = validationBody([
      { code: 'MEMBER_100', field: 'request', message: '요청 값이 올바르지 않습니다.' },
    ])

    expect(toFormErrors(raw, FALLBACK)).toEqual({
      fields: {},
      form: '요청 값이 올바르지 않습니다.',
    })
  })
})

describe('toFormErrors — 도메인 예외 / 비정상 형태', () => {
  it('문자열 resultMessage 는 form 오류다', () => {
    expect(toFormErrors('이미 가입된 이메일 (a@b.c)입니다.', FALLBACK)).toEqual({
      fields: {},
      form: '이미 가입된 이메일 (a@b.c)입니다.',
    })
  })

  it('null 이면 fallback 을 form 에 넣는다 — 조용히 성공한 것처럼 두지 않는다', () => {
    expect(toFormErrors(null, FALLBACK)).toEqual({ fields: {}, form: FALLBACK })
  })

  it('배열이면 fallback 을 form 에 넣는다', () => {
    expect(toFormErrors(['a'], FALLBACK)).toEqual({ fields: {}, form: FALLBACK })
  })

  it('errors 가 배열이 아니면 message 를 form 으로 쓴다', () => {
    expect(toFormErrors({ message: '무언가 잘못됐습니다.', errors: 'nope' }, FALLBACK)).toEqual({
      fields: {},
      form: '무언가 잘못됐습니다.',
    })
  })

  it('빈 문자열은 값이 아니다 — fallback 을 쓴다', () => {
    expect(toFormErrors('   ', FALLBACK)).toEqual({ fields: {}, form: FALLBACK })
  })
})

describe('apiErrorToFormErrors', () => {
  it('ApiError 의 rawMessage 를 해석한다', () => {
    const error = new ApiError(401, 'AUTH_006', '이메일 또는 비밀번호가 올바르지 않습니다.')

    expect(apiErrorToFormErrors(error, FALLBACK).form).toBe(
      '이메일 또는 비밀번호가 올바르지 않습니다.',
    )
  })

  it('ApiError 가 아니면 fallback 만 준다', () => {
    expect(apiErrorToFormErrors(new Error('boom'), FALLBACK)).toEqual({
      fields: {},
      form: FALLBACK,
    })
  })
})

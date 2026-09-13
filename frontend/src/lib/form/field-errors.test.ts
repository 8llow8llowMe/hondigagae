import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api/error'
import { apiErrorToFormErrors, toFormErrors } from '@/lib/form/field-errors'
import type { ValidationErrorItem } from '@/types/api'

const FALLBACK = '요청을 처리하지 못했어요.'

/**
 * 백엔드 검증 실패 실측 형태 (#491) — dev 실측:
 *
 * ```json
 * {"success":false,"resultCode":"PLACE_102",
 *  "resultMessage":"size는 50 이하만 가능합니다.",
 *  "fieldErrors":[{"code":"PLACE_102","field":"size","message":"size는 50 이하만 가능합니다."}]}
 * ```
 *
 * 대표 메시지는 **항상 문자열**이고 필드 목록은 인자 자리가 따로 있다.
 */
function validationFailure(errors: ValidationErrorItem[]) {
  return { raw: errors[0]?.message ?? '', fieldErrors: errors }
}

describe('toFormErrors — 검증 실패 (fieldErrors)', () => {
  it('fieldErrors 를 필드 맵으로 만든다', () => {
    const { raw, fieldErrors } = validationFailure([
      { code: 'MEMBER_108', field: 'nickname', message: '닉네임은 필수입니다.' },
    ])

    expect(toFormErrors(raw, FALLBACK, fieldErrors)).toEqual({
      fields: { nickname: '닉네임은 필수입니다.' },
      form: null,
    })
  })

  /**
   * 이 이슈(#501)가 난 지점 그대로의 회귀 단정이다.
   *
   * 계약 통일로 `resultMessage` 가 **검증 실패에서도 문자열**이 되면서, 문자열을
   * 먼저 보고 반환하던 옛 구현은 `fields` 를 영원히 비웠다. 대표 메시지가 문자열인
   * 동시에 필드 오류가 살아 있어야 한다.
   */
  it('대표 메시지가 문자열이어도 필드 오류를 읽는다 — 옛 구현이 여기서 죽었다', () => {
    const result = toFormErrors('size는 50 이하만 가능합니다.', FALLBACK, [
      { code: 'PLACE_102', field: 'size', message: 'size는 50 이하만 가능합니다.' },
    ])

    expect(result.fields).toEqual({ size: 'size는 50 이하만 가능합니다.' })
  })

  it('같은 필드에 오류가 여러 개면 첫 오류만 채택한다', () => {
    // 백엔드가 (선언 순서 → 제약 우선순위 → 메시지)로 이미 정렬해서 내려준다.
    // 뒤 항목으로 덮어쓰면 그 정렬이 무의미해진다 — docs/form-guide.md §4.2
    const { raw, fieldErrors } = validationFailure([
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

    expect(toFormErrors(raw, FALLBACK, fieldErrors).fields.password).toBe(
      '비밀번호는 8자 이상 20자 이하여야 합니다.',
    )
  })

  it('필드 오류가 있으면 form 은 null 이다 (중복 노출 방지)', () => {
    const { raw, fieldErrors } = validationFailure([
      { code: 'MEMBER_101', field: 'email', message: '이메일은 필수입니다.' },
    ])

    expect(toFormErrors(raw, FALLBACK, fieldErrors).form).toBeNull()
  })

  it('field 가 request 면 필드가 아니라 form 으로 보낸다', () => {
    const { raw, fieldErrors } = validationFailure([
      { code: 'MEMBER_100', field: 'request', message: '요청 값이 올바르지 않습니다.' },
    ])

    expect(toFormErrors(raw, FALLBACK, fieldErrors)).toEqual({
      fields: {},
      form: '요청 값이 올바르지 않습니다.',
    })
  })

  it('fieldErrors 가 빈 배열이면 대표 메시지를 form 으로 쓴다', () => {
    expect(toFormErrors('요청 값이 올바르지 않습니다.', FALLBACK, [])).toEqual({
      fields: {},
      form: '요청 값이 올바르지 않습니다.',
    })
  })

  it('fieldErrors 항목의 모양이 어긋나면 그 항목만 버린다', () => {
    const result = toFormErrors('요청 값이 올바르지 않습니다.', FALLBACK, [
      { code: 'X', field: 'email' }, // message 없음
      { code: 'MEMBER_108', field: 'nickname', message: '닉네임은 필수입니다.' },
    ])

    expect(result.fields).toEqual({ nickname: '닉네임은 필수입니다.' })
  })
})

describe('toFormErrors — 도메인 예외 / 비정상 형태', () => {
  it('fieldErrors 가 null 인 문자열 실패는 form 오류다', () => {
    expect(toFormErrors('이미 가입된 이메일 (a@b.c)입니다.', FALLBACK, null)).toEqual({
      fields: {},
      form: '이미 가입된 이메일 (a@b.c)입니다.',
    })
  })

  it('null 이면 fallback 을 form 에 넣는다 — 조용히 성공한 것처럼 두지 않는다', () => {
    expect(toFormErrors(null, FALLBACK, null)).toEqual({ fields: {}, form: FALLBACK })
  })

  it('빈 문자열은 값이 아니다 — fallback 을 쓴다', () => {
    expect(toFormErrors('   ', FALLBACK, null)).toEqual({ fields: {}, form: FALLBACK })
  })
})

/**
 * 옛 `{ message, errors }` 봉투. **배포 순서가 어긋난 서버를 위한 하위호환**이다
 * (#501 본문의 배포 순서 주의). 계약이 정착하면 이 describe 와 함께 분기를 지운다.
 */
describe('toFormErrors — 옛 계약 하위호환', () => {
  it('errors[] 를 필드 맵으로 만든다', () => {
    const raw = {
      message: '닉네임은 필수입니다.',
      errors: [{ code: 'MEMBER_108', field: 'nickname', message: '닉네임은 필수입니다.' }],
    }

    expect(toFormErrors(raw, FALLBACK)).toEqual({
      fields: { nickname: '닉네임은 필수입니다.' },
      form: null,
    })
  })

  it('errors 가 배열이 아니면 message 를 form 으로 쓴다', () => {
    expect(toFormErrors({ message: '무언가 잘못됐습니다.', errors: 'nope' }, FALLBACK)).toEqual({
      fields: {},
      form: '무언가 잘못됐습니다.',
    })
  })

  it('배열이면 fallback 을 form 에 넣는다', () => {
    expect(toFormErrors(['a'], FALLBACK)).toEqual({ fields: {}, form: FALLBACK })
  })
})

describe('apiErrorToFormErrors', () => {
  it('ApiError 의 fieldErrors 를 필드 맵으로 옮긴다', () => {
    const error = new ApiError(400, 'PET_101', '반려견 이름은 필수입니다.', [
      { code: 'PET_101', field: 'name', message: '반려견 이름은 필수입니다.' },
    ])

    expect(apiErrorToFormErrors(error, FALLBACK)).toEqual({
      fields: { name: '반려견 이름은 필수입니다.' },
      form: null,
    })
  })

  it('fieldErrors 가 없는 도메인 예외는 form 오류다', () => {
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

import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api/error'
import { type FormErrors, NO_FORM_ERRORS } from '@/lib/form/field-errors'
import { appendRetryAfter, toErrorsWithRetryAfter } from '@/lib/form/retry-after'
import { messages } from '@/lib/messages'

const TOO_FREQUENT = '인증코드 요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.'
const withForm: FormErrors = { fields: {}, form: TOO_FREQUENT }

function tooMany(retryAfterSeconds: number | null): ApiError {
  return new ApiError(429, 'AUTH_003', TOO_FREQUENT, null, retryAfterSeconds)
}

describe('appendRetryAfter', () => {
  it('429 + Retry-After 면 서버 문구 뒤에 한 칸 띄워 남은 시간을 붙인다', () => {
    expect(appendRetryAfter(withForm, tooMany(60)).form).toBe(
      `${TOO_FREQUENT} 1분 뒤 다시 시도할 수 있어요.`,
    )
  })

  it('긴 대기(AUTH_016)는 분으로 쓴다 — 초로 늘어놓지 않는다', () => {
    const form = appendRetryAfter(withForm, tooMany(3540)).form

    expect(form).toContain(messages.form.retryAfter(3540))
    expect(form).toContain('59분 뒤')
    expect(form).not.toContain('3540')
  })

  it('1분 미만은 초로 쓴다', () => {
    expect(appendRetryAfter(withForm, tooMany(42)).form).toBe(
      `${TOO_FREQUENT} 42초 뒤 다시 시도할 수 있어요.`,
    )
  })

  it('헤더가 없으면 지금 문구 그대로다', () => {
    expect(appendRetryAfter(withForm, tooMany(null))).toBe(withForm)
  })

  it('429 가 아니면 붙이지 않는다', () => {
    const error = new ApiError(503, null, '점검 중', null, 120)

    expect(appendRetryAfter({ fields: {}, form: '점검 중' }, error).form).toBe('점검 중')
  })

  it('ApiError 가 아니면 붙이지 않는다', () => {
    expect(appendRetryAfter(withForm, new TypeError('Failed to fetch'))).toBe(withForm)
  })

  it('폼 문구가 없으면 붙일 자리가 없다 — 필드 오류만 있는 결과를 바꾸지 않는다', () => {
    const fieldsOnly: FormErrors = { fields: { email: '이메일은 필수입니다.' }, form: null }

    expect(appendRetryAfter(fieldsOnly, tooMany(60))).toBe(fieldsOnly)
    expect(appendRetryAfter(NO_FORM_ERRORS, tooMany(60))).toBe(NO_FORM_ERRORS)
  })
})

describe('toErrorsWithRetryAfter — useForm 의 toErrors', () => {
  it('공용 매핑 위에 남은 시간을 얹는다', () => {
    expect(toErrorsWithRetryAfter(tooMany(60))).toEqual({
      fields: {},
      form: `${TOO_FREQUENT} 1분 뒤 다시 시도할 수 있어요.`,
    })
  })

  it('로그인 잠금(AUTH_015)도 같은 길이다', () => {
    const locked = new ApiError(
      429,
      'AUTH_015',
      '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.',
      null,
      600,
    )

    expect(toErrorsWithRetryAfter(locked).form).toBe(
      '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요. 10분 뒤 다시 시도할 수 있어요.',
    )
  })

  it('429 가 아니면 공용 매핑과 같다', () => {
    const error = new ApiError(500, null, null)

    expect(toErrorsWithRetryAfter(error)).toEqual({
      fields: {},
      form: messages.form.submitFailed,
    })
  })
})

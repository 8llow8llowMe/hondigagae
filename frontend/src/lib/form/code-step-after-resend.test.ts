import { describe, expect, it } from 'vitest'

import { codeStepAfterResend } from '@/lib/form/code-step-after-resend'
import type { FormErrors } from '@/lib/form/field-errors'

const CODE_MISMATCH = '인증코드가 일치하지 않습니다.'
const TOO_MANY = '잠시 후 다시 요청해주세요.'

/** 틀린 코드(`AUTH_004`)로 제출한 뒤 — 코드 칸 오류 */
const afterMismatch: FormErrors = { fields: { code: CODE_MISMATCH }, form: null }

describe('codeStepAfterResend — 재전송 성공 (#1109)', () => {
  const sent = codeStepAfterResend({ result: 'sent' })

  it('코드 값을 비운다 — 옛 코드는 더 이상 유효하지 않다', () => {
    expect(sent.clearCode).toBe(true)
  })

  it('코드 칸 오류를 걷는다', () => {
    expect(sent.errors(afterMismatch)).toEqual({ fields: {}, form: null })
  })

  it('직전 폼 전체 실패(429 · 5xx 문구)도 걷는다 (#1102)', () => {
    expect(sent.errors({ fields: { code: CODE_MISMATCH }, form: TOO_MANY })).toEqual({
      fields: {},
      form: null,
    })
  })

  it('코드 칸이 아닌 필드 오류는 남긴다 — 재설정의 새 비밀번호 오류는 재전송과 무관하다', () => {
    expect(
      sent.errors({
        fields: { code: CODE_MISMATCH, newPassword: '비밀번호 형식이 올바르지 않습니다.' },
        form: null,
      }),
    ).toEqual({ fields: { newPassword: '비밀번호 형식이 올바르지 않습니다.' }, form: null })
  })

  it('걷을 것이 없으면 같은 객체를 돌려준다 — 렌더를 건너뛴다', () => {
    const clean: FormErrors = { fields: {}, form: null }
    expect(sent.errors(clean)).toBe(clean)
  })
})

describe('codeStepAfterResend — 재전송 실패 (#1109)', () => {
  it('429 면 코드 값을 비우지 않는다 — 새 코드가 오지 않았다', () => {
    const rateLimited = codeStepAfterResend({
      result: 'failed',
      failure: { fields: {}, form: TOO_MANY },
    })
    expect(rateLimited.clearCode).toBe(false)
  })

  it('429 면 코드 칸 오류를 남기고 그 문구를 폼 전체 실패로 얹는다', () => {
    const rateLimited = codeStepAfterResend({
      result: 'failed',
      failure: { fields: {}, form: TOO_MANY },
    })
    expect(rateLimited.errors(afterMismatch)).toEqual({
      fields: { code: CODE_MISMATCH },
      form: TOO_MANY,
    })
  })

  it('5xx · 무응답이면 오류도 값도 그대로다 — 일시 장애는 상태 코드가 세운다', () => {
    const unavailable = codeStepAfterResend({ result: 'failed', failure: null })
    expect(unavailable.clearCode).toBe(false)
    expect(unavailable.errors(afterMismatch)).toBe(afterMismatch)
  })
})

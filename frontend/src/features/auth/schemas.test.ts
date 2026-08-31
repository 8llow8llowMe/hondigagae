import { describe, expect, it } from 'vitest'

import { loginSchema, passwordResetSchema, signupProfileSchema } from '@/features/auth/schemas'
import { validate } from '@/lib/form/validate'
import { messages } from '@/lib/messages'

describe('loginSchema', () => {
  it('이메일 형식을 검사한다', () => {
    const result = validate(loginSchema, { email: 'not-an-email', password: 'x' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.fields.email).toBe(messages.form.emailInvalid)
  })

  it('비밀번호 형식은 검사하지 않는다 — 기존 계정이 로그인하지 못하게 된다', () => {
    const result = validate(loginSchema, { email: 'a@b.c', password: 'short' })

    expect(result.ok).toBe(true)
  })
})

describe('signupProfileSchema — 비밀번호', () => {
  it('8자 미만이면 길이 오류를 먼저 낸다 (MEMBER_104)', () => {
    const result = validate(signupProfileSchema, {
      password: 'ab1!',
      name: '홍길동',
      nickname: '길동짱',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.fields.password).toBe(messages.form.passwordLength)
  })

  it('길이는 맞고 문자 구성이 틀리면 패턴 오류를 낸다 (MEMBER_105)', () => {
    const result = validate(signupProfileSchema, {
      password: 'abcdefghij',
      name: '홍길동',
      nickname: '길동짱',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.fields.password).toBe(messages.form.passwordPattern)
  })

  it('공백이 섞이면 패턴 오류다', () => {
    const result = validate(signupProfileSchema, {
      password: 'abcd 123!',
      name: '홍길동',
      nickname: '길동짱',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.fields.password).toBe(messages.form.passwordPattern)
  })

  it('영문자+숫자+특수문자 8~20자를 통과시킨다', () => {
    const result = validate(signupProfileSchema, {
      password: 'password123!',
      name: '홍길동',
      nickname: '길동짱',
    })

    expect(result.ok).toBe(true)
  })

  it('이름·닉네임은 10자를 넘으면 오류다', () => {
    const result = validate(signupProfileSchema, {
      password: 'password123!',
      name: '가나다라마바사아자차카',
      nickname: '길동짱',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.fields.name).toBe(messages.form.nameLength)
  })
})

describe('passwordResetSchema — 회원가입과 같은 비밀번호 규칙이다', () => {
  /**
   * **두 스키마가 갈리면 같은 비밀번호가 화면에 따라 통과·거부로 나뉜다.**
   * 정규식은 `lib/form/password-pattern.ts` 하나를 공유하고(복제본을 만들지 않는다),
   * 길이·구성 판정이 실제로 같은지를 여기서 고정한다 — 정본 D7.
   */
  const CASES = ['ab1!', 'password123!', 'password', 'password123', 'pass word123!', 'a'.repeat(21)]

  it.each(CASES)('회원가입과 판정이 같다: %s', (password) => {
    const reset = validate(passwordResetSchema, { code: 'A2B3C4D5', newPassword: password })
    const signup = validate(signupProfileSchema, { password, name: '홍', nickname: '길동' })

    expect(reset.ok).toBe(signup.ok)
    if (!reset.ok && !signup.ok) {
      expect(reset.errors.fields.newPassword).toBe(signup.errors.fields.password)
    }
  })

  it('인증코드는 필수다 (AUTH_104)', () => {
    const result = validate(passwordResetSchema, { code: '', newPassword: 'password123!' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.fields.code).toBe(messages.form.codeRequired)
  })

  it('필드명이 newPassword 다 — 요청 DTO 와 같아야 서버 오류가 붙는다', () => {
    const result = validate(passwordResetSchema, { code: 'A2B3C4D5', newPassword: 'short' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(Object.keys(result.errors.fields)).toEqual(['newPassword'])
  })
})

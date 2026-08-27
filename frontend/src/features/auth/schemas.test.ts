import { describe, expect, it } from 'vitest'

import { loginSchema, signupProfileSchema } from '@/features/auth/schemas'
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

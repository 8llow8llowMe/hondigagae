import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { signupProfileSchema } from '@/features/auth/schemas'
import {
  PasswordFormFields,
  type PasswordFormFieldsProps,
} from '@/features/member/password-form-fields'
import { passwordChangeSchema, passwordSetupSchema } from '@/features/member/schemas'
import { NO_FORM_ERRORS } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'

function render(overrides: Partial<PasswordFormFieldsProps> = {}) {
  return renderToStaticMarkup(
    createElement(PasswordFormFields, {
      mode: 'change',
      currentPassword: '',
      newPassword: '',
      errors: NO_FORM_ERRORS,
      submitting: false,
      onCurrentPasswordChange: () => undefined,
      onNewPasswordChange: () => undefined,
      onSubmit: () => undefined,
      ...overrides,
    }),
  )
}

describe('PasswordFormFields — 모드별 필드 구성', () => {
  it('변경 모드는 현재 비밀번호를 묻는다', () => {
    const markup = render({ mode: 'change' })

    expect(markup).toContain(messages.member.currentPasswordLabel)
    expect(markup).toContain(messages.member.passwordChangeSubmit)
  })

  it('최초 설정 모드는 현재 비밀번호를 묻지 않는다 — 계정에 비밀번호가 없다', () => {
    const markup = render({ mode: 'setup' })

    expect(markup).not.toContain(messages.member.currentPasswordLabel)
    expect(markup).toContain(messages.member.passwordSetupDescription)
    expect(markup).toContain(messages.member.passwordSetupSubmit)
  })

  /**
   * 비밀번호 관리자가 두 칸을 구분하지 못하면 저장된 값을 새 비밀번호 칸에 채운다.
   * `autoComplete` 가 그 구분의 유일한 신호다.
   */
  it('현재/새 비밀번호의 autoComplete 가 갈린다', () => {
    const markup = render({ mode: 'change' })

    // renderToStaticMarkup 은 이 속성을 camelCase 그대로 내보낸다 (브라우저는 대소문자를
    // 가리지 않는다). 실제 출력에 맞춰 단언한다
    expect(markup).toContain('autoComplete="current-password"')
    expect(markup).toContain('autoComplete="new-password"')
  })

  it('필드 오류는 aria-describedby 로 입력과 연결된다', () => {
    const markup = render({
      errors: { fields: { newPassword: messages.form.passwordLength }, form: null },
    })

    expect(markup).toContain('aria-describedby="newPassword-error"')
    expect(markup).toContain(messages.form.passwordLength)
  })

  it('폼 전체 오류는 role="alert" 로 알린다', () => {
    const markup = render({ errors: { fields: {}, form: '비밀번호가 일치하지 않습니다.' } })

    expect(markup).toContain('role="alert"')
    expect(markup).toContain('비밀번호가 일치하지 않습니다.')
  })
})

/**
 * **회원가입과 같은 규칙임을 고정한다** (D7).
 *
 * 백엔드는 `MemberGeneralSignupRequest` · `MemberPasswordChangeRequest` ·
 * `MemberPasswordSetupRequest` 의 `@Pattern` 이 문자 하나까지 같다. 세 곳이 갈리면
 * 가입은 되는데 변경은 거부되는 비밀번호가 생긴다.
 */
describe('새 비밀번호 규칙 — 회원가입과 같아야 한다', () => {
  const CASES = [
    { label: '8자 미만', value: 'Ab1!' },
    { label: '20자 초과', value: `Ab1!${'x'.repeat(20)}` },
    { label: '특수문자 없음', value: 'abcd1234' },
    { label: '숫자 없음', value: 'abcdefg!' },
    { label: '영문자 없음', value: '12345678!' },
    { label: '공백 포함', value: 'Ab 1234!' },
  ]

  it.each(CASES)('$label 은 세 스키마 모두에서 거부된다', ({ value }) => {
    expect(
      signupProfileSchema.safeParse({ password: value, name: '홍', nickname: '길' }).success,
    ).toBe(false)
    expect(
      passwordChangeSchema.safeParse({ currentPassword: 'old', newPassword: value }).success,
    ).toBe(false)
    expect(passwordSetupSchema.safeParse({ currentPassword: '', newPassword: value }).success).toBe(
      false,
    )
  })

  it('유효한 비밀번호는 세 스키마 모두에서 통과한다', () => {
    const value = 'password123!'

    expect(
      signupProfileSchema.safeParse({ password: value, name: '홍', nickname: '길' }).success,
    ).toBe(true)
    expect(
      passwordChangeSchema.safeParse({ currentPassword: 'old', newPassword: value }).success,
    ).toBe(true)
    expect(passwordSetupSchema.safeParse({ currentPassword: '', newPassword: value }).success).toBe(
      true,
    )
  })

  /**
   * 변경 폼은 **현재 비밀번호의 형식을 검사하지 않는다.** 기존 계정의 비밀번호가 지금
   * 규칙보다 먼저 만들어졌을 수 있어, 형식으로 막으면 정상 계정이 변경을 못 한다.
   */
  it('현재 비밀번호에는 형식을 요구하지 않는다 — 비어 있을 때만 막는다', () => {
    expect(
      passwordChangeSchema.safeParse({ currentPassword: 'old', newPassword: 'password123!' })
        .success,
    ).toBe(true)
    expect(
      passwordChangeSchema.safeParse({ currentPassword: '', newPassword: 'password123!' }).success,
    ).toBe(false)
  })

  it('최초 설정은 현재 비밀번호를 요구하지 않는다', () => {
    expect(
      passwordSetupSchema.safeParse({ currentPassword: '', newPassword: 'password123!' }).success,
    ).toBe(true)
  })
})

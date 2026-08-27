import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { LoginFormFields, type LoginFormFieldsProps } from '@/features/auth/login-form'
import { NO_FORM_ERRORS } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'

function render(overrides: Partial<LoginFormFieldsProps> = {}) {
  const props: LoginFormFieldsProps = {
    values: { email: '', password: '' },
    errors: NO_FORM_ERRORS,
    errorStatus: null,
    isSubmitting: false,
    showPassword: false,
    onValueChange: () => undefined,
    onTogglePassword: () => undefined,
    onSubmit: () => undefined,
    onRetry: () => undefined,
    ...overrides,
  }

  return renderToStaticMarkup(createElement(LoginFormFields, props))
}

describe('LoginFormFields', () => {
  it('이메일·비밀번호 label 을 렌더한다', () => {
    const markup = render()

    expect(markup).toContain(messages.auth.emailLabel)
    expect(markup).toContain(messages.auth.passwordLabel)
    // React 19 renderToStaticMarkup 은 autoComplete 를 camelCase 그대로 직렬화한다
    // (브라우저 DOM 파서는 대소문자를 구분하지 않으므로 런타임 동작은 같다)
    expect(markup).toContain('autoComplete="username"')
    expect(markup).toContain('autoComplete="current-password"')
  })

  it('필드 오류를 aria-invalid 와 함께 렌더한다', () => {
    const markup = render({
      errors: { fields: { email: messages.form.emailInvalid }, form: null },
    })

    expect(markup).toContain(messages.form.emailInvalid)
    expect(markup).toContain('aria-invalid="true"')
  })

  it('폼 전체 오류를 role=alert 로 렌더한다', () => {
    const markup = render({
      errors: { fields: {}, form: '이메일 또는 비밀번호가 올바르지 않습니다.' },
    })

    expect(markup).toContain('role="alert"')
    expect(markup).toContain('이메일 또는 비밀번호가 올바르지 않습니다.')
  })

  it('제출 중에는 버튼이 비활성이고 aria-busy 다', () => {
    const markup = render({ isSubmitting: true })

    expect(markup).toContain('disabled')
    expect(markup).toContain('aria-busy="true"')
    expect(markup).toContain(messages.auth.loginSubmitting)
  })

  it('비밀번호 표시 토글이 aria-pressed 를 반영한다', () => {
    expect(render({ showPassword: false })).toContain('aria-pressed="false"')
    expect(render({ showPassword: true })).toContain('aria-pressed="true"')
  })

  it('5xx 면 ErrorState 와 재시도 버튼을 렌더한다', () => {
    const markup = render({ errorStatus: 500 })

    expect(markup).toContain(messages.common.temporaryErrorTitle)
    expect(markup).toContain(messages.common.retry)
  })

  it('무응답이면 ErrorState 와 재시도 버튼을 렌더한다', () => {
    // NO_RESPONSE_STATUS(0) — classify(0) 은 'temporary' 다
    const markup = render({ errorStatus: 0 })

    expect(markup).toContain(messages.common.temporaryErrorTitle)
    expect(markup).toContain(messages.common.retry)
  })

  it('429 면 재시도 버튼 없이 서버 문구를 role=alert 로 렌더한다', () => {
    const markup = render({
      errorStatus: 429,
      errors: { fields: {}, form: '너무 많은 시도가 있었어요. 잠시 후 다시 이용해 주세요.' },
    })

    expect(markup).toContain('role="alert"')
    expect(markup).toContain('너무 많은 시도가 있었어요. 잠시 후 다시 이용해 주세요.')
    expect(markup).not.toContain(messages.common.retry)
    expect(markup).not.toContain(messages.common.temporaryErrorTitle)
  })
})

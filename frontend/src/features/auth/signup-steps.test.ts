import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { CodeStep, EmailStep, ProfileStep } from '@/features/auth/signup-steps'
import { NO_FORM_ERRORS } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'

const noop = () => undefined

describe('EmailStep', () => {
  it('단계 표시를 텍스트로 렌더한다 — 색·아이콘만으로 표현하지 않는다', () => {
    const markup = renderToStaticMarkup(
      createElement(EmailStep, {
        values: { email: '' },
        errors: NO_FORM_ERRORS,
        errorStatus: null,
        submitting: false,
        onValueChange: noop,
        onSubmit: noop,
        onRetry: noop,
      }),
    )

    expect(markup).toContain(messages.auth.stepOf(1, 3))
    expect(markup).toContain('autoComplete="username"')
  })

  it('5xx 면 ErrorState 와 재시도 버튼을 렌더한다', () => {
    const markup = renderToStaticMarkup(
      createElement(EmailStep, {
        values: { email: '' },
        errors: NO_FORM_ERRORS,
        errorStatus: 500,
        submitting: false,
        onValueChange: noop,
        onSubmit: noop,
        onRetry: noop,
      }),
    )

    expect(markup).toContain(messages.common.temporaryErrorTitle)
    expect(markup).toContain(messages.common.retry)
  })

  it('무응답(0)이면 ErrorState 를 렌더한다', () => {
    const markup = renderToStaticMarkup(
      createElement(EmailStep, {
        values: { email: '' },
        errors: NO_FORM_ERRORS,
        errorStatus: 0,
        submitting: false,
        onValueChange: noop,
        onSubmit: noop,
        onRetry: noop,
      }),
    )

    expect(markup).toContain(messages.common.temporaryErrorTitle)
  })

  it('429 는 ErrorState 를 쓰지 않고 서버 문구를 role=alert 로 렌더한다', () => {
    const markup = renderToStaticMarkup(
      createElement(EmailStep, {
        values: { email: '' },
        errors: { fields: {}, form: '너무 많은 시도가 있었어요. 잠시 후 다시 이용해 주세요.' },
        errorStatus: 429,
        submitting: false,
        onValueChange: noop,
        onSubmit: noop,
        onRetry: noop,
      }),
    )

    expect(markup).toContain('role="alert"')
    expect(markup).toContain('너무 많은 시도가 있었어요. 잠시 후 다시 이용해 주세요.')
    expect(markup).not.toContain(messages.common.temporaryErrorTitle)
  })
})

describe('CodeStep', () => {
  it('쿨다운 중에는 재전송 버튼이 비활성이고 남은 초를 보여준다', () => {
    const markup = renderToStaticMarkup(
      createElement(CodeStep, {
        email: 'a@b.c',
        values: { code: '' },
        errors: NO_FORM_ERRORS,
        errorStatus: null,
        submitting: false,
        cooldownSeconds: 42,
        onValueChange: noop,
        onSubmit: noop,
        resending: false,
        onResend: noop,
        onChangeEmail: noop,
        onRetry: noop,
      }),
    )

    expect(markup).toContain(messages.auth.resendCooldown(42))
    expect(markup).toContain('disabled')
    // 백엔드 예시가 A3K7MP2X 로 영숫자 혼합이라 numeric 이면 영문자를 못 넣는다
    expect(markup).toContain('autoComplete="one-time-code"')
    expect(markup).not.toContain('inputMode="numeric"')
  })

  it('쿨다운이 끝나면 재전송이 활성이다', () => {
    const markup = renderToStaticMarkup(
      createElement(CodeStep, {
        email: 'a@b.c',
        values: { code: '' },
        errors: NO_FORM_ERRORS,
        errorStatus: null,
        submitting: false,
        cooldownSeconds: 0,
        onValueChange: noop,
        onSubmit: noop,
        resending: false,
        onResend: noop,
        onChangeEmail: noop,
        onRetry: noop,
      }),
    )

    expect(markup).toContain(messages.auth.resendCode)
  })

  it('코드 오류를 필드 에러로 렌더한다', () => {
    const markup = renderToStaticMarkup(
      createElement(CodeStep, {
        email: 'a@b.c',
        values: { code: 'WRONG' },
        errors: { fields: { code: '인증코드가 일치하지 않습니다.' }, form: null },
        errorStatus: 400,
        submitting: false,
        cooldownSeconds: 0,
        onValueChange: noop,
        onSubmit: noop,
        resending: false,
        onResend: noop,
        onChangeEmail: noop,
        onRetry: noop,
      }),
    )

    expect(markup).toContain('인증코드가 일치하지 않습니다.')
    expect(markup).toContain('aria-invalid="true"')
  })

  it('5xx 면 ErrorState 와 재시도 버튼을 렌더한다', () => {
    const markup = renderToStaticMarkup(
      createElement(CodeStep, {
        email: 'a@b.c',
        values: { code: '' },
        errors: NO_FORM_ERRORS,
        errorStatus: 503,
        submitting: false,
        cooldownSeconds: 0,
        onValueChange: noop,
        onSubmit: noop,
        resending: false,
        onResend: noop,
        onChangeEmail: noop,
        onRetry: noop,
      }),
    )

    expect(markup).toContain(messages.common.temporaryErrorTitle)
    expect(markup).toContain(messages.common.retry)
  })

  it('429(쿨다운) 는 ErrorState 를 쓰지 않고 서버 문구를 role=alert 로 렌더하며 재전송은 비활성 유지한다', () => {
    const markup = renderToStaticMarkup(
      createElement(CodeStep, {
        email: 'a@b.c',
        values: { code: '' },
        errors: { fields: {}, form: '너무 많은 시도가 있었어요. 잠시 후 다시 이용해 주세요.' },
        errorStatus: 429,
        submitting: false,
        cooldownSeconds: 60,
        onValueChange: noop,
        onSubmit: noop,
        resending: false,
        onResend: noop,
        onChangeEmail: noop,
        onRetry: noop,
      }),
    )

    expect(markup).toContain('role="alert"')
    expect(markup).toContain('너무 많은 시도가 있었어요. 잠시 후 다시 이용해 주세요.')
    expect(markup).not.toContain(messages.common.temporaryErrorTitle)
    expect(markup).toContain('disabled')
  })

  it('재전송이 인플라이트면 쿨다운이 끝났어도 버튼이 비활성이고 aria-busy 다', () => {
    const markup = renderToStaticMarkup(
      createElement(CodeStep, {
        email: 'a@b.c',
        values: { code: '' },
        errors: NO_FORM_ERRORS,
        errorStatus: null,
        submitting: false,
        cooldownSeconds: 0,
        resending: true,
        onValueChange: noop,
        onSubmit: noop,
        onResend: noop,
        onChangeEmail: noop,
        onRetry: noop,
      }),
    )

    expect(markup).toContain('disabled')
    expect(markup).toContain('aria-busy="true"')
  })

  it('notice 가 있으면 role=status 로 렌더한다 — 1단계 성공 안내', () => {
    const markup = renderToStaticMarkup(
      createElement(CodeStep, {
        email: 'a@b.c',
        values: { code: '' },
        errors: NO_FORM_ERRORS,
        errorStatus: null,
        submitting: false,
        cooldownSeconds: 0,
        resending: false,
        notice: messages.auth.codeSent,
        onValueChange: noop,
        onSubmit: noop,
        onResend: noop,
        onChangeEmail: noop,
        onRetry: noop,
      }),
    )

    expect(markup).toContain(messages.auth.codeSent)
    expect(markup).toContain('role="status"')
  })

  it('notice 가 없으면 안내를 렌더하지 않는다', () => {
    const markup = renderToStaticMarkup(
      createElement(CodeStep, {
        email: 'a@b.c',
        values: { code: '' },
        errors: NO_FORM_ERRORS,
        errorStatus: null,
        submitting: false,
        cooldownSeconds: 0,
        resending: false,
        onValueChange: noop,
        onSubmit: noop,
        onResend: noop,
        onChangeEmail: noop,
        onRetry: noop,
      }),
    )

    expect(markup).not.toContain('role="status"')
  })
})

describe('ProfileStep', () => {
  it('비밀번호·이름·닉네임을 렌더한다', () => {
    const markup = renderToStaticMarkup(
      createElement(ProfileStep, {
        values: { password: '', name: '', nickname: '' },
        errors: NO_FORM_ERRORS,
        errorStatus: null,
        submitting: false,
        duplicateEmail: null,
        returnTo: '/',
        onValueChange: noop,
        onSubmit: noop,
        onRetry: noop,
      }),
    )

    expect(markup).toContain(messages.auth.passwordLabel)
    expect(markup).toContain(messages.auth.nameLabel)
    expect(markup).toContain(messages.auth.nicknameLabel)
    expect(markup).toContain('autoComplete="new-password"')
  })

  it('이메일 중복이면 로그인 링크를 함께 준다', () => {
    const markup = renderToStaticMarkup(
      createElement(ProfileStep, {
        values: { password: '', name: '', nickname: '' },
        errors: { fields: {}, form: '이미 가입된 이메일 (a@b.c)입니다.' },
        errorStatus: 409,
        submitting: false,
        duplicateEmail: 'a@b.c',
        returnTo: '/',
        onValueChange: noop,
        onSubmit: noop,
        onRetry: noop,
      }),
    )

    expect(markup).toContain('이미 가입된 이메일 (a@b.c)입니다.')
    expect(markup).toContain(messages.auth.toLogin)
    expect(markup).toContain('/login?')
  })

  it('5xx 면 ErrorState 와 재시도 버튼을 렌더한다', () => {
    const markup = renderToStaticMarkup(
      createElement(ProfileStep, {
        values: { password: '', name: '', nickname: '' },
        errors: NO_FORM_ERRORS,
        errorStatus: 500,
        submitting: false,
        duplicateEmail: null,
        returnTo: '/',
        onValueChange: noop,
        onSubmit: noop,
        onRetry: noop,
      }),
    )

    expect(markup).toContain(messages.common.temporaryErrorTitle)
    expect(markup).toContain(messages.common.retry)
  })

  it('notice 가 있으면 role=status 로 렌더한다 — 2단계 성공 안내', () => {
    const markup = renderToStaticMarkup(
      createElement(ProfileStep, {
        values: { password: '', name: '', nickname: '' },
        errors: NO_FORM_ERRORS,
        errorStatus: null,
        submitting: false,
        duplicateEmail: null,
        returnTo: '/',
        notice: messages.auth.codeVerified,
        onValueChange: noop,
        onSubmit: noop,
        onRetry: noop,
      }),
    )

    expect(markup).toContain(messages.auth.codeVerified)
    expect(markup).toContain('role="status"')
  })

  it('notice 가 없으면 안내를 렌더하지 않는다', () => {
    const markup = renderToStaticMarkup(
      createElement(ProfileStep, {
        values: { password: '', name: '', nickname: '' },
        errors: NO_FORM_ERRORS,
        errorStatus: null,
        submitting: false,
        duplicateEmail: null,
        returnTo: '/',
        onValueChange: noop,
        onSubmit: noop,
        onRetry: noop,
      }),
    )

    expect(markup).not.toContain('role="status"')
  })
})

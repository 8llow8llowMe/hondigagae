import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  LoginDivider,
  LoginFormFields,
  type LoginFormFieldsProps,
  LoginSignupPrompt,
} from '@/features/auth/login-form'
import { NO_FORM_ERRORS } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'

function render(overrides: Partial<LoginFormFieldsProps> = {}) {
  const props: LoginFormFieldsProps = {
    values: { email: '', password: '' },
    errors: NO_FORM_ERRORS,
    errorStatus: null,
    submitting: false,
    remember: false,
    capsLock: false,
    onValueChange: () => undefined,
    onRememberChange: () => undefined,
    onCapsLockChange: () => undefined,
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
    const markup = render({ submitting: true })

    expect(markup).toContain('disabled')
    expect(markup).toContain('aria-busy="true"')
    expect(markup).toContain(messages.auth.loginSubmitting)
  })

  it('비밀번호 칸은 공용 PasswordInput 이다 — 가려진 채 시작하고 토글이 칸을 가리킨다', () => {
    // 누른 뒤의 상태는 `password-input.test.ts` 의 `passwordReveal` 이 본다 (#1080)
    const markup = render()

    expect(markup).toMatch(/id="password"[^>]*type="password"|type="password"[^>]*id="password"/)
    expect(markup).toContain('aria-pressed="false"')
    expect(markup).toContain('aria-controls="password"')
    expect(markup).toContain(`aria-label="${messages.auth.passwordShow}"`)
  })

  it('5xx 면 ErrorState 와 재시도 버튼을 렌더한다', () => {
    const markup = render({ errorStatus: 500 })

    expect(markup).toContain(messages.common.temporaryErrorTitle)
    expect(markup).toContain(messages.common.retry)
  })

  it('5xx 면 서버 문구 알림을 함께 세우지 않는다 — 같은 실패를 두 번 말하지 않는다 (#1079)', () => {
    // `apiErrorToFormErrors` 는 5xx 에도 `form` 을 채운다. 예전에는 그것이 FormAlert 로 또 섰다
    const markup = render({
      errorStatus: 503,
      errors: { fields: {}, form: '서비스를 일시적으로 사용할 수 없습니다.' },
    })

    expect(markup).toContain(messages.common.temporaryErrorTitle)
    expect(markup).not.toContain('서비스를 일시적으로 사용할 수 없습니다.')
    expect(markup).not.toContain('data-form-alert')
    expect(markup).toContain('data-form-temporary-error')
    // 폼 안이라 ErrorState 가 자기 여백(세로 48)을 갖지 않는다 — 375 에서 폼을 밀던 몫
    expect(markup).not.toContain('py-12')
  })

  it('무응답이면 ErrorState 와 재시도 버튼을 렌더한다', () => {
    // NO_RESPONSE_STATUS(0) — classify(0) 은 'temporary' 다
    const markup = render({ errorStatus: 0 })

    expect(markup).toContain(messages.common.temporaryErrorTitle)
    expect(markup).toContain(messages.common.retry)
  })

  it('5xx 여도 입력 필드는 그대로 남아있다 — 폼을 대체하지 않고 위에 얹는다', () => {
    // 이슈 #24 최종 리뷰 I1 회귀 방지: early return 으로 폼을 통째로 갈아치우면
    // 로그인-세부명세.md D4 "폼은 그대로 유지"를 어기고 입력을 고칠 수단이 없어진다
    const markup = render({ errorStatus: 500, values: { email: 'typo@example', password: '' } })

    expect(markup).toContain('id="email"')
    expect(markup).toContain('id="password"')
    expect(markup).toContain(messages.auth.emailLabel)
    expect(markup).toContain(messages.auth.passwordLabel)
    expect(markup).toContain('typo@example')
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

  it('비밀번호 아래 한 줄이 기억하기 → 비밀번호 찾기 → 로그인 버튼 순서다 (#1081)', () => {
    const markup = render()

    const password = markup.indexOf('id="password"')
    const remember = markup.indexOf(messages.auth.rememberEmail)
    const forgot = markup.indexOf(messages.auth.forgotPassword)
    const submit = markup.indexOf('type="submit"')

    expect(password).toBeGreaterThan(-1)
    expect(remember).toBeGreaterThan(password)
    expect(forgot).toBeGreaterThan(remember)
    expect(submit).toBeGreaterThan(forgot)
    expect(markup).toContain('href="/password/reset"')
  })

  it('이메일 기억하기는 체크박스이고 기본은 꺼져 있다', () => {
    const markup = render()

    expect(markup).toMatch(/<input type="checkbox" id="remember-email"(?![^>]*checked)[^>]*>/)
    expect(markup).not.toContain(messages.auth.rememberEmailCaption)
  })

  it('켜면 체크되고 공용 기기 캡션이 뜬다', () => {
    const markup = render({ remember: true })

    expect(markup).toMatch(/<input type="checkbox" id="remember-email"[^>]*checked=""/)
    expect(markup).toContain(messages.auth.rememberEmailCaption)
  })

  it('Caps Lock 이 켜져 있으면 비밀번호 칸에 안내를 띄운다', () => {
    expect(render({ capsLock: false })).not.toContain(messages.auth.capsLockOn)
    expect(render({ capsLock: true })).toContain(messages.auth.capsLockOn)
  })

  it('모바일 키보드 엔터 자리가 이메일은 next · 비밀번호는 done 이다', () => {
    const markup = render()

    expect(markup).toMatch(/id="email"[^>]*enterKeyHint="next"/)
    expect(markup).toMatch(/id="password"[^>]*enterKeyHint="done"/)
  })
})

describe('LoginFormFields — 제출 중 (#1084 L2)', () => {
  it('다시 낸 요청이 도는 동안 직전 401 알림을 걷는다', () => {
    const failed = {
      errors: { fields: {}, form: '이메일 또는 비밀번호가 올바르지 않습니다.' },
      errorStatus: 401,
    }

    expect(render(failed)).toContain('이메일 또는 비밀번호가 올바르지 않습니다.')
    expect(render({ ...failed, submitting: true })).not.toContain(
      '이메일 또는 비밀번호가 올바르지 않습니다.',
    )
  })

  it('재시도한 5xx 도 도는 동안에는 일시 장애를 걷는다 — 눌렸는지가 보인다', () => {
    expect(render({ errorStatus: 503, submitting: true })).not.toContain(
      messages.common.temporaryErrorTitle,
    )
  })
})

describe('LoginDivider', () => {
  it('"또는" 만 읽히고 선은 숨긴다', () => {
    const markup = renderToStaticMarkup(createElement(LoginDivider))

    expect(markup).toContain(messages.auth.loginDivider)
    expect(markup.match(/aria-hidden="true"/g)).toHaveLength(2)
  })
})

describe('LoginSignupPrompt', () => {
  it('안내 문구와 returnTo 를 문 회원가입 링크를 렌더한다', () => {
    const markup = renderToStaticMarkup(createElement(LoginSignupPrompt, { returnTo: '/plans/1' }))

    expect(markup).toContain(messages.auth.signupPrompt)
    expect(markup).toContain('href="/signup?returnTo=%2Fplans%2F1"')
    expect(markup).toContain(messages.auth.toSignup)
    expect(markup).toContain('min-h-11')
  })
})

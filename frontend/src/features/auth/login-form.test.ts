import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import {
  LoginDivider,
  LoginFooterLinks,
  LoginFormFields,
  type LoginFormFieldsProps,
  LoginMethods,
} from '@/features/auth/login-form'
import { NO_FORM_ERRORS } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'

/** `Field` 의 필수 표시 — 라벨 안 `aria-hidden` `*` (`field.tsx`). 클래스가 아니라 모양으로 찾는다 */
const REQUIRED_MARK = /<span aria-hidden="true"[^>]*>\*<\/span>/

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

  /*
    401 은 포커스가 비밀번호 칸으로 간다(로그인 D4) — `LoginForm` 이 `announce="live"` 를 넘겨
    알림이 유일한 낭독 경로가 된다 (#1102).
  */
  it('401 폼 전체 오류는 role=alert 로 렌더한다 — 포커스가 비밀번호 칸으로 가는 갈래', () => {
    const markup = render({
      errorStatus: 401,
      announce: 'live',
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

  /*
    429 는 제출 실패 뒤 포커스가 알림으로 온다(#1078) — 포커스가 낭독 경로라 `role="alert"` 를
    떼야 같은 문구를 두 번 읽지 않는다 (#1102). `announce` 를 생략하면 그 판정이 기본값이다.
  */
  it('429 면 재시도 버튼 없이 서버 문구 알림을 렌더하고, 포커스가 읽으므로 role=alert 가 없다', () => {
    const markup = render({
      errorStatus: 429,
      errors: { fields: {}, form: '너무 많은 시도가 있었어요. 잠시 후 다시 이용해 주세요.' },
    })

    expect(markup).toContain('data-form-alert=""')
    expect(markup).not.toContain('role="alert"')
    expect(markup).toContain('너무 많은 시도가 있었어요. 잠시 후 다시 이용해 주세요.')
    expect(markup).not.toContain(messages.common.retry)
    expect(markup).not.toContain(messages.common.temporaryErrorTitle)
  })

  /*
    비밀번호 찾기는 폼 아래 링크 줄로 옮겼다 (#1283 L3) — 폼 안에는 기억하기만 남는다.
  */
  it('비밀번호 아래가 기억하기 → 로그인 버튼 순서이고 비밀번호 찾기는 폼 밖이다', () => {
    const markup = render()

    const password = markup.indexOf('id="password"')
    const remember = markup.indexOf(messages.auth.rememberEmail)
    const submit = markup.indexOf('type="submit"')

    expect(password).toBeGreaterThan(-1)
    expect(remember).toBeGreaterThan(password)
    expect(submit).toBeGreaterThan(remember)
    expect(markup).not.toContain('href="/password/reset"')
  })

  /* 칸 둘이 다 필수인 폼의 `*` 는 정보가 없다 (#1283 C5) */
  it('필수 표시(*)를 그리지 않는다', () => {
    expect(render()).not.toMatch(REQUIRED_MARK)
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
  it('"또는 이메일로 로그인" 만 읽히고 선은 숨긴다', () => {
    const markup = renderToStaticMarkup(createElement(LoginDivider))

    expect(markup).toContain(messages.auth.loginDivider)
    expect(markup.match(/aria-hidden="true"/g)).toHaveLength(2)
  })
})

describe('LoginFooterLinks — 폼 아래 링크 줄 (#1283 L3 · F1)', () => {
  const markup = renderToStaticMarkup(createElement(LoginFooterLinks, { returnTo: '/plans/1' }))

  it('비밀번호 찾기 → 회원가입 순서로 한 줄에 선다', () => {
    const forgot = markup.indexOf('href="/password/reset"')
    const signup = markup.indexOf('href="/signup?returnTo=%2Fplans%2F1"')

    expect(forgot).toBeGreaterThan(-1)
    expect(signup).toBeGreaterThan(forgot)
    expect(markup).toContain(messages.auth.forgotPassword)
    expect(markup).toContain(messages.auth.toSignup)
  })

  /* 재설정이 끝나면 어차피 로그인부터 다시 한다 — 비밀번호찾기 정본 D3 */
  it('비밀번호 찾기는 returnTo 를 싣지 않고, 회원가입은 싣는다', () => {
    expect(markup).not.toContain('href="/password/reset?')
    expect(markup).toContain('href="/signup?returnTo=%2Fplans%2F1"')
  })

  it('두 링크와 안내 버튼 모두 누르는 자리가 44 다', () => {
    expect(markup.match(/min-h-11/g)).toHaveLength(3)
  })

  it('이메일 안내는 이동하지 않는 버튼이다 — 닫힌 시트는 그리지 않는다', () => {
    expect(markup).toMatch(/<button type="button"[^>]*>이메일이 기억나지 않나요\?<\/button>/)
    expect(markup).not.toContain('role="dialog"')
  })
})

describe('LoginMethods — 소셜이 이메일 폼 위다 (#1283 L1, 로그인-세부명세 D13)', () => {
  const markup = renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      createElement(LoginMethods, { returnTo: '/', initialEmail: '' }),
    ),
  )

  it('카카오 → 네이버 → "또는 이메일로 로그인" → 이메일 폼 → 하단 링크 줄 순서다', () => {
    const order = [
      messages.auth.socialLoginLabel('카카오'),
      messages.auth.socialLoginLabel('네이버'),
      messages.auth.loginDivider,
      'id="email"',
      'type="submit"',
      'href="/password/reset"',
      messages.auth.emailHelpTrigger,
    ].map((needle) => markup.indexOf(needle))

    expect(order.every((index) => index > -1)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('보이는 제목을 그리지 않는다 — 화면의 h1 은 페이지가 sr-only 로 둔다', () => {
    expect(markup).not.toContain('<h1')
  })
})

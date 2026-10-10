import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { SIGNUP_STEP_STATUS_ID } from '@/features/auth/signup-parts'
import { CodeStep, EmailStep, ProfileStep } from '@/features/auth/signup-steps'
import { NO_FORM_ERRORS } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'

const noop = () => undefined

describe('EmailStep', () => {
  /*
    단계 표시는 제목 묶음(`SignupStepHeading`, #1083 → #1284)의 몫이다. 단계 컴포넌트가 또 그리면
    한 화면에 "3단계 중 1단계" 가 두 번 선다 — 위치 이동이 복제로 끝나지 않게 잠근다.
  */
  it('단계 표시를 그리지 않는다 — 제목 묶음 SignupStepHeading 의 몫이다', () => {
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

    expect(markup).not.toContain(messages.auth.stepOf(1, 3))
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

  it('5xx 여도 이메일 입력 필드는 그대로 남아있다 — 폼을 대체하지 않고 위에 얹는다', () => {
    // 이슈 #24 최종 리뷰 I1 회귀 방지: early return 으로 폼을 통째로 갈아치우면
    // 회원가입-세부명세.md D4 "단계·입력값 유지"를 어긴다
    const markup = renderToStaticMarkup(
      createElement(EmailStep, {
        values: { email: 'typo@example' },
        errors: NO_FORM_ERRORS,
        errorStatus: 500,
        submitting: false,
        onValueChange: noop,
        onSubmit: noop,
        onRetry: noop,
      }),
    )

    expect(markup).toContain('id="email"')
    expect(markup).toContain(messages.auth.emailLabel)
    expect(markup).toContain('typo@example')
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

  /*
    429 는 제출 실패 뒤 포커스가 알림으로 온다 — 포커스가 낭독 경로라 role=alert 를 뗀다 (#1102).
  */
  it('429 는 ErrorState 를 쓰지 않고 서버 문구 알림을 렌더한다 — 포커스가 읽어 role=alert 는 없다', () => {
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

    expect(markup).toContain('data-form-alert=""')
    expect(markup).not.toContain('role="alert"')
    expect(markup).toContain('너무 많은 시도가 있었어요. 잠시 후 다시 이용해 주세요.')
    expect(markup).not.toContain(messages.common.temporaryErrorTitle)
  })

  /*
    되돌림 안내(AUTH_005 · MEMBER_006)는 단계 전환 effect 가 이메일 칸으로 옮긴다 — 포커스가 알림에
    오지 않으므로 `SignupForm` 이 `live` 를 넘겨 알림이 낭독 경로가 된다 (#1102).
  */
  it('announce=live(되돌림 안내) 면 role=alert 로 알린다', () => {
    const markup = renderToStaticMarkup(
      createElement(EmailStep, {
        values: { email: '' },
        errors: {
          fields: {},
          form: '인증코드가 만료되었거나 발급되지 않았습니다. 다시 요청해주세요.',
        },
        errorStatus: null,
        submitting: false,
        announce: 'live',
        onValueChange: noop,
        onSubmit: noop,
        onRetry: noop,
      }),
    )

    expect(markup.match(/role="alert"/g)).toHaveLength(1)
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

  it('5xx 여도 코드 입력 필드는 그대로 남아있다 — 폼을 대체하지 않고 위에 얹는다', () => {
    // 이슈 #24 최종 리뷰 I1 회귀 방지: early return 으로 폼을 통째로 갈아치우면
    // 회원가입-세부명세.md D4 "단계·입력값 유지"를 어긴다
    const markup = renderToStaticMarkup(
      createElement(CodeStep, {
        email: 'a@b.c',
        values: { code: 'WRONG1' },
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

    expect(markup).toContain('id="code"')
    expect(markup).toContain(messages.auth.codeLabel)
    expect(markup).toContain('WRONG1')
  })

  it('429(쿨다운) 는 ErrorState 를 쓰지 않고 서버 문구 알림을 렌더하며 재전송은 비활성 유지한다', () => {
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

    // 재전송 뒤 포커스가 이 알림으로 온다 — 포커스가 읽어 role=alert 는 없다 (#1102)
    expect(markup).toContain('data-form-alert=""')
    expect(markup).not.toContain('role="alert"')
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

describe('진행 중인 이메일 — 2·3단계가 라벨과 함께 보인다 (#1083)', () => {
  const LONG_EMAIL = 'verylongaddress.for.jeju.trip@example.com'

  it('2단계는 "받는 이메일" 라벨을 붙인다', () => {
    const markup = renderToStaticMarkup(
      createElement(CodeStep, {
        email: LONG_EMAIL,
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

    expect(markup).toContain(
      `<dt class="text-caption text-fg-muted">${messages.auth.codeRecipientLabel}</dt>`,
    )
    expect(markup).toContain(LONG_EMAIL)
    expect(markup).toContain('break-all')
  })

  it('3단계에도 이메일을 "가입할 이메일" 로 보인다 — 비밀번호 입력보다 먼저다', () => {
    const markup = renderToStaticMarkup(
      createElement(ProfileStep, {
        email: LONG_EMAIL,
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

    expect(markup).toContain(messages.auth.signupEmailLabel)
    expect(markup).toContain(LONG_EMAIL)
    expect(markup.indexOf(LONG_EMAIL)).toBeLessThan(markup.indexOf('id="password"'))
  })

  /*
    값 표시이지 입력이 아니다 — 이메일은 1단계에서 정해졌고 3단계에서 고칠 수 없다. 입력처럼
    보이면 고치려다 막힌다.
  */
  it('3단계의 이메일은 입력 필드가 아니다', () => {
    const markup = renderToStaticMarkup(
      createElement(ProfileStep, {
        email: LONG_EMAIL,
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

    expect(markup).not.toContain('type="email"')
  })
})

describe('ProfileStep', () => {
  it('비밀번호·이름·닉네임을 렌더한다', () => {
    const markup = renderToStaticMarkup(
      createElement(ProfileStep, {
        email: 'a@b.c',
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
        email: 'a@b.c',
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
    // 이메일은 URL 이 아니라 누를 때 넘겨주기로 간다 — 기록 · 로그 · Referer 에 남지 않게 (#1158)
    expect(markup).toContain('href="/login?returnTo=%2F"')
    expect(markup).not.toContain('email=')
  })

  it('5xx 면 ErrorState 와 재시도 버튼을 렌더한다', () => {
    const markup = renderToStaticMarkup(
      createElement(ProfileStep, {
        email: 'a@b.c',
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

  it('5xx 여도 입력 필드는 그대로 남아있다 — 폼을 대체하지 않고 위에 얹는다', () => {
    // 이슈 #24 최종 리뷰 I1 회귀 방지: early return 으로 폼을 통째로 갈아치우면
    // 회원가입-세부명세.md D4 "단계·입력값 유지"를 어긴다
    const markup = renderToStaticMarkup(
      createElement(ProfileStep, {
        email: 'a@b.c',
        values: { password: 'pw', name: '홍길동', nickname: '길동이' },
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

    expect(markup).toContain('id="password"')
    expect(markup).toContain('id="name"')
    expect(markup).toContain('id="nickname"')
    expect(markup).toContain(messages.auth.passwordLabel)
    expect(markup).toContain('홍길동')
  })

  it('notice 가 있으면 role=status 로 렌더한다 — 2단계 성공 안내', () => {
    const markup = renderToStaticMarkup(
      createElement(ProfileStep, {
        email: 'a@b.c',
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
        email: 'a@b.c',
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

/*
  #1079 — 5xx 에서 일시 장애와 서버 문구 알림이 함께 섰다. `apiErrorToFormErrors` 가 5xx 에도
  `form` 을 채우기 때문이다. 세 단계 모두 같은 자리(`FormFailure`)를 쓰는지 잠근다.
*/
describe('세 단계 — 5xx 에는 일시 장애 하나만 선다 (#1079)', () => {
  const SERVER_MESSAGE = '서비스를 일시적으로 사용할 수 없습니다.'
  const failed = { errors: { fields: {}, form: SERVER_MESSAGE }, errorStatus: 503 }

  const steps = [
    {
      name: 'EmailStep',
      markup: () =>
        renderToStaticMarkup(
          createElement(EmailStep, {
            values: { email: '' },
            submitting: false,
            onValueChange: noop,
            onSubmit: noop,
            onRetry: noop,
            ...failed,
          }),
        ),
    },
    {
      name: 'CodeStep',
      markup: () =>
        renderToStaticMarkup(
          createElement(CodeStep, {
            email: 'a@b.c',
            values: { code: '' },
            submitting: false,
            cooldownSeconds: 0,
            resending: false,
            onValueChange: noop,
            onSubmit: noop,
            onResend: noop,
            onChangeEmail: noop,
            onRetry: noop,
            ...failed,
          }),
        ),
    },
    {
      name: 'ProfileStep',
      markup: () =>
        renderToStaticMarkup(
          createElement(ProfileStep, {
            email: 'a@b.c',
            values: { password: '', name: '', nickname: '' },
            submitting: false,
            duplicateEmail: null,
            returnTo: '/',
            onValueChange: noop,
            onSubmit: noop,
            onRetry: noop,
            ...failed,
          }),
        ),
    },
  ]

  it.each(steps)('$name', ({ markup }) => {
    const html = markup()

    expect(html).toContain(messages.common.temporaryErrorTitle)
    expect(html).toContain('data-form-temporary-error')
    expect(html).not.toContain(SERVER_MESSAGE)
    expect(html).not.toContain('data-form-alert')
    expect(html).not.toContain('py-12')
  })
})

/* 전부 필수인 폼의 `*` 는 정보가 없다 (#1283 C5 → #1284) — 라벨 안 `aria-hidden` `*` 로 찾는다 */
describe('가입 단계 — 필수 표시(*)를 그리지 않는다 (#1284)', () => {
  const REQUIRED_MARK = /<span aria-hidden="true"[^>]*>\*<\/span>/
  const base = {
    errors: NO_FORM_ERRORS,
    errorStatus: null,
    submitting: false,
    onValueChange: noop,
    onSubmit: noop,
    onRetry: noop,
  }

  it('1단계 이메일', () => {
    expect(
      renderToStaticMarkup(createElement(EmailStep, { ...base, values: { email: '' } })),
    ).not.toMatch(REQUIRED_MARK)
  })

  it('2단계 인증코드', () => {
    const markup = renderToStaticMarkup(
      createElement(CodeStep, {
        ...base,
        email: 'a@b.c',
        values: { code: '' },
        cooldownSeconds: 0,
        resending: false,
        onResend: noop,
        onChangeEmail: noop,
      }),
    )
    expect(markup).not.toMatch(REQUIRED_MARK)
  })

  it('3단계 비밀번호 · 이름 · 닉네임', () => {
    const markup = renderToStaticMarkup(
      createElement(ProfileStep, {
        ...base,
        email: 'a@b.c',
        values: { password: '', name: '', nickname: '' },
        duplicateEmail: null,
        returnTo: '/',
      }),
    )
    expect(markup).not.toMatch(REQUIRED_MARK)
  })
})

/*
  #1295 N4 — 단계 전환 때 포커스가 곧장 새 단계의 첫 칸으로 간다(D6). 보이는 단계 글자가 없어
  "3단계 중 N단계"(sr-only)가 유일한 단서인데, 칸이 그 문단을 가리키지 않아 낭독되지 않았다.
  **첫 칸만** 가리킨다 — 단계 안에서 칸을 옮길 때마다 단계를 다시 읽히면 소음이다.

  여는 태그 범위로 좁혀 단언한다 — 마크업 전체에서 id 를 찾으면 다른 칸이 가리켜도 통과한다.
*/
describe('가입 단계 — 첫 칸이 단계 문구를 가리킨다 (#1295)', () => {
  const base = {
    errors: NO_FORM_ERRORS,
    errorStatus: null,
    submitting: false,
    onValueChange: noop,
    onSubmit: noop,
    onRetry: noop,
  }

  function describedByOf(markup: string, id: string): string[] {
    const tag = new RegExp(`<input[^>]*\\bid="${id}"[^>]*>`).exec(markup)?.[0]
    if (tag === undefined) throw new Error(`id="${id}" 인 입력 요소가 없다`)
    return (/aria-describedby="([^"]*)"/.exec(tag)?.[1] ?? '').split(' ').filter(Boolean)
  }

  it('1단계 이메일 칸', () => {
    const markup = renderToStaticMarkup(
      createElement(EmailStep, { ...base, values: { email: '' } }),
    )

    expect(describedByOf(markup, 'email')).toEqual([SIGNUP_STEP_STATUS_ID])
  })

  it('1단계 이메일 칸 — 오류가 있으면 오류가 먼저, 단계 문구가 뒤다', () => {
    const markup = renderToStaticMarkup(
      createElement(EmailStep, {
        ...base,
        values: { email: '' },
        errors: { fields: { email: '이메일을 입력해주세요.' }, form: null },
      }),
    )

    expect(describedByOf(markup, 'email')).toEqual(['email-error', SIGNUP_STEP_STATUS_ID])
  })

  it('2단계 코드 칸', () => {
    const markup = renderToStaticMarkup(
      createElement(CodeStep, {
        ...base,
        email: 'a@b.c',
        values: { code: '' },
        cooldownSeconds: 0,
        resending: false,
        onResend: noop,
        onChangeEmail: noop,
      }),
    )

    expect(describedByOf(markup, 'code')).toEqual([SIGNUP_STEP_STATUS_ID])
  })

  it('3단계 비밀번호 칸은 규칙 안내와 합쳐 가리키고, 나머지 칸은 가리키지 않는다', () => {
    const markup = renderToStaticMarkup(
      createElement(ProfileStep, {
        ...base,
        email: 'a@b.c',
        values: { password: '', name: '', nickname: '' },
        duplicateEmail: null,
        returnTo: '/',
      }),
    )

    expect(describedByOf(markup, 'password')).toEqual(['password-hint', SIGNUP_STEP_STATUS_ID])
    expect(describedByOf(markup, 'name')).not.toContain(SIGNUP_STEP_STATUS_ID)
    expect(describedByOf(markup, 'nickname')).not.toContain(SIGNUP_STEP_STATUS_ID)
  })
})

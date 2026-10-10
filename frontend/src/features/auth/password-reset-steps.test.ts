import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  PasswordResetCodeStep,
  type PasswordResetCodeStepProps,
  PasswordResetDone,
  PasswordResetEmailStep,
  type PasswordResetEmailStepProps,
  PasswordResetHeading,
} from '@/features/auth/password-reset-steps'
import { NO_FORM_ERRORS } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'

const noop = () => undefined

/*
  **`overrides` 를 `Partial<Props>` 로 받고 `as never` 를 쓰지 않는다.** 캐스팅하면 prop 을
  개명하거나 필수 prop 을 추가했을 때 `pnpm typecheck` 가 통과하고, 테스트는 `undefined` 를
  넘긴 채 초록으로 남는다 — `signup-steps.test.ts` 가 매 케이스 완전 타입 props 를 적어
  지키고 있는 방어다 (코드 리뷰 지적).
*/
function emailStep(overrides: Partial<PasswordResetEmailStepProps> = {}) {
  return renderToStaticMarkup(
    createElement(PasswordResetEmailStep, {
      values: { email: '' },
      errors: NO_FORM_ERRORS,
      errorStatus: null,
      submitting: false,
      onValueChange: noop,
      onSubmit: noop,
      onRetry: noop,
      ...overrides,
    }),
  )
}

function codeStep(overrides: Partial<PasswordResetCodeStepProps> = {}) {
  return renderToStaticMarkup(
    createElement(PasswordResetCodeStep, {
      email: 'demo@hondigagae.dev',
      values: { code: '', newPassword: '' },
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
      ...overrides,
    }),
  )
}

describe('계정 열거 방지', () => {
  it('인증 문구 어디에도 "가입되지 않은 이메일" 류가 없다', () => {
    /*
      회귀 테스트. 서버가 계정 존재 여부를 일부러 감추는데(발송은 항상 성공 응답) 화면이
      그것을 흘리면 열거 벡터가 된다 — 정본 D1. 문구를 하나 추가하다 무심코 만들기 쉬워서
      개별 컴포넌트가 아니라 **문구 사전 전체**를 훑는다.
    */
    const texts = (Object.values(messages.auth) as unknown[]).filter(
      (value): value is string => typeof value === 'string',
    )

    expect(texts.filter((text) => text.includes('가입되지 않은'))).toEqual([])
    expect(texts.filter((text) => text.includes('없는 이메일'))).toEqual([])
    expect(texts.filter((text) => text.includes('가입된 이메일이 아'))).toEqual([])
  })
})

describe('PasswordResetEmailStep', () => {
  it('5xx 면 ErrorState 를 얹되 이메일 입력은 그대로 남는다', () => {
    const markup = emailStep({ errorStatus: 500, values: { email: 'typo@example' } })

    expect(markup).toContain(messages.common.temporaryErrorTitle)
    expect(markup).toContain(messages.common.retry)
    // 폼을 통째로 갈아치우면 오타를 고칠 수단이 사라진다
    expect(markup).toContain('id="email"')
    expect(markup).toContain('typo@example')
  })

  it('429 는 ErrorState 가 아니라 FormAlert 다 — 재시도 버튼이 상한만 더 소모한다', () => {
    // AUTH_003(이메일 60초) · AUTH_016(IP 상한) 둘 다 429 다
    const markup = emailStep({
      errorStatus: 429,
      errors: { fields: {}, form: '인증코드 요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.' },
    })

    expect(markup).not.toContain(messages.common.temporaryErrorTitle)
    // 제출 실패 뒤 포커스가 이 알림으로 온다 — 포커스가 읽어 role=alert 는 없다 (#1102)
    expect(markup).toContain('data-form-alert=""')
    expect(markup).not.toContain('role="alert"')
    expect(markup).toContain('인증코드 요청이 너무 잦습니다')
  })

  it('되돌아온 사유는 role=alert 로 알린다 — role=status 가 아니다', () => {
    // AUTH_005/AUTH_017 로 1단계에 되돌아온 경우. 성공 안내가 아니라 실패 사유다.
    // 포커스는 단계 전환 effect 가 이메일 칸으로 옮기므로 `PasswordResetView` 가 live 를 넘긴다 (#1102)
    const markup = emailStep({
      announce: 'live',
      errors: {
        fields: {},
        form: '인증코드 시도 횟수를 초과했습니다. 인증코드를 다시 요청해주세요.',
      },
    })

    expect(markup).toContain('role="alert"')
    expect(markup).toContain('인증코드 시도 횟수를 초과했습니다')
  })
})

describe('PasswordResetCodeStep', () => {
  it('발송 성공 문구는 이메일이 무엇이든 같다', () => {
    const known = codeStep({ notice: messages.auth.resetCodeSent })
    const unknown = codeStep({
      email: 'nobody@hondigagae.dev',
      notice: messages.auth.resetCodeSent,
    })

    expect(known).toContain(messages.auth.resetCodeSent)
    expect(unknown).toContain(messages.auth.resetCodeSent)
  })

  it('코드와 새 비밀번호의 자동완성 힌트가 서로 다르다', () => {
    const markup = codeStep()

    expect(markup).toContain('autoComplete="one-time-code"')
    expect(markup).toContain('autoComplete="new-password"')
    // 영숫자 혼합 코드라 numeric 이면 영문자를 못 넣는다
    expect(markup).toContain('inputMode="text"')
  })

  it('필드 id 가 newPassword 다 — 서버 필드 오류(AUTH_106~108)가 여기 붙는다', () => {
    const markup = codeStep({
      errors: { fields: { newPassword: '비밀번호는 8자 이상 20자 이하여야 합니다.' }, form: null },
    })

    expect(markup).toContain('id="newPassword"')
    expect(markup).toContain('비밀번호는 8자 이상 20자 이하여야 합니다.')
  })

  it('쿨다운 중에는 남은 시간을 텍스트로도 준다', () => {
    const markup = codeStep({ cooldownSeconds: 42 })

    expect(markup).toContain(messages.auth.resendCooldown(42))
    expect(markup).toContain('disabled=""')
  })

  it('카운트다운을 매 초 읽지 않는다 — live 알림은 10초 단위다', () => {
    expect(codeStep({ cooldownSeconds: 30 })).toContain(messages.auth.resendCooldown(30))

    const odd = codeStep({ cooldownSeconds: 37 })
    // 보이는 라벨에는 있지만 live 영역(sr-only)에는 실리지 않는다
    expect(odd).toContain(messages.auth.resendCooldown(37))
    expect(odd).toContain('<span aria-live="polite" class="sr-only"></span>')
  })

  /*
    토글의 두 상태(가려짐 ↔ 보임)와 이름 · `aria-controls` 배선은 `PasswordInput` 이 갖고
    `components/password-input.test.ts` 가 본다. 여기서는 **이 칸이 그 토글을 쓴다** 는 것만
    고정한다 — 로그인 폼에서 옮겨 온 배선이 이 화면에서 빠지지 않게 (#1080).
  */
  it('새 비밀번호 칸에 눈 토글이 있고, 가려진 채로 시작한다', () => {
    const markup = codeStep()

    expect(markup).toContain('type="password"')
    expect(markup).toContain('aria-pressed="false"')
    expect(markup).toContain(`aria-label="${messages.auth.passwordShow}"`)
    expect(markup).toContain('aria-controls="newPassword"')
  })

  it('비밀번호 규칙을 틀리기 전에 보여 준다 (#1080)', () => {
    expect(codeStep()).toContain(messages.form.passwordRule)
  })

  it('틀리면 규칙 자리를 오류가 대신한다 — 두 줄이 겹쳐 서지 않는다', () => {
    const markup = codeStep({
      errors: { fields: { newPassword: messages.form.passwordLength }, form: null },
    })

    expect(markup).toContain(messages.form.passwordLength)
    expect(markup).not.toContain(messages.form.passwordRule)
  })
})

describe('PasswordResetDone', () => {
  // 안내 문장은 제목 묶음(`PasswordResetHeading`)으로 옮겼다 — 제목 아래 4 에 붙는다 (#1084 L3)
  it('전 기기 로그아웃 안내는 여기가 아니라 제목 아래 설명 줄이 한다', () => {
    const done = renderToStaticMarkup(createElement(PasswordResetDone))
    const heading = renderToStaticMarkup(
      createElement(PasswordResetHeading, {
        heading: messages.auth.resetDoneTitle,
        description: messages.auth.resetDoneDescription,
      }),
    )

    expect(done).not.toContain(messages.auth.resetDoneDescription)
    expect(heading).toContain('모든 기기')
  })

  /* 이메일은 URL 이 아니라 넘겨주기로 간다 — 재설정 성공 시점에 넘긴다 (#1158) */
  it('로그인 링크가 이메일을 URL 에 싣지 않는다', () => {
    const markup = renderToStaticMarkup(createElement(PasswordResetDone))

    expect(markup).toContain('href="/login"')
    expect(markup).not.toContain('email=')
  })

  it('제목을 다시 렌더하지 않는다 — 뷰의 aria-live 영역이 이미 읽는다', () => {
    const markup = renderToStaticMarkup(createElement(PasswordResetDone))

    expect(markup).not.toContain(messages.auth.resetDoneTitle)
  })
})

/*
  #1079 — 5xx 에서 일시 장애와 서버 문구 알림이 함께 섰다. `apiErrorToFormErrors` 가 5xx 에도
  `form` 을 채우기 때문이다. 두 단계 모두 같은 자리(`FormFailure`)를 쓰는지 잠근다.
*/
describe('두 단계 — 5xx 에는 일시 장애 하나만 선다 (#1079)', () => {
  const SERVER_MESSAGE = '서비스를 일시적으로 사용할 수 없습니다.'
  const failed = { errors: { fields: {}, form: SERVER_MESSAGE }, errorStatus: 503 }

  it.each([
    { name: '1단계', markup: () => emailStep(failed) },
    { name: '2단계', markup: () => codeStep(failed) },
  ])('$name', ({ markup }) => {
    const html = markup()

    expect(html).toContain(messages.common.temporaryErrorTitle)
    expect(html).toContain('data-form-temporary-error')
    expect(html).not.toContain(SERVER_MESSAGE)
    expect(html).not.toContain('data-form-alert')
    expect(html).not.toContain('py-12')
  })
})

/*
  #1084 L3 — 단계 제목과 설명 줄 사이가 24 넘게 벌어져 있었다(제목은 화면 쪽 `gap-6`, 설명은
  폼 안). DESIGN.md §4 는 "제목 아래 캡션/설명 줄" 을 4 로 정한다.
*/
describe('PasswordResetHeading — 제목 아래 설명 줄은 4 다 (#1084)', () => {
  const markup = renderToStaticMarkup(
    createElement(PasswordResetHeading, {
      heading: messages.auth.resetEmailHeading,
      description: messages.auth.resetEmailDescription,
    }),
  )

  it('제목과 설명이 gap-1 한 묶음이고 제목이 먼저다', () => {
    expect(markup.startsWith('<div aria-live="polite" class="flex flex-col gap-1">')).toBe(true)
    expect(markup.indexOf(messages.auth.resetEmailHeading)).toBeLessThan(
      markup.indexOf(messages.auth.resetEmailDescription),
    )
  })

  it('설명이 없는 단계는 제목 한 줄이다', () => {
    const codeHeading = renderToStaticMarkup(
      createElement(PasswordResetHeading, { heading: messages.auth.resetCodeHeading }),
    )

    // 제목은 `h2` 다 (#1283 — 보이는 가장 큰 글자라 구조도 제목). 설명 `p` 는 없다
    expect(codeHeading.match(/<h2/g)).toHaveLength(1)
    expect(codeHeading).not.toContain('<p')
  })

  it('1단계 폼은 설명 줄을 다시 그리지 않는다 — 실패 알림이 제목과 설명 사이에 끼던 자리다', () => {
    expect(
      emailStep({ errorStatus: 429, errors: { fields: {}, form: '잠겼습니다.' } }),
    ).not.toContain(messages.auth.resetEmailDescription)
  })
})

/*
  #1084 L4 — 가입은 "인증코드 받기", 재설정은 "코드 받기" 였고 재발송은 명세(D4 "다시 보내기")와
  다른 "재전송" 이었다. 같은 메일 · 같은 칸이라 말도 같아야 한다.
*/
describe('용어 — 인증코드 받기 · 다시 보내기 (#1084)', () => {
  it('재설정 발송 버튼은 가입 발송 버튼과 같은 말이다', () => {
    expect(messages.auth.resetSendCode).toBe(messages.auth.sendCode)
    expect(emailStep()).toContain('인증코드 받기')
  })

  it('재발송 버튼은 "다시 보내기" 다 — 쿨다운 중에도 같은 말로 시작한다', () => {
    expect(codeStep()).toContain('다시 보내기')
    expect(codeStep({ cooldownSeconds: 42 })).toContain('다시 보내기 (42초 후 가능)')
    expect(codeStep({ cooldownSeconds: 42 })).not.toContain('재전송')
  })
})

describe('두 단계 — 요청이 도는 동안 직전 실패를 걷는다 (#1084 L2)', () => {
  const failed = { errors: { fields: {}, form: '잠겼습니다.' }, errorStatus: 429 }

  it.each([
    { name: '1단계 제출 중', markup: () => emailStep({ ...failed, submitting: true }) },
    { name: '2단계 제출 중', markup: () => codeStep({ ...failed, submitting: true }) },
    { name: '2단계 재발송 중', markup: () => codeStep({ ...failed, resending: true }) },
  ])('$name', ({ markup }) => {
    expect(markup()).not.toContain('잠겼습니다.')
  })
})

/* 칸 하나(1단계) · 두 칸 다 필수(2단계)인 폼의 `*` 는 정보가 없다 (#1283 C5, 정본 D11) */
describe('재설정 폼 — 필수 표시(*)를 그리지 않는다 (#1283)', () => {
  const REQUIRED_MARK = /<span aria-hidden="true"[^>]*>\*<\/span>/

  it('1단계 이메일', () => {
    expect(emailStep()).not.toMatch(REQUIRED_MARK)
  })

  it('2단계 코드 · 새 비밀번호', () => {
    expect(codeStep()).not.toMatch(REQUIRED_MARK)
  })
})

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  PasswordResetCodeStep,
  type PasswordResetCodeStepProps,
  PasswordResetDone,
  PasswordResetEmailStep,
  type PasswordResetEmailStepProps,
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
    expect(markup).toContain('role="alert"')
    expect(markup).toContain('인증코드 요청이 너무 잦습니다')
  })

  it('되돌아온 사유는 role=alert 로 알린다 — role=status 가 아니다', () => {
    // AUTH_005/AUTH_017 로 1단계에 되돌아온 경우. 성공 안내가 아니라 실패 사유다
    const markup = emailStep({
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
  it('전 기기 로그아웃 사실을 알린다', () => {
    const markup = renderToStaticMarkup(
      createElement(PasswordResetDone, { email: 'demo@hondigagae.dev' }),
    )

    expect(markup).toContain(messages.auth.resetDoneDescription)
    expect(markup).toContain('모든 기기')
  })

  it('로그인 링크에 이메일을 미리 채운다', () => {
    const markup = renderToStaticMarkup(
      createElement(PasswordResetDone, { email: 'demo@hondigagae.dev' }),
    )

    expect(markup).toContain('href="/login?email=demo%40hondigagae.dev"')
  })

  it('제목을 다시 렌더하지 않는다 — 뷰의 aria-live 영역이 이미 읽는다', () => {
    const markup = renderToStaticMarkup(
      createElement(PasswordResetDone, { email: 'demo@hondigagae.dev' }),
    )

    expect(markup).not.toContain(messages.auth.resetDoneTitle)
  })
})

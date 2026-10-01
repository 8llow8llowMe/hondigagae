import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { ProfileStep, type ProfileStepProps } from '@/features/auth/signup-steps'
import { NO_FORM_ERRORS } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'

/**
 * 회원가입 3단계의 **비밀번호 칸** — 이슈 #1080.
 *
 * `signup-steps.test.ts` 와 파일을 나눈 이유: 같은 단계의 다른 칸 · 1·2단계를 다른 이슈가 함께
 * 고치고 있어, 비밀번호 칸의 계약만 따로 둬야 서로의 변경이 한 파일에서 부딪히지 않는다.
 * 토글의 두 상태 자체는 `components/password-input.test.ts` 가 본다.
 */
const noop = () => undefined

function render(overrides: Partial<ProfileStepProps> = {}) {
  return renderToStaticMarkup(
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
      ...overrides,
    }),
  )
}

describe('ProfileStep — 비밀번호 칸', () => {
  it('비밀번호 규칙을 틀리기 전에 보여 준다', () => {
    expect(render()).toContain(messages.form.passwordRule)
  })

  it('틀리면 규칙 자리를 오류가 대신한다 — 두 줄이 겹쳐 서지 않는다', () => {
    const markup = render({
      errors: { fields: { password: messages.form.passwordPattern }, form: null },
    })

    expect(markup).toContain(messages.form.passwordPattern)
    expect(markup).not.toContain(messages.form.passwordRule)
  })

  /*
    확인 칸을 두지 않는 대신(회원가입-세부명세 D6) 친 값을 직접 보고 고칠 수단이 이 토글이다.
    빠지면 오타를 확인할 방법이 없다.
  */
  it('로그인과 같은 눈 토글이 있고, 가려진 채로 시작한다', () => {
    const markup = render()

    expect(markup).toContain('aria-pressed="false"')
    expect(markup).toContain(`aria-label="${messages.auth.passwordShow}"`)
    expect(markup).toContain('aria-controls="password"')
  })

  it('비밀번호 확인 칸을 두지 않는다 — 비밀번호 입력은 하나다', () => {
    expect(render().match(/autoComplete="new-password"/g)).toHaveLength(1)
  })
})
